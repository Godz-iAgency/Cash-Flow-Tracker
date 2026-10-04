import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../shared/seed';
import { accountFlows, budgetSpent, monthBudgets, monthIncome, parseCents, scopedTransactions, summarize, validateTransaction, type Transaction } from '../shared/model';
const draft = (overrides: Record<string, unknown> = {}) => ({ id: 'transaction-1', type: 'Expense', amountCents: 10, date: '2026-10-03', time: '09:15', category: 'Food', subcategory: 'Grocery', merchant: 'H-E-B', description: '', accountId: 'capital-one-checking', toAccountId: '', classification: 'Need', scope: 'Personal', notes: '', ...overrides });
test('supplied monthly baseline is calculated exactly from records', () => {
  const state = initialState();
  assert.equal(monthBudgets(state, '2026-10', 'Personal').reduce((n, b) => n + b.amountCents, 0), 256930);
  assert.equal(monthIncome(state, '2026-10', 'Personal').reduce((n, i) => n + i.amountCents, 0), 260000);
  assert.equal(260000 - 256930, 3070);
  assert.equal(state.accounts.length, 5);
  assert.ok(state.accounts.every(a => a.balanceCents === null));
  assert.equal(state.transactions.length, 0);
});
test('preserves ten-cent transactions and avoids floating point accumulation', () => {
  const state = initialState();
  assert.equal(parseCents('0.10'), 10);
  assert.equal(parseCents('1300'), 130000);
  const first = validateTransaction(draft({ amountCents: parseCents('0.10') }), state);
  const second = validateTransaction(draft({ id: 'transaction-2', amountCents: parseCents('0.20') }), state);
  assert.equal(summarize([first, second]).expenses, 30);
  assert.equal(budgetSpent(state.budgets.find(b => b.label === 'Grocery')!, [first, second]), 30);
  for (const invalid of ['0.001', '-1', '1e3', 'NaN', '1,300', 'Infinity']) assert.throws(() => parseCents(invalid));
});
test('transfers affect both account flows without inflating income or expenses', () => {
  const state = initialState();
  const transfer = validateTransaction(draft({ type: 'Transfer', amountCents: 10000, toAccountId: 'chase-savings' }), state);
  assert.deepEqual(summarize([transfer]), { income: 0, expenses: 0, net: 0, needs: 0, wants: 0 });
  assert.deepEqual(accountFlows('capital-one-checking', [transfer]), { inflows: 0, outflows: 10000 });
  assert.deepEqual(accountFlows('chase-savings', [transfer]), { inflows: 10000, outflows: 0 });
  state.transactions = [transfer];
  assert.equal(scopedTransactions(state, '2026-10', 'Business').length, 1);
  assert.equal(scopedTransactions(state, '2026-10', 'Personal').length, 1);
  assert.equal(scopedTransactions(state, '2026-10', 'All').length, 1);
  assert.throws(() => validateTransaction(draft({ type: 'Transfer', toAccountId: 'capital-one-checking' }), state));
});
test('keeps classification independent of payment account in personal and business reports', () => {
  const state = initialState();
  state.transactions = [validateTransaction(draft({ accountId: 'chase-savings', scope: 'Personal' }), state), validateTransaction(draft({ id: 'business', scope: 'Business', accountId: 'capital-one-checking', amountCents: 4000 }), state)];
  assert.equal(state.transactions[0].scope, 'Personal');
  assert.equal(summarize(scopedTransactions(state, '2026-10', 'Personal')).expenses, 10);
  assert.equal(summarize(scopedTransactions(state, '2026-10', 'Business')).expenses, 4000);
  assert.equal(scopedTransactions(state, '2026-09', 'All').length, 0);
  assert.equal(monthBudgets(state, '2026-10', 'Business').length, 0);
});
test('monthly budget changes preserve the other months and original plan', () => {
  const state = initialState(); const original = state.budgets.find(b => b.label === 'Grocery')!;
  state.budgets.push({ ...original, month: '2026-10', amountCents: 30000 });
  assert.equal(monthBudgets(state, '2026-10', 'Personal').find(b => b.id === original.id)!.amountCents, 30000);
  assert.equal(monthBudgets(state, '2026-09', 'Personal').find(b => b.id === original.id)!.amountCents, 25000);
  assert.equal(monthBudgets(state, '2026-11', 'Personal').find(b => b.id === original.id)!.amountCents, 25000);
});
test('editing preserves identity and creation timestamp and rejects stale revisions', () => {
  const state = initialState(), before = validateTransaction(draft(), state);
  state.transactions = [before];
  const after = validateTransaction({ ...before, amountCents: 20 }, state, before);
  assert.equal(after.id, before.id); assert.equal(after.createdAt, before.createdAt); assert.equal(after.revision, 2);
  assert.equal(before.amountCents, 10);
  assert.throws(() => validateTransaction({ ...before, revision: 0 }, state, before), /changed/);
  assert.throws(() => validateTransaction(draft(), state), /already exists/);
});
test('rejects missing required fields, invalid money, impossible dates, and unsafe IDs', () => {
  const state = initialState();
  for (const override of [{ amountCents: 0 }, { amountCents: 1.1 }, { date: '2026-02-30' }, { time: '24:00' }, { merchant: '' }, { accountId: 'unknown' }, { classification: '' }, { category: 'unknown' }, { id: '=FORMULA()' }]) assert.throws(() => validateTransaction(draft(override), state));
  const income = validateTransaction(draft({ type: 'Income', category: 'Employment', amountCents: 130000 }), state);
  assert.equal(income.classification, ''); assert.equal(income.subcategory, '');
  assert.equal(summarize([income]).income, 130000);
});
