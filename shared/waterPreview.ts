import { initialState } from './seed';
import { localDate, validateTransaction } from './model';
import { shiftDate } from './allocation';

// Synthetic review records. Preview mode never reads or writes cloud storage.
export function waterPreviewState() {
  const state = initialState(), today = localDate(), asOf = `${shiftDate(today, -1)}T00:00`;
  const balances: Record<string, number> = { 'capital-one-checking': 184562, 'capital-one-savings': 125000, 'chase-savings': 72000, 'capital-one-savor': 24000, 'chase-unlimited': 58205 };
  state.accounts = state.accounts.map(account => ({ ...account, balanceCents: balances[account.id], balanceAsOf: asOf, balanceUpdatedAt: new Date(asOf).toISOString(), balanceIncludedTransactionIds: '[]' }));
  const sample = [
    { id: 'preview-pay', type: 'Income' as const, amountCents: 260000, category: 'Employment', subcategory: '', merchant: 'Payday', accountId: 'capital-one-checking', classification: '' as const },
    { id: 'preview-groceries', type: 'Expense' as const, amountCents: 7325, category: 'Food', subcategory: 'Grocery', merchant: 'Groceries', accountId: 'capital-one-checking', classification: 'Need' as const },
    { id: 'preview-coffee', type: 'Expense' as const, amountCents: 505, category: 'Food', subcategory: 'Grocery', merchant: 'Coffee with a friend', accountId: 'capital-one-checking', classification: 'Want' as const },
  ];
  state.transactions = sample.map((transaction, index) => validateTransaction({ ...transaction, date: today, time: `09:0${index}`, toAccountId: '', scope: 'Personal', description: '', notes: '' }, state));
  return state;
}
