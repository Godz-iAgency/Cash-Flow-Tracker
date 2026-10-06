import { friendlyError } from './words';
import { useState, type FormEvent } from 'react';
import { balanceBreakdown, localMinute } from '../shared/allocation';
import { accountReconciliations, reconciliationFingerprint, reconciliationStatus, type BalanceReconciliation } from '../shared/reconciliation';
import { money, parseCents, type Account, type State } from '../shared/model';
import { Modal } from './components';
const statusLabel = (state: State, record: BalanceReconciliation) => { const status = reconciliationStatus(state, record); return status.startsWith('Ledger changed') ? 'Entries changed · Check again' : record.calculatedBalanceCents === null ? 'Add a starting balance' : record.differenceCents === 0 ? 'Matches' : `Off by ${money(Math.abs(record.differenceCents!))}`; };
const amount = (value: number | null) => value === null ? 'Add balance' : money(value);
const atLabel = (value: string) => value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
type Equation = { openingCents: number | null; openingAsOf: string; inflows: number; outflows: number; calculatedCents: number | null };
function BalanceEquation({ account, values }: { account: Account; values: Equation }) {
  const credit = account.type === 'Credit card';
  return <div className="balance-equation"><p className="panel-note">{credit ? 'Starting amount owed + charges / money out − payments / money in = Amount owed in this app' : 'Starting balance + money in − money out = Balance in this app'}</p><dl><div><dt>{credit ? 'Starting amount owed' : 'Starting balance'}</dt><dd>{amount(values.openingCents)}</dd></div><div><dt>{credit ? '+ Charges / money out' : '+ Money in'}</dt><dd>{money(credit ? values.outflows : values.inflows)}</dd></div><div><dt>{credit ? '− Payments / money in' : '− Money out'}</dt><dd>{money(credit ? values.inflows : values.outflows)}</dd></div><div className="calculated-row"><dt>{credit ? 'Amount owed in this app' : 'Balance in this app'}</dt><dd>{amount(values.calculatedCents)}</dd></div></dl><p className="panel-note">Starting balance saved: {atLabel(values.openingAsOf)}. Includes entries for this account since then.</p></div>;
}
function SavedComparison({ state, account, record }: { state: State; account: Account; record: BalanceReconciliation }) {
  const status = reconciliationStatus(state, record);
  return <div className="saved-comparison"><p className={`reconciliation-status ${status === 'Balances match' ? 'matched' : 'review-needed'}`}>{statusLabel(state, record)}</p><p className="panel-note">Observed {atLabel(record.asOf)}</p><dl><div><dt>App balance at this check</dt><dd>{amount(record.calculatedBalanceCents)}</dd></div><div><dt>{record.accountType === 'Credit card' ? 'Actual amount owed' : 'Actual bank balance'}</dt><dd>{money(record.actualBalanceCents)}</dd></div><div><dt>Difference</dt><dd>{amount(record.differenceCents)}</dd></div></dl>{record.note && <p className="comparison-note">{record.note}</p>}{status.startsWith('Ledger changed') && <p className="panel-note">The earlier check stays as it was. Check again with your latest entries.</p>}</div>;
}
export function ReconciliationPanel({ state, account, onCompare }: { state: State; account: Account; onCompare: () => void }) {
  const records = accountReconciliations(state, account.id);
  return <section className="reconciliation-panel" aria-label="Balance checks">
    {records.length > 0 && <p className={`reconciliation-status ${reconciliationStatus(state, records[0]) === 'Balances match' ? 'matched' : 'review-needed'}`}>{statusLabel(state, records[0])}</p>}
    <button className="button secondary" onClick={onCompare}>Check a past balance</button>
    <details className="comparison-history"><summary>Balance details{records.length > 0 ? ` (${records.length})` : ''}</summary>
      <BalanceEquation account={account} values={balanceBreakdown(state, account)} />
      {records.map(record => <details key={record.id}><summary>{atLabel(record.asOf)} · {statusLabel(state, record)}</summary><SavedComparison state={state} account={account} record={record} /><BalanceEquation account={{ ...account, type: record.accountType }} values={{ openingCents: record.openingBalanceCents, openingAsOf: record.openingAsOf, inflows: record.moneyInCents, outflows: record.moneyOutCents, calculatedCents: record.calculatedBalanceCents }} /></details>)}
    </details>
  </section>;
}
export function ReconciliationForm({ state, account, onSave, onClose }: { state: State; account: Account; onSave: (v: unknown) => Promise<void>; onClose: () => void }) {
  const [asOf, setAsOf] = useState(localMinute), [actual, setActual] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const values = balanceBreakdown(state, account, asOf);
  let actualCents: number | null = null;
  try { if (actual.trim()) actualCents = (actual.trim().startsWith('-') ? -1 : 1) * parseCents(actual.trim().replace(/^-/, '')); } catch { /* Invalid amounts are explained on submit. */ }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (actualCents === null) throw new Error('Enter a dollar amount with up to two decimal places.');
      await onSave({ id: crypto.randomUUID(), accountId: account.id, asOf, actualBalanceCents: actualCents, note, ledgerFingerprint: reconciliationFingerprint(state, account, asOf) }); onClose();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <Modal title="Check a past balance" subtitle={`${account.name} •••• ${account.lastFour}`} onClose={onClose}><form onSubmit={submit}><label htmlFor="comparison-as-of">Bank balance as of<input id="comparison-as-of" type="datetime-local" required max={localMinute()} min={values.openingAsOf || undefined} value={asOf} onChange={e => setAsOf(e.target.value)} /></label><BalanceEquation account={account} values={values} /><label htmlFor="actual-balance">{account.type === 'Credit card' ? 'Actual amount owed ($)' : 'Actual bank balance ($)'}<input data-autofocus id="actual-balance" inputMode="decimal" required placeholder="0.00" value={actual} onChange={e => setActual(e.target.value)} /><span className="field-hint">Use the balance shown by your bank at this time. A negative card balance is a credit.</span></label>{actualCents !== null && values.calculatedCents !== null && <p className={`reconciliation-status ${actualCents === values.calculatedCents ? 'matched' : 'review-needed'}`}>Difference: {money(actualCents - values.calculatedCents)} · {actualCents === values.calculatedCents ? 'Balances match' : 'Check the difference'}</p>}{values.calculatedCents === null && <p className="reconciliation-status review-needed">Add a starting balance before comparing. You can still save the bank balance here.</p>}<label htmlFor="comparison-note">Review note (optional)<textarea id="comparison-note" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label><p className="panel-note">This keeps a record of your check. It does not change any entries or balances.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save comparison'}</button></div></form></Modal>;
}
