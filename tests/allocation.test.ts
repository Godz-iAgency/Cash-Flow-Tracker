import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../shared/seed';
import { accountFlows, summarize, validateTransaction } from '../shared/model';
import { transactionFingerprint, validateAction, validateCheckIn } from '../shared/actions';
import { balanceSnapshotIds, cashTotals, checkInHistory, checkInStatus, currentBalance, dailyMovement, fundedExpenses, monthlyReview, settingsFor, validateFunding, validateIncomeSource, validateMonthReview, validateSettings } from '../shared/allocation';
const draft = (id: string, extra: Record<string, unknown> = {}) => ({ id, date: '2026-10-03', time: '12:00', type: 'Expense', amountCents: 5000, merchant: 'Recorded merchant', description: '', accountId: 'capital-one-checking', toAccountId: '', scope: 'Personal', category: 'Food', subcategory: 'Grocery', classification: 'Need', notes: '', ...extra });
test('personal expense can use a business account; income classification and receiving account stay independent', () => {
  const state = initialState();
  const personal = validateTransaction(draft('personal', { accountId: 'chase-savings' }), state), business = validateTransaction(draft('business', { type: 'Income', scope: 'Business', category: 'Business income', amountCents: 130000 }), state);
  state.transactions = [personal, business];
  assert.equal(personal.scope, 'Personal'); assert.equal(personal.accountId, 'chase-savings');
  const report = monthlyReview(state, '2026-10', 'All');
  assert.equal(report.personal.expenses, 5000); assert.equal(report.business.income, 130000); assert.equal(report.incomeAccounts[0].name, 'capital-one-checking');
  assert.deepEqual(accountFlows('chase-savings', state.transactions), { inflows: 0, outflows: 5000 });
  assert.throws(() => validateTransaction(draft('missing', { scope: undefined }), state), /scope/);
});
test('transfers change known snapshots, unknown balances stay unknown, and credit debt is excluded from cash', () => {
  const state = initialState();
  for (const a of state.accounts) { a.balanceCents = a.type === 'Credit card' ? 10000 : 100000; a.balanceIncludedTransactionIds = '[]'; a.balanceAsOf = '2026-10-01T00:00'; a.balanceUpdatedAt = '2026-10-01T00:00:00Z'; }
  const transfer = validateTransaction(draft('transfer', { type: 'Transfer', amountCents: 30000, toAccountId: 'chase-savings' }), state);
  const cardCharge = validateTransaction(draft('card-charge', { accountId: 'capital-one-savor', amountCents: 5000 }), state);
  const cardPayment = validateTransaction(draft('card-payment', { type: 'Transfer', toAccountId: 'capital-one-savor', amountCents: 2000 }), state);
  state.transactions = [transfer, cardCharge, cardPayment];
  assert.equal(currentBalance(state, state.accounts[0], '2026-10-03T23:59'), 68000); assert.equal(currentBalance(state, state.accounts[3], '2026-10-03T23:59'), 130000); assert.equal(currentBalance(state, state.accounts[2], '2026-10-03T23:59'), 13000);
  assert.equal(cashTotals(state, '2026-10-03T23:59').total.amountCents, 298000); assert.equal(cashTotals(state, '2026-10-03T23:59').personalCredit.amountCents, 13000);
  assert.equal(summarize(state.transactions).income, 0); assert.equal(summarize(state.transactions).expenses, 5000);
  state.accounts[3].balanceCents = null; assert.equal(currentBalance(state, state.accounts[3], '2026-10-03T23:59'), null); assert.equal(cashTotals(state, '2026-10-03T23:59').total.unknown, 1);
});
test('post-snapshot edits adjust once; resetting snapshots and late historical entries do not double-count', () => {
  const state = initialState(), a = state.accounts[0], now = '2026-10-03T23:59';
  a.balanceCents = 100000; a.balanceAsOf = '2026-10-03T11:00'; a.balanceIncludedTransactionIds = '[]';
  const before = validateTransaction(draft('expense'), state); state.transactions = [before];
  assert.equal(currentBalance(state, a, now), 95000);
  const after = validateTransaction({ ...before, amountCents: 7000 }, state, before); state.transactions = [after]; assert.equal(currentBalance(state, a, now), 93000);
  state.transactions = [validateTransaction({ ...after, accountId: 'chase-savings' }, state, after)]; assert.equal(currentBalance(state, a, now), 100000);
  a.balanceCents = 100000; a.balanceAsOf = '2026-10-03T12:00'; a.balanceIncludedTransactionIds = balanceSnapshotIds(state.transactions, a.balanceAsOf);
  const added = validateTransaction(draft('new-entry', { amountCents: 100 }), state); state.transactions.push(added); assert.equal(currentBalance(state, a, now), 99900);
  a.balanceCents = 99900; a.balanceIncludedTransactionIds = balanceSnapshotIds(state.transactions, a.balanceAsOf); assert.equal(currentBalance(state, a, now), 99900);
  state.transactions.push(validateTransaction(draft('late-yesterday', { date: '2026-10-02', amountCents: 5000 }), state)); assert.equal(currentBalance(state, a, now), 99900);
  state.transactions.push(validateTransaction(draft('future', { date: '2026-10-04', amountCents: 1000 }), state)); assert.equal(currentBalance(state, a, now), 99900); assert.equal(currentBalance(state, a, '2026-10-04T23:59'), 98900);
  const legacy = initialState(), old = legacy.accounts[0]; old.balanceCents = 95000; old.balanceUpdatedAt = '2026-10-02T00:00:00Z';
  const prior = { ...before, date: '2026-09-29', createdAt: '2026-09-29T00:00:00Z' }; legacy.transactions = [{ ...prior, amountCents: 7000, revision: 2 }];
  assert.equal(currentBalance(legacy, old, now), 95000);
});
test('expense funding remains unassigned until explicitly set; monthly overrides and due-day clamping preserve defaults', () => {
  const state = initialState(), budget = state.budgets[0];
  assert.equal(fundedExpenses(state, '2026-10')[0].funding, undefined);
  const recurring = validateFunding({ budgetId: budget.id, month: '*', paymentAccountId: 'chase-savings', amountCents: 121000, dueDay: 31, autopay: true, revision: 0 }, state); state.expenseFunding = [recurring];
  const override = validateFunding({ ...recurring, month: '2026-02', dueDay: 5, revision: 0, amountCents: 120000 }, state); state.expenseFunding.push(override);
  assert.equal(fundedExpenses(state, '2026-02')[0].date, '2026-02-05'); assert.equal(fundedExpenses(state, '2026-04')[0].date, '2026-04-30');
  assert.equal(summarize(state.transactions).expenses, 0); assert.equal(state.budgets[0].amountCents, 121000);
  assert.throws(() => validateFunding({ ...recurring, dueDay: 32 }, state)); assert.throws(() => validateFunding({ ...recurring, revision: 0 }, state), /changed/);
});
test('calendar check-ins include zero-entry days, retain missed days, invalidate on edits, and cross month boundaries', () => {
  const state = initialState();
  for (const date of ['2026-09-30', '2026-10-01', '2026-10-02']) state.dailyCheckIns.push(validateCheckIn({ date, scope: 'All', revision: 0, transactionFingerprint: transactionFingerprint(state, date, 'All') }, state));
  const history = checkInHistory(state, '2026-10', '2026-10-03'); assert.equal(history.completed, 2); assert.equal(history.consecutive, 3); assert.equal(history.missed, 0); assert.equal(history.entries[2].complete, false); assert.equal(history.entries[3].future, true);
  state.transactions = [validateTransaction(draft('late-entry', { date: '2026-10-01' }), state)];
  assert.equal(checkInStatus(state, '2026-10-01').complete, false); assert.equal(checkInHistory(state, '2026-10', '2026-10-03').missed, 1); assert.equal(state.dailyCheckIns.length, 3);
  const day = validateCheckIn({ date: '2026-10-03', scope: 'All', revision: 0, transactionFingerprint: '[]' }, state); assert.equal(day.completed, true); assert.equal(day.transactionsReviewed, 0); assert.equal(day.completedAt, day.confirmedAt);
});
test('month review accounts for classifications, planned spending, small threshold, transfers once, and completion month savings', () => {
  const state = initialState(); state.settings = [validateSettings({ reminderTime: '21:30', smallPurchaseThresholdCents: 600, revision: 0 }, state)];
  state.transactions = [validateTransaction(draft('need', { amountCents: 500 }), state), validateTransaction(draft('want', { amountCents: 600, subcategory: '', classification: 'Want' }), state), validateTransaction(draft('transfer', { type: 'Transfer', amountCents: 30000, toAccountId: 'chase-savings' }), state)];
  const completed = validateAction({ id: 'saving', title: 'Negotiate bill', note: '', category: 'Negotiation', scope: 'Personal', priority: 'Medium', status: 'Completed', relatedExpenseId: '', relatedAccountId: '', reminderDate: '', amountAffectedCents: null, previousCostCents: 9000, newCostCents: 7000, monthlySavingsCents: null }, state);
  state.notesReminders = [{ ...completed, completedAt: '2026-10-03T12:00:00Z' }, { ...completed, id: 'prior-saving', completedAt: '2026-09-03T12:00:00Z' }];
  assert.equal(monthlyReview(state, '2026-10', 'All').monthlySavings, 2000); assert.equal(monthlyReview(state, '2026-10', 'All').annualizedSavings, 24000); assert.equal(monthlyReview(state, '2026-10', 'Business').monthlySavings, 0);
  const report = monthlyReview(state, '2026-10', 'All'); assert.equal(report.planned, 500); assert.equal(report.unplanned, 600); assert.equal(report.smallCount, 1); assert.equal(report.smallTotal, 500); assert.equal(report.transfers, 30000); assert.equal(report.needs, 500); assert.equal(report.wants, 600);
  assert.equal(dailyMovement(state, '2026-10-03').transfers, 30000); assert.equal(settingsFor(state).reminderTime, '21:30'); assert.throws(() => validateSettings({ reminderTime: '25:00', smallPurchaseThresholdCents: 1000, revision: 1 }, state));
  const review = validateMonthReview({ month: '2026-12', scope: 'All', note: 'Review insurance quotes.', revision: 0 }, state); assert.equal(review.nextMonth, '2027-01'); state.monthReviews = [review]; assert.throws(() => validateMonthReview({ ...review, revision: 0 }, state), /changed/);
  const source = validateIncomeSource({ id: 'business-source', name: 'Client invoice', scope: 'Business', category: 'Business income', defaultAccountId: 'capital-one-checking', revision: 0 }, state); assert.equal(source.scope, 'Business'); assert.equal(source.defaultAccountId, 'capital-one-checking');
});
