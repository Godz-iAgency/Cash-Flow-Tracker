import { extendState } from './actions.js';
import { validateTransaction, type State } from './model.js';

export const stateTables: (keyof State)[] = ['accounts', 'categories', 'budgets', 'income', 'transactions', 'audit', 'notesReminders', 'dailyCheckIns', 'leakReviews', 'expenseFunding', 'incomeSources', 'settings', 'monthReviews', 'balanceReconciliations'];

// Import original records, including their timestamps and audit evidence. Never
// run them through save functions, which would create new versions or balances.
export function validateBackup(input: unknown): State {
  const extended = extendState(input);
  const state = Object.fromEntries(stateTables.map(table => [table, extended[table]])) as unknown as State;
  let count = 0;
  for (const table of stateTables) {
    if (!Array.isArray(state[table])) throw new Error(`The backup is missing ${table}.`);
    const ids = new Set<string>();
    for (const record of state[table]) {
      count++;
      if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id || record.id.length > 300) throw new Error(`Invalid record in ${table}.`);
      const key = JSON.stringify([record.id, table === 'budgets' || table === 'income' ? (record as { month: string }).month : '']);
      if (ids.has(key)) throw new Error(`Duplicate record in ${table}.`);
      ids.add(key);
    }
  }
  if (count > 400) throw new Error('This backup has more than 400 records. A reviewed batch migration is required; nothing was imported.');
  const inspect = (value: unknown, key = '') => {
    if (key.endsWith('Cents') && value !== null && !Number.isSafeInteger(value)) throw new Error('The backup contains an invalid amount in cents.');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('The backup contains an invalid number.');
    if (value && typeof value === 'object') for (const [childKey, child] of Object.entries(value)) inspect(child, childKey);
  };
  inspect(state);
  for (const account of state.accounts) {
    if (!['Checking', 'Savings', 'Credit card'].includes(account.type) || !['Personal', 'Business'].includes(account.scope) || typeof account.name !== 'string' || !/^\d{4}$/.test(account.lastFour)) throw new Error('The backup contains an invalid account.');
    if (account.balanceCents !== null && !Number.isSafeInteger(account.balanceCents)) throw new Error('An opening balance is invalid.');
    if (account.balanceIncludedTransactionIds) {
      const included = JSON.parse(account.balanceIncludedTransactionIds);
      if (!Array.isArray(included) || included.some(id => typeof id !== 'string')) throw new Error('The opening balance snapshot is invalid.');
    }
  }
  for (const category of state.categories) if (typeof category.name !== 'string' || !category.name) throw new Error('The backup contains an invalid category.');
  for (const record of [...state.budgets, ...state.income]) {
    if (typeof record.label !== 'string' || !['Personal', 'Business'].includes(record.scope) || !Number.isSafeInteger(record.amountCents) || record.amountCents < 0 || (record.month !== '*' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.month))) throw new Error('The backup contains an invalid monthly plan.');
  }
  for (const transaction of state.transactions) {
    validateTransaction(transaction, state, transaction);
    if (!Number.isSafeInteger(transaction.revision) || transaction.revision < 1 || !Number.isFinite(Date.parse(transaction.createdAt)) || !Number.isFinite(Date.parse(transaction.updatedAt))) throw new Error('A transaction has invalid history metadata.');
  }
  return state;
}
