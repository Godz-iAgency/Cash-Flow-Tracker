import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../shared/seed';
import { budgetSpent, monthBudgets, monthIncome, summarize, validateTransaction } from '../shared/model';
import { accountChecked, balanceSummary, bankCheck, bankObservationNow, inputCents, periodEntries, quickEntry, removeEntry, validateAccountChange, validateBudgetChange, validateIncomeChange } from '../shared/simple';
import { reconciliationFingerprint } from '../shared/reconciliation';
import { currentBalance, fundedExpenses, fundingFor, validateFunding } from '../shared/allocation';
import { validateBackup } from '../shared/backup';

test('amount and quick entry accept cents and dollars without guessing a save', () => {
  assert.deepEqual(['5', '.05', '5.5', '$5'].map(inputCents), [500, 5, 550, 500]);
  assert.throws(() => inputCents('1.234'));
  const budgets = initialState().budgets;
  assert.equal(quickEntry('5 grocery heb', budgets).budget?.label, 'Grocery');
  assert.equal(quickEntry('5 grocery heb', budgets).merchant, 'heb');
  assert.equal(quickEntry('$37.74 gas', budgets).amountCents, 3774);
  assert.equal(quickEntry('.05 other', budgets).amountCents, 5);
  assert.equal(quickEntry('.05 other', budgets).budget, undefined);
});
test('budget versions change only the intended months, hide without erasing, and retain renamed spending', () => {
  const state = initialState(), original = state.budgets.find(b => b.label === 'Grocery')!;
  const change = (amount: number, startMonth: string, applies: string, revision: number, extra = {}) => validateBudgetChange({ ...original, amountCents: amount, startMonth, applies, revision, dueDay: null, paymentAccountId: '', classification: 'Need', ...extra }, state);
  state.budgets.push(change(30000, '2026-10', 'future', 0));
  assert.equal(monthBudgets(state, '2026-09', 'Personal').find(b => b.id === original.id)?.amountCents, 25000);
  assert.equal(monthBudgets(state, '2026-12', 'Personal').find(b => b.id === original.id)?.amountCents, 30000);
  state.budgets.push(change(35000, '2026-11', 'once', 1));
  assert.equal(monthBudgets(state, '2026-11', 'Personal').find(b => b.id === original.id)?.amountCents, 35000);
  assert.equal(monthBudgets(state, '2026-12', 'Personal').find(b => b.id === original.id)?.amountCents, 30000);
  const renamed = change(31000, '2026-12', 'future', 2, { label: 'Groceries' }); state.budgets.push(renamed);
  const entry = validateTransaction({ id: 'spend', type: 'Expense', amountCents: 100, date: '2026-12-02', time: '12:00', accountId: state.accounts[0].id, category: 'Food', subcategory: 'Grocery', merchant: 'Store', description: '', notes: '', classification: 'Need', scope: 'Personal' }, state);
  assert.equal(budgetSpent(renamed, [entry]), 100);
  state.budgets.push(change(31000, '2027-01', 'future', 3, { hidden: true }));
  assert.ok(monthBudgets(state, '2026-12', 'Personal').some(b => b.id === original.id));
  assert.ok(!monthBudgets(state, '2027-01', 'Personal').some(b => b.id === original.id));
  assert.throws(() => change(100, '2027-01', 'future', 0), /changed/);
  assert.doesNotThrow(() => validateBackup(state));
});
test('expected income can change forward while earlier months stay intact', () => {
  const state = initialState(); state.income.push(validateIncomeChange({ id: 'planned-income', scope: 'Personal', amountCents: 300000, startMonth: '2026-10', applies: 'future', revision: 0 }, state));
  assert.equal(monthIncome(state, '2026-09', 'Personal')[0].amountCents, 260000);
  assert.equal(monthIncome(state, '2026-11', 'Personal')[0].amountCents, 300000);
});
test('bank check matches, corrects, completes each scope, and requires another check after money moves', () => {
  let state = initialState(); const now = '2026-10-05T12:00';
  state.accounts = state.accounts.map(a => ({ ...a, balanceCents: 10000, balanceAsOf: '2026-10-01T00:00', balanceIncludedTransactionIds: '[]' }));
  for (const a of state.accounts) {
    const result = bankCheck({ id: `check-${a.id}`, accountId: a.id, actualBalanceCents: 10000, ledgerFingerprint: reconciliationFingerprint(state, a, now) }, state, now);
    state = { ...state, balanceReconciliations: [...state.balanceReconciliations, ...result.balanceReconciliations], dailyCheckIns: [...state.dailyCheckIns.filter(c => !result.dailyCheckIns.some(n => n.id === c.id)), ...result.dailyCheckIns] };
  }
  assert.equal(state.dailyCheckIns.length, 3); assert.ok(state.accounts.every(a => accountChecked(state, a, now)));
  const account = state.accounts[0];
  const input = { id: 'correction', accountId: account.id, actualBalanceCents: 9500, ledgerFingerprint: reconciliationFingerprint(state, account, now) };
  assert.throws(() => bankCheck(input, state, now), /balances differ/);
  const fix = bankCheck({ ...input, fix: true }, state, now);
  assert.equal(fix.accounts[0].balanceCents, 9500); assert.equal(fix.balanceReconciliations[0].differenceCents, -500); assert.equal(fix.balanceReconciliations[1].differenceCents, 0);
  state.accounts[0] = fix.accounts[0]; state.balanceReconciliations.push(...fix.balanceReconciliations);
  state.transactions.push(validateTransaction({ id: 'new-move', type: 'Transfer', date: '2026-10-05', time: '12:01', amountCents: 500, accountId: account.id, toAccountId: state.accounts[2].id, scope: 'Personal', merchant: 'Pay card', description: '', notes: '' }, state));
  assert.equal(currentBalance(state, state.accounts[0], '2026-10-05T12:02'), 9000);
  assert.equal(summarize(state.transactions).expenses, 0); assert.equal(summarize(state.transactions).income, 0);
  assert.equal(accountChecked(state, state.accounts[0], '2026-10-05T12:02'), false);
  assert.throws(() => bankCheck({ ...input, id: 'stale', fix: true }, state, '2026-10-05T12:02'), /changed/);
});
test('scope totals show known cash without losing missing balances; accounts hide safely', () => {
  const state = initialState(); state.accounts[0].balanceCents = 1200; state.accounts[3].balanceCents = 900;
  state.accounts[2].balanceCents = -500; state.accounts[4].balanceCents = 2000;
  assert.equal(balanceSummary(state, 'All').cards, 2000);
  assert.equal(balanceSummary(state, 'Personal').cash, 1200); assert.equal(balanceSummary(state, 'Business').cash, 900); assert.equal(balanceSummary(state, 'All').cash, 2100); assert.equal(balanceSummary(state, 'All').missing.length, 1);
  assert.throws(() => validateAccountChange({ ...state.accounts[0], revision: 0, hidden: true }, state), /settle/);
  state.accounts[1] = validateAccountChange({ ...state.accounts[1], revision: 0, hidden: true }, state);
  assert.equal(balanceSummary(state, 'All').missing.length, 0);
});
test('period drilldowns include cross-month weeks and removals preserve the old entry', () => {
  const state = initialState();
  for (const date of ['2026-09-30', '2026-10-01', '2026-10-02']) state.transactions.push(validateTransaction({ id: `entry-${date}`, type: 'Expense', amountCents: 1, date, time: '12:00', accountId: state.accounts[0].id, category: 'Food', subcategory: 'Grocery', merchant: 'Store', description: '', notes: '', classification: 'Need', scope: 'Personal' }, state));
  assert.equal(periodEntries(state, 'Personal', 'week', '2026-10-01').length, 2);
  assert.equal(periodEntries(state, 'Personal', 'month', '2026-10-01').length, 1);
  const removed = removeEntry(state, state.transactions[0].id, 1); assert.equal(removed.voided, true); assert.equal(state.transactions[0].voided, undefined); assert.equal(removed.revision, 2);
});

