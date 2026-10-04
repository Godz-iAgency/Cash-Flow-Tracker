import { money, monthBudgets, type Scope, type State, type Transaction } from './model';
import { settingsFor } from './allocation';
export interface FinancialLeak {
  id: string; month: string; scope: Scope; title: string; message: string;
  category: 'Bill Review' | 'Subscription' | 'Financial Leak';
  amountAffectedCents: number; relatedExpenseId: string; relatedAccountId: string;
  transactions: Transaction[];
}
// A compact, non-security evidence key keeps review IDs bounded even for long ledgers.
function evidenceKey(text: string) {
  let hash = 14695981039346656037n;
  for (const character of text) hash = BigInt.asUintN(64, (hash ^ BigInt(character.codePointAt(0)!)) * 1099511628211n);
  return hash.toString(16);
}
const normalized = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
function precedingMonths(month: string) {
  const date = new Date(`${month}-15T12:00:00`);
  return [1, 2, 3].map(offset => { const d = new Date(date); d.setMonth(d.getMonth() - offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
}
// Conservative review signals, based only on recorded expenses. No signal is a finding of error.
export function detectLeaks(state: State, month: string, scope: Scope | 'All'): FinancialLeak[] {
  const months = precedingMonths(month), allowed = new Set([month, ...months]);
  const expenses = state.transactions.filter(t => t.type === 'Expense' && allowed.has(t.date.slice(0, 7)) && (scope === 'All' || t.scope === scope));
  const groups = new Map<string, Transaction[]>();
  for (const t of expenses) {
    if (!t.merchant.trim()) continue;
    const key = JSON.stringify([t.scope, normalized(t.merchant), t.category, normalized(t.subcategory)]);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const results: FinancialLeak[] = [];
  const add = (rule: string, key: string, title: string, message: string, evidence: Transaction[], amount: number, category: FinancialLeak['category'] = 'Bill Review') => {
    const current = evidence.filter(t => t.date.startsWith(month));
    if (!current.length) return;
    // Changes to the evidence produce a new review; an old dismissal cannot hide new charges.
    const version = evidence.map(t => `${t.id}:${t.revision}`).sort().join('|');
    const id = `${month}:${rule}:${evidenceKey(key)}:${evidenceKey(version)}`;
    if (state.leakReviews.some(r => r.id === id)) return;
    const first = current[0];
    results.push({ id, month, scope: first.scope, title, message, category, transactions: evidence, amountAffectedCents: amount, relatedExpenseId: `transaction:${first.id}`, relatedAccountId: first.accountId });
  };
  for (const [key, rows] of groups) {
    const current = rows.filter(t => t.date.startsWith(month));
    if (!current.length) continue;
    const first = current[0], name = first.merchant.trim(), total = current.reduce((n, t) => n + t.amountCents, 0);
    const history = months.map(m => rows.filter(t => t.date.startsWith(m)));
    const recurringCategory = ['Housing', 'Utilities', 'Transportation', 'Subscriptions / AI'].includes(first.category);
    if (recurringCategory && history.every(t => t.length > 0)) {
      const average = Math.round(history.flat().reduce((n, t) => n + t.amountCents, 0) / 3);
      if (total - average >= Math.max(500, Math.ceil(average * .2))) add('bill-increase', key, 'Recurring cost increased', `${name} averaged ${money(average)} per month across the previous 3 months; ${money(total)} is recorded this month. Review the change.`, rows, total - average);
    }
    const amounts = [...new Set(current.map(t => t.amountCents))].sort((a, b) => a - b);
    if (recurringCategory && amounts.length > 1) add('different-amounts', key, 'Different charges for the same service', `${name} has ${current.length} recorded charges this month, ranging from ${money(amounts[0])} to ${money(amounts.at(-1)!)}. Confirm what each charge covers.`, current, total);
    if (first.category === 'Subscriptions / AI') {
      const repeated = amounts.filter(amount => current.filter(t => t.amountCents === amount).length > 1);
      if (repeated.length) add('subscription-repeat', key, 'Repeated subscription charges', `${name} has repeated charges for ${repeated.map(money).join(', ')} this month. They may be expected; review the billing dates and services.`, current, total, 'Subscription');
    }
    const historicalMonths = history.filter(t => t.length).length;
    const planned = monthBudgets(state, month, first.scope).some(b => b.category === first.category && b.label === first.subcategory);
    if (recurringCategory && historicalMonths >= 2 && !planned) add('unplanned-recurring', key, 'Recurring spending outside the plan', `${name} appears this month and in ${historicalMonths} of the previous 3 months without a matching planned expense. Review whether it belongs in your plan.`, rows, total, 'Financial Leak');
  }
  for (const space of ['Personal', 'Business'] as const) {
    if (scope !== 'All' && scope !== space) continue;
    const scoped = expenses.filter(t => t.scope === space), current = scoped.filter(t => t.date.startsWith(month));
    const threshold = settingsFor(state).smallPurchaseThresholdCents;
    const small = current.filter(t => t.classification === 'Want' && t.amountCents < threshold);
    if (small.length >= 5) {
      const total = small.reduce((n, t) => n + t.amountCents, 0);
      add('small-wants', space, 'Repeated small discretionary purchases', `${small.length} want purchases under ${money(threshold)} total ${money(total)} this month. Review the pattern and decide whether to act.`, small, total, 'Financial Leak');
    }
    for (const category of new Set(current.map(t => t.category))) {
      const historical = months.map(m => scoped.filter(t => t.date.startsWith(m) && t.category === category));
      if (!historical.every(rows => rows.length)) continue;
      const rows = current.filter(t => t.category === category), total = rows.reduce((n, t) => n + t.amountCents, 0);
      const average = Math.round(historical.flat().reduce((n, t) => n + t.amountCents, 0) / 3);
      if (total - average >= Math.max(1000, Math.ceil(average * .3))) add('category-increase', `${space}:${category}`, 'Category spending above recent average', `${category} averaged ${money(average)} per month across the previous 3 months; ${money(total)} is recorded this month. Compare the entries before changing your plan.`, [...rows, ...historical.flat()], total - average, 'Financial Leak');
    }
  }
  return results;
}
