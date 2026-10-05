import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreStore, documentId } from '../server/firestore';
import { requireOwner } from '../server/firebase';
import { initialState } from '../shared/seed';
import { stateTables, validateBackup } from '../shared/backup';
import { validateTransaction } from '../shared/model';
import { undoEntry } from '../shared/undo';

// A transactional driver: staged writes commit together, thrown operations roll
// back, and independent store instances see the preceding committed revision.
class TransactionalDatabase {
  records = new Map<string, any>();
  private queue = Promise.resolve();
  collection(path: string): any {
    return { path, doc: (id: string) => this.document(`${path}/${id}`), limit: (n: number) => ({ path, limit: n }) };
  }
  private document(path: string): any { return { path, collection: (id: string) => this.collection(`${path}/${id}`), get: async () => this.snapshot({ path }) }; }
  private snapshot(ref: any) {
    if (ref.path.split('/').length % 2 === 0) return { exists: this.records.has(ref.path), data: () => structuredClone(this.records.get(ref.path)) };
    const entries = [...this.records].filter(([path]) => path.startsWith(ref.path + '/') && path.split('/').length === ref.path.split('/').length + 1).slice(0, typeof ref.limit === 'number' ? ref.limit : Infinity);
    return { empty: !entries.length, docs: entries.map(([, data]) => ({ data: () => structuredClone(data) })) };
  }
  runTransaction(operation: (transaction: any) => Promise<any>): Promise<any> {
    const result = this.queue.then(async () => {
      const staged = new Map(this.records);
      const transaction = {
        get: async (ref: any) => this.snapshot(ref),
        set: (ref: any, data: any) => staged.set(ref.path, structuredClone(data)),
        update: (ref: any, data: any) => { assert.ok(staged.has(ref.path)); staged.set(ref.path, { ...staged.get(ref.path), ...structuredClone(data) }); },
        create: (ref: any, data: any) => { if (staged.has(ref.path)) throw new Error('Document already exists.'); staged.set(ref.path, structuredClone(data)); },
      };
      const value = await operation(transaction); this.records = staged; return value;
    });
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }
}

test('Firestore Undo retains the stored entry and immutable audit, excludes it from active money and cannot run twice', async () => {
  const driver = new TransactionalDatabase(), store = new FirestoreStore(driver as unknown as Firestore, 'owner');
  const source = initialState();
  const entry = validateTransaction({ id: 'undo-sample', type: 'Expense', date: '2026-10-01', time: '12:00', amountCents: 5, category: 'Food', subcategory: 'Grocery', merchant: 'Sample', description: '', accountId: source.accounts[0].id, toAccountId: '', scope: 'Personal', classification: 'Need', notes: '' }, source);
  source.transactions = [entry]; source.audit = [{ id: 'saved', entity: 'transaction', entityId: entry.id, at: entry.updatedAt, before: null, after: entry }];
  await store.initialize(source);
  const cancel = () => store.mutate(async () => {
    const result = undoEntry(await store.readState(), entry.id, entry.revision);
    await store.writeRecords([{ table: 'transactions', records: [result.stored] }, { table: 'audit', records: [{ id: 'cancelled', entity: 'transaction undo', entityId: entry.id, at: result.stored.updatedAt, before: result.current, after: result.restored }] }]);
  });
  await cancel();
  assert.deepEqual((await store.readState()).transactions, []);
  const preserved = await store.readState(true); assert.equal(preserved.transactions[0].amountCents, 5); assert.equal(preserved.transactions[0].voided, true);
  assert.deepEqual(preserved.audit[0], source.audit[0]); assert.deepEqual(preserved.audit[1].before, entry); assert.equal(preserved.audit[1].after, null);
  await assert.rejects(cancel(), /changed/); assert.equal((await store.readState()).audit.length, 2);
});

