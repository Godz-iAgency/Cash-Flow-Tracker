import { localDate, monthBudgets, scopedTransactions, type Scope, type State } from './model.js';
export const actionCategories = ['Bill Review', 'Cost Reduction', 'Negotiation', 'Subscription', 'Insurance', 'Banking', 'Business', 'Income Opportunity', 'Financial Leak', 'Research', 'Other'] as const;
export type ActionCategory = typeof actionCategories[number];
export type Priority = 'Low' | 'Medium' | 'High';
export type ActionStatus = 'Open' | 'In Progress' | 'Completed';
export interface FinancialAction {
  id: string; title: string; note: string; category: ActionCategory;
  relatedExpenseId: string; relatedAccountId: string; scope: Scope;
  priority: Priority; status: ActionStatus; reminderDate: string;
  amountAffectedCents: number | null; previousCostCents: number | null; newCostCents: number | null;
  monthlySavingsCents: number | null; annualizedSavingsCents: number | null;
  createdAt: string; updatedAt: string; completedAt: string | null; revision: number;
}
export interface DailyCheckIn { id: string; date: string; scope: Scope | 'All'; confirmedAt: string; transactionFingerprint: string; revision: number; completed?: boolean; completedAt?: string; transactionsReviewed?: number; }
export interface LeakReview { id: string; month: string; dismissedAt: string; }
export function extendState(input: unknown): State {
  if (!input || typeof input !== 'object') throw new Error('Saved data could not be read.');
  const data = input as Record<string, unknown>;
  for (const key of ['accounts', 'categories', 'budgets', 'income', 'transactions', 'audit']) if (!Array.isArray(data[key])) throw new Error('Your saved financial data could not be read. Recover it before continuing.');
  for (const key of ['notesReminders', 'dailyCheckIns', 'leakReviews', 'expenseFunding', 'incomeSources', 'settings', 'monthReviews', 'balanceReconciliations']) if (data[key] !== undefined && !Array.isArray(data[key])) throw new Error('Your saved action data could not be read. Recover it before continuing.');
  // Add only new, empty collections to legacy data; preserve every existing record.
  return { ...data, notesReminders: data.notesReminders ?? [], dailyCheckIns: data.dailyCheckIns ?? [], leakReviews: data.leakReviews ?? [], expenseFunding: data.expenseFunding ?? [], incomeSources: data.incomeSources ?? [], settings: data.settings ?? [], monthReviews: data.monthReviews ?? [], balanceReconciliations: data.balanceReconciliations ?? [] } as unknown as State;
}
export function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}
export function validateAction(input: unknown, state: State, previous?: FinancialAction): FinancialAction {
  if (!input || typeof input !== 'object') throw new Error('Invalid financial action.');
  const v = input as Record<string, unknown>;
  const text = (key: string, max: number) => { if (typeof v[key] !== 'string' || (v[key] as string).length > max) throw new Error(`Invalid ${key}.`); return (v[key] as string).trim(); };
  const id = text('id', 100), title = text('title', 200), note = text('note', 4000);
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id) || !title) throw new Error('Give your financial action a title.');
  if (previous && (id !== previous.id || v.revision !== previous.revision)) throw new Error('This action has changed. Reload before editing.');
  if (!previous && state.notesReminders.some(a => a.id === id)) throw new Error('This action already exists.');
  const category = text('category', 40) as ActionCategory, priority = text('priority', 10) as Priority, status = text('status', 20) as ActionStatus;
  if (!actionCategories.includes(category) || !['Low', 'Medium', 'High'].includes(priority) || !['Open', 'In Progress', 'Completed'].includes(status)) throw new Error('Choose a valid category, priority, and status.');
  const scope = text('scope', 10) as Scope;
  if (!['Personal', 'Business'].includes(scope)) throw new Error('Choose Personal or Business.');
  const relatedExpenseId = text('relatedExpenseId', 150), relatedAccountId = text('relatedAccountId', 100);
  if (relatedAccountId && !state.accounts.some(a => a.id === relatedAccountId)) throw new Error('Choose a valid related account.');
  if (relatedExpenseId) {
    const [kind, expenseId] = relatedExpenseId.split(':');
    const expense = kind === 'budget' ? state.budgets.find(b => b.id === expenseId) : kind === 'transaction' ? state.transactions.find(t => t.id === expenseId && t.type === 'Expense') : undefined;
    if (!expense || expense.scope !== scope) throw new Error('Choose a related expense in the same money space.');
  }
  const reminderDate = text('reminderDate', 10);
  if (reminderDate && !validDate(reminderDate)) throw new Error('Choose a valid reminder date.');
  const cents = (key: string, signed = false) => {
    if (v[key] === null || v[key] === undefined) return null;
    const value = v[key] as number;
    if (!Number.isSafeInteger(value) || Math.abs(value) > 99999999999 || (!signed && value < 0)) throw new Error('Enter valid amounts in whole cents.');
    return value;
  };
  const amountAffectedCents = cents('amountAffectedCents'), previousCostCents = cents('previousCostCents'), newCostCents = cents('newCostCents');
  const monthlySavingsCents = previousCostCents !== null && newCostCents !== null ? previousCostCents - newCostCents : cents('monthlySavingsCents', true);
  const now = new Date().toISOString();
  return { id, title, note, category, priority, status, scope, relatedExpenseId, relatedAccountId, reminderDate, amountAffectedCents, previousCostCents, newCostCents, monthlySavingsCents, annualizedSavingsCents: monthlySavingsCents === null ? null : monthlySavingsCents * 12, createdAt: previous?.createdAt ?? now, updatedAt: now, completedAt: status === 'Completed' ? previous?.status === 'Completed' ? previous.completedAt : now : null, revision: (previous?.revision ?? 0) + 1 };
}
export function scopedActions(state: State, scope: Scope | 'All') {
  return state.notesReminders.filter(a => scope === 'All' || a.scope === scope);
}
export function actionSummary(state: State, scope: Scope | 'All') {
  const actions = scopedActions(state, scope), active = actions.filter(a => a.status !== 'Completed');
  return { open: actions.filter(a => a.status === 'Open').length, inProgress: actions.filter(a => a.status === 'In Progress').length, high: active.filter(a => a.priority === 'High').length, affected: active.reduce((sum, a) => sum + (a.amountAffectedCents ?? 0), 0), monthlySavings: actions.filter(a => a.status === 'Completed').reduce((sum, a) => sum + (a.monthlySavingsCents ?? 0), 0), annualizedSavings: actions.filter(a => a.status === 'Completed').reduce((sum, a) => sum + (a.annualizedSavingsCents ?? 0), 0) };
}
export function dueActions(state: State, scope: Scope | 'All', today = localDate()) {
  const end = new Date(`${today}T12:00:00`); end.setDate(end.getDate() + 7);
  return scopedActions(state, scope).filter(a => a.status !== 'Completed' && (a.priority === 'High' || (a.reminderDate && a.reminderDate <= localDate(end))))
    .sort((a, b) => (a.reminderDate || '9999').localeCompare(b.reminderDate || '9999') || Number(b.priority === 'High') - Number(a.priority === 'High'));
}
export function transactionFingerprint(state: State, date: string, scope: Scope | 'All') {
  return JSON.stringify(scopedTransactions(state, date.slice(0, 7), scope).filter(t => t.date === date).map(t => [t.id, t.revision]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}
export function validateCheckIn(input: unknown, state: State): DailyCheckIn {
  if (!input || typeof input !== 'object') throw new Error('Invalid check-in.');
  const v = input as Record<string, unknown>, date = String(v.date ?? ''), scope = v.scope as Scope | 'All';
  if (!validDate(date) || !['Personal', 'Business', 'All'].includes(scope)) throw new Error('Choose a valid date and money space.');
  const id = `${date}-${scope}`, previous = state.dailyCheckIns.find(c => c.id === id);
  if (v.revision !== (previous?.revision ?? 0)) throw new Error('This check-in has changed. Review today again.');
  const fingerprint = transactionFingerprint(state, date, scope);
  if (v.transactionFingerprint !== fingerprint) throw new Error('Today’s entries have changed. Review them before confirming.');
  if (fingerprint.length > 45000) throw new Error('There are too many entries for one check-in.');
  const now = new Date().toISOString();
  return { id, date, scope, transactionFingerprint: fingerprint, confirmedAt: now, completedAt: now, completed: true, transactionsReviewed: JSON.parse(fingerprint).length, revision: (previous?.revision ?? 0) + 1 };
}
