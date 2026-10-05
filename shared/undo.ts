import { validateTransaction, type State, type Transaction } from './model.js';

// An undo is another audited revision. The stored entry is retained even when
// its new-entry save is cancelled; active state omits that cancelled revision.
export function undoEntry(state: State, id: string, revision: number, now = Date.now()) {
  const current = state.transactions.find(transaction => transaction.id === id);
  if (!current || current.revision !== revision) throw new Error('This entry changed. Refresh before editing it.');
  const saved = [...state.audit].reverse().find(audit => audit.entityId === id && (audit.entity === 'transaction' || audit.entity === 'transaction undo'));
  if (!saved || saved.entity !== 'transaction' || (saved.after as Transaction | null)?.revision !== revision) throw new Error('This save can no longer be undone. Open the entry to edit it.');
  const elapsed = now - Date.parse(saved.at);
  // The control lasts five seconds; this short server grace allows transport latency.
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 15000) throw new Error('Undo has expired. Open the entry to edit it.');
  if (state.accounts.some(account => [current.accountId, current.toAccountId].includes(account.id) && account.balanceUpdatedAt && Date.parse(account.balanceUpdatedAt) > Date.parse(saved.at))) throw new Error('A bank balance changed after this save. Open the entry to review it.');
  const previous = saved.before as Transaction | null;
  const restored = previous ? validateTransaction({ ...previous, revision }, state, current) : null;
  const stored: Transaction = restored ?? { ...current, voided: true, revision: revision + 1, updatedAt: new Date(now).toISOString() };
  return { current, restored, stored };
}