test('backup rejects invalid plan metadata before importing it', () => {
  for (const change of [{ aliases: '{}' }, { aliases: '[[null,"Rent"]]' }, { dueDay: 32 }, { hidden: 'false' }, { revision: -1 }]) {
    const state = initialState(); Object.assign(state.budgets[0], change); assert.throws(() => validateBackup(state));
  }
});

test('budget payment details override older defaults and can be cleared without losing history', () => {
  const state = initialState(), original = state.budgets[0];
  state.expenseFunding.push({id:'old-funding', budgetId:original.id, month:'*', amountCents:original.amountCents, dueDay:3, paymentAccountId:state.accounts[0].id, autopay:true, revision:1, updatedAt:'2026-09-01T00:00:00Z'});
  state.budgets.push(validateBudgetChange({...original, startMonth:'2026-10', applies:'future', revision:0, dueDay:null, paymentAccountId:'', amountCents:100000, classification:'Need'},state));
  const row = fundedExpenses(state,'2026-10','Personal').find(r=>r.budget.id===original.id)!;
  assert.equal(row.date,''); assert.equal(row.funding!.paymentAccountId,''); assert.equal(row.amountCents,100000); assert.equal(row.funding!.autopay,true);
  assert.equal(fundedExpenses(state,'2026-09','Personal').find(r=>r.budget.id===original.id)!.funding!.dueDay,3);
  state.expenseFunding.push(validateFunding({budgetId:original.id, month:'from:2026-10', paymentAccountId:'', amountCents:100000, dueDay:null, autopay:false, revision:0},state));
  assert.equal(fundingFor(state,original.id,'2026-09')!.autopay,true);
  assert.equal(fundingFor(state,original.id,'2026-11')!.autopay,false);
});

test('bank observations use the device day across server and device time zones', () => {
  const timestamp = Date.parse('2026-10-06T02:30:00Z');
  assert.equal(bankObservationNow(300, timestamp), '2026-10-05T21:30');
  assert.equal(bankObservationNow(-600, timestamp), '2026-10-06T12:30');
  assert.throws(()=>bankObservationNow(2000, timestamp));
});