test('Firestore import preserves exact records and refuses duplicate imports or partial data', async () => {
  const driver = new TransactionalDatabase(), store = new FirestoreStore(driver as unknown as Firestore, 'owner');
  const source = initialState(); source.accounts[0].balanceCents = 12345; source.accounts[0].balanceUpdatedAt = '2026-10-01T12:00:00Z';
  const original = structuredClone(source);
  assert.equal((await store.info()).initialized, false);
  await store.initialize(source);
  const restored = await store.readState();
  for (const table of stateTables) assert.deepEqual(restored[table], original[table]);
  assert.deepEqual(source, original);
  await assert.rejects(store.initialize(initialState()), /already exist/);
  assert.deepEqual(await store.readState(), restored);
  const partial = new TransactionalDatabase(); partial.records.set('cashFlowUsers/owner/accounts/existing', source.accounts[0]);
  await assert.rejects(new FirestoreStore(partial as unknown as Firestore, 'owner').initialize(source), /without a setup marker/);
  assert.equal(partial.records.size, 1);
});

test('financial writes and immutable audit history are atomic; stale edits from another store are rejected', async () => {
  const driver = new TransactionalDatabase(); const db = driver as unknown as Firestore;
  const store = new FirestoreStore(db, 'owner'); const second = new FirestoreStore(db, 'owner');
  const source = initialState();
  const original = validateTransaction({ id: 'purchase-1', type: 'Expense', date: '2026-10-01', time: '12:00', amountCents: 500, category: 'Food', subcategory: 'Grocery', merchant: 'Shop', description: '', accountId: source.accounts[0].id, toAccountId: '', scope: 'Business', classification: 'Need', notes: '' }, source);
  source.transactions.push(original); await store.initialize(source);
  const update = (connection: FirestoreStore, id: string) => connection.mutate(async () => {
    const state = await connection.readState(); const before = state.transactions[0];
    const after = validateTransaction({ ...original, amountCents: 700 }, state, before);
    await connection.writeRecords([{ table: 'transactions', records: [after] }, { table: 'audit', records: [{ id, entity: 'transaction', entityId: after.id, at: after.updatedAt, before, after }] }]);
    return after;
  });
  const results = await Promise.allSettled([update(store, 'audit-1'), update(second, 'audit-2')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const state = await store.readState(); assert.equal(state.transactions[0].revision, 2); assert.equal(state.audit.length, 1);
  assert.deepEqual(state.audit[0].before, original); assert.deepEqual(state.audit[0].after, state.transactions[0]);
  await assert.rejects(store.mutate(async () => {
    await store.writeRecords([{ table: 'accounts', records: [{ ...source.accounts[0], balanceCents: 999 }] }, { table: 'audit', records: [state.audit[0]] }]);
  }), /already exists/);
  assert.deepEqual(await store.readState(), state);
  await assert.rejects(store.writeRecords([{ table: 'accounts', records: [] }]), /atomic mutation/);
  assert.notEqual(documentId('budgets', { id: 'same', month: '*' }), documentId('budgets', { id: 'same', month: '2026-10' }));
});

test('verified Google identity must match the owner; another UID cannot read owner records', async () => {
  const identity = { uid: 'owner', email: 'christopher@godz-iagency.com', email_verified: true, firebase: { sign_in_provider: 'google.com', identities: {} } };
  assert.equal(requireOwner(identity, 'christopher@godz-iagency.com'), 'owner');
  for (const value of [{ ...identity, email: 'other@example.com' }, { ...identity, email_verified: false }, { ...identity, firebase: { ...identity.firebase, sign_in_provider: 'password' } }]) assert.throws(() => requireOwner(value, identity.email), /private/);
  const driver = new TransactionalDatabase(); await new FirestoreStore(driver as unknown as Firestore, 'owner').initialize(initialState());
  await assert.rejects(new FirestoreStore(driver as unknown as Firestore, 'other').readState(), /reviewed backup/);
});

test('backup validation rejects corrupt cents, duplicates and oversized imports without changing data', () => {
  const source = initialState(); assert.deepEqual(validateBackup({ ...source, exportedAt: '2026-10-04T00:00:00Z' }).accounts, source.accounts);
  const corrupt = structuredClone(source); corrupt.budgets[0].amountCents = 1.25;
  assert.throws(() => validateBackup(corrupt), /cents/);
  const duplicate = structuredClone(source); duplicate.accounts.push(duplicate.accounts[0]);
  assert.throws(() => validateBackup(duplicate), /Duplicate/);
  const large = structuredClone(source); large.audit = Array.from({ length: 401 }, (_, i) => ({ id: String(i), entity: 'transaction', entityId: String(i), at: '2026-10-04T00:00:00Z', before: null, after: null }));
  assert.throws(() => validateBackup(large), /400 records/);
});
