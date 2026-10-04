import type { State } from './model';

// Exact amounts and labels from the supplied written specification.
// No source spreadsheet or opening balances were supplied.
export function initialState(): State {
  const plans: [string, string, number][] = [
    ['Housing', 'Rent', 121000], ['Housing', 'Rent Insurance', 1700],
    ['Transportation', 'Car Payment', 35000], ['Transportation', 'Car Insurance', 16000], ['Transportation', 'Gas', 10000],
    ['Utilities', 'Utility', 5000], ['Utilities', 'Phone', 4500], ['Utilities', 'Internet', 7030],
    ['Subscriptions / AI', 'YouTube', 1700], ['Subscriptions / AI', 'LLM', 5000],
    ['Family', 'Hudson Travel', 15000], ['Family', 'Mommy', 10000], ['Food', 'Grocery', 25000],
  ];
  return {
    accounts: [
      { id: 'capital-one-checking', name: 'Capital One Personal Checking', lastFour: '1637', scope: 'Personal', type: 'Checking', balanceCents: null, balanceUpdatedAt: null },
      { id: 'capital-one-savings', name: 'Capital One Personal Savings', lastFour: '1767', scope: 'Personal', type: 'Savings', balanceCents: null, balanceUpdatedAt: null },
      { id: 'capital-one-savor', name: 'Capital One Savor Credit Card', lastFour: '1567', scope: 'Personal', type: 'Credit card', balanceCents: null, balanceUpdatedAt: null },
      { id: 'chase-savings', name: 'Chase Business Savings', lastFour: '0366', scope: 'Business', type: 'Savings', balanceCents: null, balanceUpdatedAt: null },
      { id: 'chase-unlimited', name: 'Chase Business Unlimited Credit Card', lastFour: '9398', scope: 'Business', type: 'Credit card', balanceCents: null, balanceUpdatedAt: null },
    ],
    categories: [...new Set(plans.map(([category]) => category).concat(['Employment', 'Business income', 'Miscellaneous']))].map((name, i) => ({ id: `category-${i + 1}`, name })),
    budgets: plans.map(([category, label, amountCents], i) => ({ id: `budget-${i + 1}`, label, category, amountCents, scope: 'Personal', month: '*' })),
    income: [{ id: 'planned-income', label: 'Budgeted monthly income', amountCents: 260000, scope: 'Personal', month: '*' }],
    transactions: [], audit: [], notesReminders: [], dailyCheckIns: [], leakReviews: [], expenseFunding: [], settings: [], monthReviews: [], incomeSources: [{ id: 'employment', name: 'Employment', scope: 'Personal', category: 'Employment', defaultAccountId: 'capital-one-checking', revision: 1, updatedAt: '' }],
  };
}
