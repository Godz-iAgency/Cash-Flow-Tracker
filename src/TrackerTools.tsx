import { ArrowUpRight, Download, LogOut, ShieldCheck } from 'lucide-react';
import { money, type State } from '../shared/model';
import { Modal, Empty, monthLabel } from './components';

export function BackupDialog({ local, preview, sheets, sheetsEnabled, exporting, error, onClose, onDownload, onExport, onHistory, onSignOut }: {
  local: boolean; preview: boolean; sheets: boolean; sheetsEnabled: boolean; exporting: boolean; error: string;
  onClose: () => void; onDownload: () => void; onExport: () => void; onHistory: () => void; onSignOut?: () => void;
}) {
  return <Modal title="Backup & devices" onClose={onClose}><div className="backup-content">
    <div className="records-status"><ShieldCheck size={24} /><div><h3>{preview ? 'Preview only' : local ? 'Saved in this browser' : 'Saved privately online'}</h3><p>{preview ? 'These are preview records, not the records saved in your tracker.' : local ? 'Download a copy to keep your records safe.' : 'Sign in with the same Google account on your other devices.'}</p></div></div>
    <button className="button primary backup-download" onClick={onDownload}><Download size={18} />Download backup</button>
    <p className="backup-filename">Look in Downloads for a file starting with {preview ? 'cash-flow-preview' : 'cash-flow-backup'}.</p>
    <details className="plain-disclosure"><summary>What is a backup?</summary><p>A file containing your accounts, entries and plans. Keep it private. To move it to a new tracker, choose this .json file during setup.</p></details>
    {local && !preview && <details className="plain-disclosure"><summary>Use this tracker on other devices</summary><p>Connect online storage first, then bring your backup with you.</p><a className="text-button" href="https://github.com/Godz-iAgency/Cash-Flow-Tracker#firestore-and-sheets" target="_blank" rel="noreferrer">Open setup guide<ArrowUpRight size={16} /></a></details>}
    {sheets && <details className="plain-disclosure"><summary>Copy to Google Sheets</summary><p>Save a dated copy for reference. Editing the sheet does not change this app.</p><button className="button secondary" disabled={!sheetsEnabled || exporting} onClick={onExport}>{exporting ? 'Copying…' : 'Copy to Google Sheets'}</button>{!sheetsEnabled && <p>Your spreadsheet needs to be connected first.</p>}{error && <p className="form-error" role="alert">{error}</p>}</details>}
    <button className="backup-history text-button" onClick={onHistory}>Change history<ArrowUpRight size={16} /></button>
    {onSignOut && <button className="text-button backup-signout" onClick={onSignOut}><LogOut size={16} />Sign out</button>}
  </div></Modal>;
}

type RecordValue = Record<string, unknown>;
function humanFields(value: RecordValue, state: State) {
  const account = (id: unknown) => state.accounts.find(a => a.id === id)?.name ?? 'Account no longer shown';
  const month = (v: unknown) => v === '*' ? 'Every month' : typeof v === 'string' && /^from:\d{4}-(0[1-9]|1[0-2])$/.test(v) ? `From ${monthLabel(v.slice(5))} on` : typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? monthLabel(v) : String(v);
  const labels: Record<string, string> = { label: 'Name', name: 'Name', title: 'Name', merchant: 'Store or payer', type: 'Kind', scope: 'Personal or Business', amountCents: 'Amount', balanceCents: 'Starting balance', category: 'Group', subcategory: 'What for', classification: 'Need or Want', date: 'Date', month: 'Month', notes: 'Note', note: 'Note', accountId: 'From account', toAccountId: 'To account', paymentAccountId: 'Paid from', hidden: 'Hidden', dueDay: 'Due day', actualBalanceCents: 'Bank balance', calculatedBalanceCents: 'App balance', differenceCents: 'Difference', autopay: 'Automatic payment' };
  return Object.entries(value).filter(([key, v]) => labels[key] && v !== undefined && v !== null && v !== '' && ['string', 'number', 'boolean'].includes(typeof v)).map(([key, v]) => ({ label: labels[key], text: key.endsWith('Cents') && typeof v === 'number' ? money(v) : key.endsWith('AccountId') || key === 'accountId' || key === 'toAccountId' ? account(v) : key === 'month' ? month(v) : key === 'type' ? ({ Expense: 'Spent', Income: 'Got paid', Transfer: 'Moved money' }[String(v)] ?? String(v)) : typeof v === 'boolean' ? v ? 'Yes' : 'No' : key === 'date' ? Number.isFinite(new Date(`${v}T12:00:00`).getTime()) ? new Date(`${v}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Date unavailable' : String(v) }));
}
function RecordSummary({ value, state }: { value: unknown; state: State }) {
  if (value == null) return <p className="panel-note">No record.</p>;
  const records = Array.isArray(value) ? value : typeof value === 'object' && Array.isArray((value as RecordValue).balanceReconciliations) ? (value as RecordValue).balanceReconciliations as unknown[] : [value];
  return <>{records.map((item, index) => { const fields = item && typeof item === 'object' ? humanFields(item as RecordValue, state) : []; return fields.length ? <dl className="change-fields" key={index}>{fields.map((field, i) => <div key={i}><dt>{field.label}</dt><dd>{field.text}</dd></div>)}</dl> : <p className="panel-note" key={index}>This change is kept in the original record below.</p>; })}</>;
}
export function ChangeHistory({ state, onClose }: { state: State; onClose: () => void }) {
  const names: Record<string, string> = { transaction: 'Entry saved', account: 'Balance updated', budget: 'Budget changed', 'financial action': 'Reminder saved', 'daily check-in': 'Day reviewed', 'leak review': 'Review dismissed', 'expense-funding': 'Bill details changed', settings: 'Settings changed', 'income-sources': 'Payer saved', 'balance-reconciliations': 'Balance checked', 'budget-items': 'Budget changed', 'planned-income': 'Income plan changed', 'account-details': 'Account changed', 'bank check': 'Bank balance checked', 'entry removed': 'Entry removed', 'transaction undo': 'Entry undone' };
  return <Modal title="Change history" onClose={onClose} wide>{state.audit.length ? <div className="audit-list">{[...state.audit].reverse().map(a => <details key={a.id}><summary><span>{names[a.entity] ?? 'Change saved'}</span><small>{new Date(a.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</small></summary><div className="audit-versions"><div><h3>Before</h3><RecordSummary value={a.before} state={state} /></div><div><h3>After</h3><RecordSummary value={a.after} state={state} /></div></div><details className="original-record"><summary>Original record</summary><div className="audit-versions"><div><h3>Before</h3><pre>{JSON.stringify(a.before, null, 2)}</pre></div><div><h3>After</h3><pre>{JSON.stringify(a.after, null, 2)}</pre></div></div></details></details>)}</div> : <Empty title="No changes yet" text="Changes you make appear here." />}</Modal>;
}
