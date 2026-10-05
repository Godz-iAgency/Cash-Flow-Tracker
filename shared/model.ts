import type { BalanceReconciliation } from './reconciliation.js';
import type { ExpenseFunding, IncomeSource, MonthReview, TrackerSettings } from './allocation.js';
import type { DailyCheckIn, FinancialAction, LeakReview } from './actions.js';
export type Scope = 'Personal' | 'Business';
export type TransactionType = 'Expense' | 'Income' | 'Transfer';
export type Classification = 'Need' | 'Want' | '';
export interface Account {
  id: string; name: string; lastFour: string; scope: Scope;
  type: 'Checking' | 'Savings' | 'Credit card'; balanceCents: number | null;
  balanceUpdatedAt: string | null; balanceIncludedTransactionIds?: string | null; balanceAsOf?: string | null;
}
export interface Category { id: string; name: string; }
export interface Budget {
  id: string; label: string; category: string; amountCents: number; scope: Scope; month: string;
}
export interface PlannedIncome {
  id: string; label: string; amountCents: number; scope: Scope; month: string;
}
export interface Transaction {
  id: string; date: string; time: string; type: TransactionType; amountCents: number;
  category: string; subcategory: string; merchant: string; description: string;
  accountId: string; toAccountId: string; scope: Scope; classification: Classification;
  notes: string; createdAt: string; updatedAt: string; revision: number;
}
export interface Audit { id: string; entity: string; entityId: string; at: string; before: unknown; after: unknown; }
export interface State {
  accounts: Account[]; categories: Category[]; budgets: Budget[];
  income: PlannedIncome[]; transactions: Transaction[]; audit: Audit[];
  notesReminders: FinancialAction[]; dailyCheckIns: DailyCheckIn[]; leakReviews: LeakReview[]; expenseFunding: ExpenseFunding[]; incomeSources: IncomeSource[]; settings: TrackerSettings[]; monthReviews: MonthReview[]; balanceReconciliations: BalanceReconciliation[];
}
export const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export function parseCents(input: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.trim())) throw new Error('Enter a dollar amount with up to two decimal places.');
  const [whole, fraction = ''] = input.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > 99999999999) throw new Error('This amount is too large.');
  return cents;
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const currentMonth = () => localDate().slice(0, 7);
export function monthBudgets(state: State, month: string, scope: Scope | 'All'): Budget[] {
  const applicable = state.budgets.filter(b => scope === 'All' || b.scope === scope);
  return applicable.filter(b => b.month === month || (b.month === '*' && !applicable.some(o => o.month === month && o.id === b.id)));
}
export function monthIncome(state: State, month: string, scope: Scope | 'All'): PlannedIncome[] {
  const applicable = state.income.filter(i => scope === 'All' || i.scope === scope);
  return applicable.filter(i => i.month === month || (i.month === '*' && !applicable.some(o => o.month === month && o.id === i.id)));
}
export function scopedTransactions(state: State, month: string, scope: Scope | 'All'): Transaction[] {
  return state.transactions.filter(t => t.date.startsWith(month) && (scope === 'All' || (t.type === 'Transfer' ? state.accounts.some(a => (a.id === t.accountId || a.id === t.toAccountId) && a.scope === scope) : t.scope === scope)))
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`) || b.createdAt.localeCompare(a.createdAt));
}
export function summarize(transactions: Transaction[]) {
  const income = transactions.filter(t => t.type === 'Income').reduce((n, t) => n + t.amountCents, 0);
  const expenses = transactions.filter(t => t.type === 'Expense').reduce((n, t) => n + t.amountCents, 0);
  const needs = transactions.filter(t => t.type === 'Expense' && t.classification === 'Need').reduce((n, t) => n + t.amountCents, 0);
  const wants = transactions.filter(t => t.type === 'Expense' && t.classification === 'Want').reduce((n, t) => n + t.amountCents, 0);
  return { income, expenses, net: income - expenses, needs, wants };
}
export function budgetSpent(budget: Budget, transactions: Transaction[]) {
  return transactions.filter(t => t.type === 'Expense' && t.scope === budget.scope && t.category === budget.category && t.subcategory === budget.label).reduce((n, t) => n + t.amountCents, 0);
}
export function accountFlows(accountId: string, transactions: Transaction[]) {
  let inflows = 0, outflows = 0;
  for (const t of transactions) {
    if (t.accountId === accountId) {
      if (t.type === 'Income') inflows += t.amountCents;
      else outflows += t.amountCents;
    }
    if (t.type === 'Transfer' && t.toAccountId === accountId) inflows += t.amountCents;
  }
  return { inflows, outflows };
}
export function validateTransaction(input: unknown, state: State, previous?: Transaction): Transaction {
  if (!input || typeof input !== 'object') throw new Error('Invalid transaction.');
  const v = input as Record<string, unknown>;
  const string = (key: string, max = 500) => {
    if (typeof v[key] !== 'string' || (v[key] as string).length > max) throw new Error(`Invalid ${key}.`);
    return (v[key] as string).trim();
  };
  const type = string('type') as TransactionType;
  if (!['Expense', 'Income', 'Transfer'].includes(type)) throw new Error('Choose a valid transaction type.');
  const amountCents = v.amountCents as number;
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 99999999999) throw new Error('Amount must be greater than zero, in whole cents.');
  const date = string('date', 10), time = string('time', 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Choose a valid date.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid time.');
  const accountId = string('accountId', 100), account = state.accounts.find(a => a.id === accountId);
  if (!account) throw new Error('Choose an account.');
  const toAccountId = type === 'Transfer' ? string('toAccountId', 100) : '';
  if (type === 'Transfer' && (!state.accounts.some(a => a.id === toAccountId) || accountId === toAccountId)) throw new Error('Choose a different destination account.');
  const category = type === 'Transfer' ? 'Transfer' : string('category', 100);
  if (type !== 'Transfer' && !state.categories.some(c => c.name === category)) throw new Error('Choose a category.');
  const classification = type === 'Expense' ? string('classification') as Classification : '';
  if (type === 'Expense' && !['Need', 'Want'].includes(classification)) throw new Error('Choose Need or Want.');
  const scope = string('scope', 10) as Scope;
  if (!['Personal', 'Business'].includes(scope)) throw new Error('Choose Personal or Business independently of the account.');
  const merchant = string('merchant', 200), description = string('description', 500);
  if (!merchant) throw new Error('Enter a merchant, income source, or transfer description.');
  const id = string('id', 100);
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error('Invalid transaction ID.');
  if (previous && (id !== previous.id || v.revision !== previous.revision)) throw new Error('This transaction has changed. Reload before editing.');
  if (!previous && state.transactions.some(t => t.id === id)) throw new Error('Transaction already exists.');
  const now = new Date().toISOString();
  return { id, date, time, type, amountCents, category, subcategory: type === 'Expense' ? string('subcategory', 100) : '', merchant, description, accountId, toAccountId, scope, classification, notes: string('notes', 2000), createdAt: previous?.createdAt ?? now, updatedAt: now, revision: (previous?.revision ?? 0) + 1 };
}
