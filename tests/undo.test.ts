import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../shared/seed';
import { accountFlows, localDate, summarize, validateTransaction } from '../shared/model';
import { undoEntry } from '../shared/undo';

for (const type of ['Expense', 'Income', 'Transfer'] as const) test(`${type}: Undo cancels the new entry, preserves history and refuses a second undo`, () => {
  const state = initialState();
  const entry = validateTransaction({ id: 'new', date: localDate(), time: '12:00', type, amountCents: 505, category: type === 'Expense' ? 'Food' : type === 'Income' ? 'Employment' : '', subcategory: type === 'Expense' ? 'Grocery' : '', merchant: 'Sample', description: '', accountId: state.accounts[0].id, toAccountId: type === 'Transfer' ? state.accounts[1].id : '', scope: 'Personal', classification: type === 'Expense' ? 'Need' : '', notes: '' }, state);
  state.transactions.push(entry); state.audit.push({ id: 'save', entity: 'transaction', entityId: entry.id, at: entry.updatedAt, before: null, after: entry });
  const original = structuredClone(state);
  const result = undoEntry(state, entry.id, entry.revision, Date.parse(entry.updatedAt) + 1000);
  assert.equal(result.restored, null); assert.equal(result.stored.voided, true); assert.equal(result.stored.amountCents, 505);
  assert.deepEqual(state, original);
  const active = [result.stored].filter(transaction => !transaction.voided);
  assert.deepEqual(summarize(active), summarize([])); assert.deepEqual(accountFlows(entry.accountId, active), accountFlows(entry.accountId, []));
  assert.throws(() => undoEntry({ ...state, transactions: active }, entry.id, entry.revision), /changed/);
});
test('Undo restores an edit with a new revision, rejects stale edits, expired saves and newer bank snapshots', () => {
  const state = initialState();
  const first = validateTransaction({ id: 'edit', date: localDate(), time: '12:00', type: 'Expense', amountCents: 10, category: 'Food', subcategory: 'Grocery', merchant: 'Shop', description: '', accountId: state.accounts[0].id, toAccountId: '', scope: 'Personal', classification: 'Need', notes: '' }, state);
  state.transactions.push(first);
  const current = validateTransaction({ ...first, amountCents: 99, revision: first.revision }, state, first);
  state.transactions = [current]; state.audit.push({ id: 'edit-save', entity: 'transaction', entityId: current.id, at: current.updatedAt, before: first, after: current });
  const saved = Date.parse(current.updatedAt);
  const restored = undoEntry(state, current.id, current.revision, saved + 1000).restored!;
  assert.equal(restored.amountCents, 10); assert.equal(restored.revision, current.revision + 1); assert.equal(restored.createdAt, first.createdAt);
  assert.throws(() => undoEntry(state, current.id, first.revision, saved + 1000), /changed/);
  assert.throws(() => undoEntry(state, current.id, current.revision, saved + 15001), /expired/);
  state.accounts[0].balanceUpdatedAt = new Date(saved + 500).toISOString();
  assert.throws(() => undoEntry(state, current.id, current.revision, saved + 1000), /bank balance changed/);
});
