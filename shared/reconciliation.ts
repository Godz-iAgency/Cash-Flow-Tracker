import type { Account, State } from './model';
import { balanceBreakdown, localMinute, validSnapshot } from './allocation';

export interface BalanceReconciliation {
  id: string; accountId: string; accountType: Account['type']; asOf: string; actualBalanceCents: number;
  openingBalanceCents: number | null; openingAsOf: string; moneyInCents: number; moneyOutCents: number;
  calculatedBalanceCents: number | null; differenceCents: number | null;
  ledgerFingerprint: string; note: string; createdAt: string; updatedAt: string; revision: number;
}
// Compare financial inputs, including direct spreadsheet edits that do not increment revision.
// Observations are immutable evidence; later ledger changes require another comparison.
export function reconciliationFingerprint(state: State, account: Account, asOf: string) {
  const b = balanceBreakdown(state, account, asOf);
  return JSON.stringify([account.type, account.balanceCents, b.openingAsOf, account.balanceUpdatedAt, account.balanceIncludedTransactionIds ?? null,
    b.transactions.map(t => [t.id, t.date, t.time, t.type, t.amountCents, t.accountId, t.toAccountId]).sort((a, c) => String(a[0]).localeCompare(String(c[0]))) ]);
}
export function reconciliationStatus(state: State, record: BalanceReconciliation) {
  const account = state.accounts.find(a => a.id === record.accountId);
  if (!account || reconciliationFingerprint(state, account, record.asOf) !== record.ledgerFingerprint) return 'Ledger changed; compare again';
  if (record.calculatedBalanceCents === null) return 'Opening balance needed';
  return record.differenceCents === 0 ? 'Balances match' : 'Discrepancy — review needed';
}
export function accountReconciliations(state: State, accountId: string) {
  return state.balanceReconciliations.filter(r => r.accountId === accountId).sort((a, b) => b.asOf.localeCompare(a.asOf) || b.createdAt.localeCompare(a.createdAt));
}
export function validateReconciliation(input: unknown, state: State, now = localMinute()): BalanceReconciliation {
  if (!input || typeof input !== 'object') throw new Error('Invalid balance comparison.');
  const v = input as Record<string, unknown>;
  const id = String(v.id ?? ''), account = state.accounts.find(a => a.id === v.accountId);
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id) || !account) throw new Error('Choose a valid account.');
  if (state.balanceReconciliations.some(r => r.id === id)) throw new Error('This comparison is already saved. Create a new comparison.');
  if (!validSnapshot(v.asOf) || v.asOf > now) throw new Error('Choose a valid observation date and time, no later than now.');
  const b = balanceBreakdown(state, account, v.asOf);
  if (b.openingAsOf && v.asOf < b.openingAsOf) throw new Error('The observation must be on or after the opening balance snapshot.');
  if (!Number.isSafeInteger(v.actualBalanceCents) || Math.abs(Number(v.actualBalanceCents)) > 99999999999) throw new Error('Enter a valid actual balance in whole cents.');
  if (typeof v.note !== 'string' || v.note.length > 2000) throw new Error('Keep the review note under 2,000 characters.');
  const fingerprint = reconciliationFingerprint(state, account, v.asOf);
  if (fingerprint !== v.ledgerFingerprint) throw new Error('The account or its entries changed. Review the updated calculation before saving.');
  if (fingerprint.length > 45000) throw new Error('There are too many movements for one comparison. Save a reviewed opening snapshot first.');
  const timestamp = new Date().toISOString(), actual = v.actualBalanceCents as number;
  const record: BalanceReconciliation = { id, accountId: account.id, accountType: account.type, asOf: v.asOf, actualBalanceCents: actual, openingBalanceCents: b.openingCents, openingAsOf: b.openingAsOf, moneyInCents: b.inflows, moneyOutCents: b.outflows, calculatedBalanceCents: b.calculatedCents, differenceCents: b.calculatedCents === null ? null : actual - b.calculatedCents, ledgerFingerprint: fingerprint, note: v.note.trim(), createdAt: timestamp, updatedAt: timestamp, revision: 1 };
  // The audit stores the whole record in one cell, including escaped fingerprint text.
  if (JSON.stringify(record).length > 45000) throw new Error('There are too many movements for one comparison. Save a reviewed opening snapshot first.');
  return record;
}
