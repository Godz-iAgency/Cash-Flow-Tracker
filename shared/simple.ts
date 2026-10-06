import { localDate, parseCents, resolvePlans, scopedTransactions, type Account, type Budget, type PlannedIncome, type Scope, type State, type Transaction } from './model.js';
import { balanceSnapshotIds, currentBalance, localMinute } from './allocation.js';
import { reconciliationFingerprint, validateReconciliation } from './reconciliation.js';
import { transactionFingerprint, validateCheckIn } from './actions.js';

export const visibleAccounts = (state: State, scope: Scope | 'All') => state.accounts.filter(a => !a.hidden && (scope === 'All' || a.scope === scope));
export function balanceSummary(state: State, scope: Scope | 'All') {
  const accounts = visibleAccounts(state, scope), missing = accounts.filter(a => currentBalance(state, a) === null);
  return { cash: accounts.filter(a => a.type !== 'Credit card').reduce((n, a) => n + (currentBalance(state, a) ?? 0), 0), cards: accounts.filter(a => a.type === 'Credit card').reduce((n, a) => n + Math.max(0, currentBalance(state, a) ?? 0), 0), missing };
}
export function inputCents(value: string) { return parseCents(value.trim().replace(/^\$/, '').replace(/^\./, '0.')); }
export function quickEntry(text: string, budgets: Budget[]) {
  const match = text.trim().match(/^(\$?(?:\d+(?:\.\d{1,2})?|\.\d{1,2}))(?:\s+(.*))?$/);
  if (!match) throw new Error('Start with an amount, like 5 grocery heb.');
  const words = (match[2] || '').trim(), lower = words.toLowerCase();
  const budget = [...budgets].sort((a, b) => b.label.length - a.label.length).find(b => lower === b.label.toLowerCase() || lower.startsWith(`${b.label.toLowerCase()} `));
  return { amountCents: inputCents(match[1]), budget, merchant: budget ? words.slice(budget.label.length).trim() : lower.startsWith('other') ? words.slice(5).trim() : words };
}
export function periodEntries(state: State, scope: Scope | 'All', period: 'today' | 'week' | 'month', today = localDate()) {
  const date = new Date(`${today}T12:00:00`); date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  const start = period === 'today' ? today : period === 'week' ? localDate(date) : `${today.slice(0, 7)}-01`;
  return scopedTransactions(state, '', scope).filter(t => t.type === 'Expense' && t.date >= start && t.date <= today);
}
function planPeriod(input: Record<string, unknown>) {
  if (typeof input.startMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.startMonth)) throw new Error('Choose a month.');
  if (!['future', 'once'].includes(String(input.applies))) throw new Error('Choose when this change applies.');
  return input.applies === 'once' ? input.startMonth : `from:${input.startMonth}`;
}
function cents(value: unknown) { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 99999999999) throw new Error('Enter a valid amount.'); return Number(value); }
function text(value: unknown, max: number) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Enter a name.'); return value.trim(); }
export function validateBudgetChange(input: unknown, state: State): Budget {
  const v = input as Record<string, unknown>, month = planPeriod(v), id = text(v.id, 100);
  if (!/^[\w-]+$/.test(id)) throw new Error('Invalid item.');
  const versions = state.budgets.filter(b => b.id === id), revision = Math.max(0, ...versions.map(b => b.revision ?? 0));
  if (v.revision !== revision) throw new Error('This budget changed. Reopen it and try again.');
  const before = resolvePlans(versions, String(v.startMonth), 'All')[0];
  const scope = v.scope as Scope;
  if (!['Personal', 'Business'].includes(scope) || (before && scope !== before.scope)) throw new Error('Choose Personal or Business.');
  const label = text(v.label, 100), category = text(v.category, 100);
  if (!state.categories.some(c => c.name === category)) throw new Error('Choose a category.');
  if (v.dueDay !== null && (!Number.isInteger(v.dueDay) || Number(v.dueDay) < 1 || Number(v.dueDay) > 31)) throw new Error('Choose a due day from 1 to 31.');
  const paymentAccountId = String(v.paymentAccountId || '');
  if (paymentAccountId && !state.accounts.some(a => a.id === paymentAccountId && !a.hidden)) throw new Error('Choose a payment account.');
  if (!['Need', 'Want'].includes(String(v.classification))) throw new Error('Choose Need or Want.');
  const aliases: string[][] = before ? JSON.parse(before.aliases || '[]') : [];
  if (before && (before.label !== label || before.category !== category)) aliases.push([before.category, before.label]);
  if (JSON.stringify(aliases).length > 10000) throw new Error('This item has too many previous names.');
  return { id, month, scope, label, category, amountCents: cents(v.amountCents), dueDay: v.dueDay as number | null, paymentAccountId, classification: v.classification as 'Need' | 'Want', hidden: v.hidden === true, aliases: JSON.stringify(aliases), revision: revision + 1 };
}
export function validateIncomeChange(input: unknown, state: State): PlannedIncome {
  const v = input as Record<string, unknown>, month = planPeriod(v), scope = v.scope as Scope;
  if (!['Personal', 'Business'].includes(scope)) throw new Error('Choose Personal or Business.');
  const id = String(v.id), previous = state.income.filter(i => i.id === id), revision = Math.max(0, ...previous.map(i => i.revision ?? 0));
  if (!/^[\w-]{1,100}$/.test(id) || previous.some(i => i.scope !== scope) || v.revision !== revision) throw new Error('This income plan changed. Reopen it.');
  return { id, scope, month, label: 'Expected income', amountCents: cents(v.amountCents), revision: revision + 1 };
}
export function validateAccountChange(input: unknown, state: State): Account {
  const v = input as Record<string, unknown>, before = state.accounts.find(a => a.id === v.id);
  if (!/^[\w-]{1,100}$/.test(String(v.id)) || v.revision !== (before?.revision ?? 0)) throw new Error('This account changed. Reopen it.');
  if (!['Personal', 'Business'].includes(String(v.scope)) || !['Checking', 'Savings', 'Credit card'].includes(String(v.type)) || !/^\d{4}$/.test(String(v.lastFour))) throw new Error('Choose an account type and enter its last four digits.');
  if (before && (before.balanceCents !== null || state.transactions.some(t => t.accountId === before.id || t.toAccountId === before.id)) && (v.type !== before.type || v.scope !== before.scope)) throw new Error('Keep the type and owner of an account with recorded money.');
  if (v.hidden && before && currentBalance(state, before) !== null && currentBalance(state, before) !== 0) throw new Error('Move or settle this account’s balance before hiding it.');
  return { ...(before ?? { balanceCents: null, balanceUpdatedAt: null }), id: String(v.id), name: text(v.name, 100), lastFour: String(v.lastFour), scope: v.scope as Scope, type: v.type as Account['type'], hidden: v.hidden === true, revision: (before?.revision ?? 0) + 1 };
}
export function removeEntry(state: State, id: string, revision: number): Transaction {
  const before = state.transactions.find(t => t.id === id);
  if (!before || before.revision !== revision || before.voided) throw new Error('This entry changed. Reopen it before removing it.');
  return { ...before, voided: true, revision: revision + 1, updatedAt: new Date().toISOString() };
}
export function accountChecked(state: State, account: Account, now = localMinute()) {
  return state.balanceReconciliations.some(r => r.accountId === account.id && r.asOf.slice(0, 10) === now.slice(0, 10) && r.differenceCents === 0 && r.ledgerFingerprint === reconciliationFingerprint(state, account, now));
}
export function bankObservationNow(timezoneOffset: number, timestamp = Date.now()) {
  if (!Number.isInteger(timezoneOffset) || Math.abs(timezoneOffset) > 840) throw new Error('Invalid device time zone.');
  return new Date(timestamp - timezoneOffset * 60000).toISOString().slice(0, 16);
}
export function bankCheck(input: unknown, state: State, now?: string) {
  const v = input as Record<string, unknown>, account = state.accounts.find(a => a.id === v.accountId && !a.hidden);
  if (!account) throw new Error('Choose an account.');
  const observedNow = now ?? (v.timezoneOffset !== undefined ? bankObservationNow(v.timezoneOffset as number) : localMinute());
  const asOf = typeof v.asOf === 'string' ? v.asOf : observedNow;
  const comparison = validateReconciliation({ ...v, asOf, note: v.fix ? 'Bank is right, fix balance' : 'Check my bank' }, state, observedNow);
  let accounts: Account[] = [], records = [comparison];
  if (v.fix === true) {
    const after = { ...account, balanceCents: comparison.actualBalanceCents, balanceAsOf: asOf, balanceUpdatedAt: comparison.updatedAt, balanceIncludedTransactionIds: balanceSnapshotIds(state.transactions, asOf) };
    accounts = [after];
    const next = { ...state, accounts: state.accounts.map(a => a.id === after.id ? after : a) };
    records.push(validateReconciliation({ ...v, id: `${comparison.id}-fixed`, asOf, note: 'Balance corrected', ledgerFingerprint: reconciliationFingerprint(next, after, asOf) }, next, observedNow));
  } else if (comparison.differenceCents !== 0) throw new Error('The balances differ. Add a missing entry or choose Bank is right, fix balance.');
  const next = { ...state, accounts: state.accounts.map(a => accounts.find(b => b.id === a.id) ?? a), balanceReconciliations: [...state.balanceReconciliations, ...records] };
  const checks = (['Personal', 'Business', 'All'] as const).flatMap(scope => {
    const relevant = visibleAccounts(next, scope);
    if (!relevant.length || !relevant.every(a => accountChecked(next, a, asOf))) return [];
    const date = asOf.slice(0, 10), previous = next.dailyCheckIns.find(c => c.date === date && c.scope === scope);
    return [validateCheckIn({ date, scope, revision: previous?.revision ?? 0, transactionFingerprint: transactionFingerprint(next, date, scope) }, next)];
  });
  return { accounts, balanceReconciliations: records, dailyCheckIns: checks };
}
