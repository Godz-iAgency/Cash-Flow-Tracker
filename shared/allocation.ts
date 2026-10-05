import { accountFlows, localDate, monthBudgets, scopedTransactions, summarize, type Account, type Scope, type State, type Transaction } from './model.js';
import { transactionFingerprint, validDate } from './actions.js';
export interface ExpenseFunding { id: string; budgetId: string; month: string; paymentAccountId: string; amountCents: number; dueDay: number | null; autopay: boolean; revision: number; updatedAt: string; }
export interface TrackerSettings { id: 'app'; reminderTime: string; smallPurchaseThresholdCents: number; revision: number; updatedAt: string; }
export interface IncomeSource { id: string; name: string; scope: Scope; category: string; defaultAccountId: string; revision: number; updatedAt: string; }
export interface MonthReview { id: string; month: string; scope: Scope | 'All'; note: string; nextMonth: string; createdAt: string; updatedAt: string; revision: number; }
export const settingsFor = (state: State): TrackerSettings => state.settings.find(s => s.id === 'app') ?? { id: 'app', reminderTime: '18:00', smallPurchaseThresholdCents: 1000, revision: 0, updatedAt: '' };
export const accountRoles: Record<string, string> = { 'capital-one-checking': 'Personal Operating Account', 'capital-one-savings': 'Personal Savings / Reserve', 'capital-one-savor': 'Personal Credit Card', 'chase-savings': 'Business Operating / Savings Account', 'chase-unlimited': 'Business Credit Card' };
export function shiftDate(date: string, days: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return localDate(d); }
export function nextMonth(month: string) { const d = new Date(`${month}-15T12:00:00`); d.setMonth(d.getMonth() + 1); return localDate(d).slice(0, 7); }
export function fundingFor(state: State, budgetId: string, month: string) { return state.expenseFunding.find(f => f.budgetId === budgetId && f.month === month) ?? state.expenseFunding.find(f => f.budgetId === budgetId && f.month === '*'); }
export function fundedExpenses(state: State, month: string, scope: Scope | 'All' = 'All') {
  return monthBudgets(state, month, scope).map(b => { const f = fundingFor(state, b.id, month); const day = f?.dueDay == null ? null : Math.min(f.dueDay, new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()); return { budget: b, funding: f, amountCents: f?.amountCents ?? b.amountCents, date: day === null ? '' : `${month}-${String(day).padStart(2, '0')}` }; });
}
export function localMinute(date = new Date()) { return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
export function balanceSnapshotIds(transactions: Transaction[], asOf: string) {
  return JSON.stringify(transactions.filter(t => `${t.date}T${t.time}` === asOf).map(t => t.id).sort());
}
export function validSnapshot(asOf: unknown): asOf is string {
  return typeof asOf === 'string' && validDate(asOf.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(asOf);
}
// A bank snapshot already includes older movements, even when those are logged later.
// Recorded entries in its minute are also included; new entries in that minute are movements.
export function balanceBreakdown(state: State, account: Account, now = localMinute()) {
  const asOf = account.balanceAsOf || (account.balanceUpdatedAt ? localMinute(new Date(account.balanceUpdatedAt)) : '');
  const included: string[] = account.balanceIncludedTransactionIds ? JSON.parse(account.balanceIncludedTransactionIds) : state.transactions.filter(t => t.createdAt <= (account.balanceUpdatedAt ?? '')).map(t => t.id);
  const known = new Set(included);
  const eligible = state.transactions.filter(t => { const at = `${t.date}T${t.time}`; return at <= now && (at > asOf || (at === asOf && !known.has(t.id))); });
  const flows = accountFlows(account.id, eligible), change = flows.inflows - flows.outflows;
  const comparable = account.balanceCents !== null && now >= asOf;
  return { openingCents: account.balanceCents, openingAsOf: asOf, inflows: flows.inflows, outflows: flows.outflows, transactions: eligible.filter(t => t.accountId === account.id || t.toAccountId === account.id), calculatedCents: comparable ? account.balanceCents! + (account.type === 'Credit card' ? -change : change) : null };
}
export function currentBalance(state: State, account: Account, now = localMinute()): number | null {
  return balanceBreakdown(state, account, now).calculatedCents;
}
export function cashTotals(state: State, now = localMinute()) {
  const sum = (scope: Scope | 'All', credit: boolean) => { const accounts = state.accounts.filter(a => (scope === 'All' || a.scope === scope) && (a.type === 'Credit card') === credit); const values = accounts.map(a => currentBalance(state, a, now)); return { amountCents: values.reduce<number>((n, v) => n + (v ?? 0), 0), unknown: values.filter(v => v === null).length }; };
  return { total: sum('All', false), personal: sum('Personal', false), business: sum('Business', false), personalCredit: sum('Personal', true), businessCredit: sum('Business', true) };
}
export function checkInStatus(state: State, date: string, scope: Scope | 'All' = 'All') {
  const record = state.dailyCheckIns.find(c => c.id === `${date}-${scope}`);
  const complete = Boolean(record && record.completed !== false && record.transactionFingerprint === transactionFingerprint(state, date, scope));
  return { record, complete, changed: Boolean(record && !complete) };
}
export function checkInHistory(state: State, month: string, today = localDate()) {
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const entries = Array.from({ length: days }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; return { date, ...checkInStatus(state, date), future: date > today }; });
  const completed = entries.filter(e => !e.future && e.complete).length, missed = entries.filter(e => e.date < today && !e.complete).length;
  let date = checkInStatus(state, today).complete ? today : shiftDate(today, -1), consecutive = 0;
  // History is finite: stop at the first unconfirmed calendar date.
  while (checkInStatus(state, date).complete) { consecutive++; date = shiftDate(date, -1); }
  return { entries, completed, missed, consecutive };
}
export function dailyMovement(state: State, date: string) { const transactions = state.transactions.filter(t => t.date === date); return { ...summarize(transactions), transfers: transactions.filter(t => t.type === 'Transfer').reduce((n, t) => n + t.amountCents, 0), count: transactions.length }; }
export function monthlyReview(state: State, month: string, scope: Scope | 'All') {
  const rows = scopedTransactions(state, month, scope), expenses = rows.filter(t => t.type === 'Expense'), plans = monthBudgets(state, month, scope);
  const planned = expenses.filter(t => plans.some(b => b.scope === t.scope && b.category === t.category && b.label === t.subcategory));
  const small = expenses.filter(t => t.amountCents < settingsFor(state).smallPurchaseThresholdCents);
  const group = (items: Transaction[], key: 'merchant' | 'category' | 'accountId') => Object.values(items.reduce<Record<string, { name: string; amountCents: number; count: number }>>((acc, t) => { const name = t[key].trim(), id = name.toLowerCase().replace(/\s+/g, ' '); const v = acc[id] ?? { name: name || 'Unspecified', amountCents: 0, count: 0 }; acc[id] = { ...v, amountCents: v.amountCents + t.amountCents, count: v.count + 1 }; return acc; }, {}));
  const income = rows.filter(t => t.type === 'Income');
  const actions = state.notesReminders.filter(a => a.status === 'Completed' && a.completedAt && localDate(new Date(a.completedAt)).startsWith(month) && (scope === 'All' || a.scope === scope));
  return { ...summarize(rows), personal: summarize(rows.filter(t => t.scope === 'Personal')), business: summarize(rows.filter(t => t.scope === 'Business')), planned: summarize(planned).expenses, unplanned: summarize(expenses).expenses - summarize(planned).expenses, smallTotal: summarize(small).expenses, smallCount: small.length, transfers: rows.filter(t => t.type === 'Transfer').reduce((n, t) => n + t.amountCents, 0), categories: group(expenses, 'category').sort((a, b) => b.amountCents - a.amountCents), merchants: group(expenses, 'merchant').sort((a, b) => b.count - a.count), incomeSources: group(income, 'merchant'), incomeAccounts: group(income, 'accountId'), monthlySavings: actions.reduce((n, a) => n + (a.monthlySavingsCents ?? 0), 0), annualizedSavings: actions.reduce((n, a) => n + (a.annualizedSavingsCents ?? 0), 0) };
}
const monthOK = (s: unknown) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
function object(input: unknown) { if (!input || typeof input !== 'object') throw new Error('Invalid record.'); return input as Record<string, unknown>; }
function text(v: Record<string, unknown>, key: string, max = 200) { if (typeof v[key] !== 'string' || (v[key] as string).length > max) throw new Error(`Invalid ${key}.`); return (v[key] as string).trim(); }
function revision(v: Record<string, unknown>, previous?: { revision: number }) { if (v.revision !== (previous?.revision ?? 0)) throw new Error('This record changed. Refresh before saving.'); return (previous?.revision ?? 0) + 1; }
function cents(value: unknown, positive = false) { if (!Number.isSafeInteger(value) || (value as number) < (positive ? 1 : 0) || (value as number) > 99999999999) throw new Error('Enter a valid amount in cents.'); return value as number; }
export function validateFunding(input: unknown, state: State): ExpenseFunding {
  const v = object(input), budgetId = text(v, 'budgetId', 100), month = text(v, 'month', 7);
  if (!state.budgets.some(b => b.id === budgetId) || (month !== '*' && !monthOK(month))) throw new Error('Choose a valid planned expense and month.');
  const id = `funding-${budgetId}-${month === '*' ? 'default' : month}`, before = state.expenseFunding.find(f => f.id === id), paymentAccountId = text(v, 'paymentAccountId', 100);
  if (paymentAccountId && !state.accounts.some(a => a.id === paymentAccountId)) throw new Error('Choose a payment account.');
  if (v.dueDay !== null && (!Number.isInteger(v.dueDay) || Number(v.dueDay) < 1 || Number(v.dueDay) > 31)) throw new Error('Choose a due day between 1 and 31.');
  if (typeof v.autopay !== 'boolean') throw new Error('Choose an autopay setting.');
  return { id, budgetId, month, paymentAccountId, amountCents: cents(v.amountCents), dueDay: v.dueDay as number | null, autopay: v.autopay, revision: revision(v, before), updatedAt: new Date().toISOString() };
}
export function validateSettings(input: unknown, state: State): TrackerSettings {
  const v = object(input), reminderTime = text(v, 'reminderTime', 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) throw new Error('Choose a valid reminder time.');
  return { id: 'app', reminderTime, smallPurchaseThresholdCents: cents(v.smallPurchaseThresholdCents, true), revision: revision(v, state.settings.find(s => s.id === 'app')), updatedAt: new Date().toISOString() };
}
export function validateIncomeSource(input: unknown, state: State): IncomeSource {
  const v = object(input), id = text(v, 'id', 100), name = text(v, 'name'), scope = text(v, 'scope', 10) as Scope, category = text(v, 'category', 100), defaultAccountId = text(v, 'defaultAccountId', 100);
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id) || !name || !['Personal', 'Business'].includes(scope) || !state.categories.some(c => c.name === category) || (defaultAccountId && !state.accounts.some(a => a.id === defaultAccountId))) throw new Error('Choose a source name, classification, category, and valid destination.');
  return { id, name, scope, category, defaultAccountId, revision: revision(v, state.incomeSources.find(s => s.id === id)), updatedAt: new Date().toISOString() };
}
export function validateMonthReview(input: unknown, state: State): MonthReview {
  const v = object(input), month = text(v, 'month', 7), scope = text(v, 'scope', 10) as Scope | 'All', note = text(v, 'note', 6000);
  if (!monthOK(month) || !['Personal', 'Business', 'All'].includes(scope)) throw new Error('Choose a valid review month and classification.');
  const id = `${month}-${scope}`, before = state.monthReviews.find(r => r.id === id), now = new Date().toISOString();
  return { id, month, scope, note, nextMonth: nextMonth(month), createdAt: before?.createdAt ?? now, updatedAt: now, revision: revision(v, before) };
}
