import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type { Firestore, Transaction as FirestoreTransaction } from 'firebase-admin/firestore';
import type { State } from '../shared/model';
import { stateTables, validateBackup } from '../shared/backup';

export type RecordWrite = { table: keyof State; records: unknown[] };
export function documentId(table: keyof State, record: { id: string; month?: string }) {
  return createHash('sha256').update(JSON.stringify([record.id, table === 'budgets' || table === 'income' ? record.month : ''])).digest('hex');
}
export class FirestoreStore {
  private scope = new AsyncLocalStorage<{ transaction: FirestoreTransaction; state: State }>();
  constructor(private db: Firestore, private uid: string) {
    if (!uid || uid.includes('/')) throw new Error('Invalid authenticated user.');
  }
  private root() { return this.db.collection('cashFlowUsers').doc(this.uid); }
  private meta() { return this.root().collection('metadata').doc('state'); }
  private collection(table: keyof State) { return this.root().collection(table); }
  async info() {
    const meta = await this.meta().get();
    return { initialized: meta.exists, revision: meta.data()?.revision ?? 0 };
  }
  private async snapshot(transaction: FirestoreTransaction): Promise<{ state: State; revision: number }> {
    const meta = await transaction.get(this.meta());
    if (!meta.exists) throw new Error('Import your reviewed backup before adding cloud records.');
    if (meta.data()?.schemaVersion !== 1) throw new Error('This cloud schema requires a newer tracker.');
    const snapshots = await Promise.all(stateTables.map(table => transaction.get(this.collection(table))));
    const order = meta.data()!.recordOrder ?? {};
    const state = Object.fromEntries(stateTables.map((table, index) => {
      const positions = new Map((order[table] ?? []).map((id: string, position: number) => [id, position]));
      const records = snapshots[index].docs.map(doc => doc.data());
      records.sort((a, b) => Number(positions.get(documentId(table, a as { id: string })) ?? Number.MAX_SAFE_INTEGER) - Number(positions.get(documentId(table, b as { id: string })) ?? Number.MAX_SAFE_INTEGER));
      return [table, records];
    })) as unknown as State;
    return { state, revision: meta.data()!.revision };
  }
  async readState(): Promise<State> {
    const current = this.scope.getStore();
    if (current) return current.state;
    return this.db.runTransaction(async transaction => (await this.snapshot(transaction)).state, { readOnly: true });
  }
  async mutate<T>(operation: () => Promise<T>): Promise<T> {
    return this.db.runTransaction(async transaction => {
      const { state, revision } = await this.snapshot(transaction);
      const result = await this.scope.run({ transaction, state }, operation);
      // Every mutation reads and updates this marker. Concurrent servers retry
      // against a coherent new snapshot before validating a stale revision.
      transaction.update(this.meta(), { revision: revision + 1, updatedAt: new Date().toISOString(), recordOrder: Object.fromEntries(stateTables.map(table => [table, state[table].map(record => documentId(table, record))])) });
      return result;
    });
  }
  async writeRecords(writes: RecordWrite[]) {
    const current = this.scope.getStore();
    if (!current) throw new Error('Firestore writes require an atomic mutation.');
    for (const write of writes) for (const value of write.records) {
      const record = value as { id: string; month?: string };
      const ref = this.collection(write.table).doc(documentId(write.table, record));
      if (write.table === 'audit') current.transaction.create(ref, value as Record<string, unknown>);
      else current.transaction.set(ref, value as Record<string, unknown>);
      const rows = current.state[write.table] as unknown as { id: string; month?: string }[];
      const index = rows.findIndex(row => documentId(write.table, row) === documentId(write.table, record));
      if (index < 0) rows.push(record); else rows[index] = record;
    }
  }
  async initialize(input: unknown) {
    const state = validateBackup(input);
    await this.db.runTransaction(async transaction => {
      if ((await transaction.get(this.meta())).exists) throw new Error('Cloud records already exist. Nothing was replaced.');
      const existing = await Promise.all(stateTables.map(table => transaction.get(this.collection(table).limit(1))));
      if (existing.some(snapshot => !snapshot.empty)) throw new Error('Cloud records already exist without a setup marker. Review them before importing.');
      for (const table of stateTables) for (const record of state[table]) transaction.create(this.collection(table).doc(documentId(table, record)), record);
      transaction.create(this.meta(), { schemaVersion: 1, revision: 1, initializedAt: new Date().toISOString(), recordOrder: Object.fromEntries(stateTables.map(table => [table, state[table].map(record => documentId(table, record))])), importedCounts: Object.fromEntries(stateTables.map(table => [table, state[table].length])), importHash: createHash('sha256').update(JSON.stringify(state)).digest('hex') });
    });
    return state;
  }
}
