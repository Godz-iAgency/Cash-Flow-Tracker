import { useRef, useState, type ChangeEvent } from 'react';
import { Cloud, Download, Upload, LogOut, ArrowLeft } from 'lucide-react';
import type { State } from '../shared/model';
import { stateTables, validateBackup } from '../shared/backup';
import { initialState } from '../shared/seed';
import { api } from './api';

const tableLabels = { accounts: 'Accounts', categories: 'Categories', budgets: 'Budget items', income: 'Income plans', transactions: 'Transactions', audit: 'Audit history', notesReminders: 'Notes & reminders', dailyCheckIns: 'Daily check-ins', leakReviews: 'Leak reviews', expenseFunding: 'Expense funding', incomeSources: 'Income sources', settings: 'Settings', monthReviews: 'Month reviews', balanceReconciliations: 'Balance comparisons' };

export default function CloudSetup({ onImported, onSignOut }: { onImported: () => Promise<void>; onSignOut: () => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<State>();
  const [source, setSource] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [copied, setCopied] = useState(false);
  const [hasDeviceRecords] = useState(() => { try { return Boolean(localStorage.getItem('cash-flow-tracker-v1')); } catch { return false; } });
  function review(input: unknown, label: string) {
    setError(''); setConfirmed(false);
    try { setCandidate(validateBackup(input)); setSource(label); } catch (e) { setCandidate(undefined); setError((e as Error).message); }
  }
  function reviewDevice() {
    try {
      const saved = localStorage.getItem('cash-flow-tracker-v1');
      if (!saved) { setError('No records are saved in this browser. Choose your downloaded JSON backup.'); return; }
      review(JSON.parse(saved), 'Records from this browser');
    } catch { setError('This browser’s records could not be read. Choose your exported backup.'); }
  }
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setCandidate(undefined); setConfirmed(false); setError('');
    try {
      if (file.size > 2_000_000) throw new Error('Choose a backup smaller than 2 MB.');
      review(JSON.parse(await file.text()), file.name);
    } catch (e) { setError((e as Error).message); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...candidate, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'cash-flow-before-cloud-import.json'; link.click(); URL.revokeObjectURL(url);
  }
  async function openTracker() {
    setError(''); setBusy(true);
    try {
      if (!copied) { await api('cloud/import', { confirmed: true, state: candidate }); setCopied(true); }
      await onImported();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="login-screen"><section className="panel cloud-setup" aria-busy={busy}>
    <span className="brand-mark"><Cloud size={25} /></span>
    <span className="cloud-step">{candidate ? 'Step 2 of 2 · Review & open' : 'Step 1 of 2 · Choose records'}</span>
    <h1>{candidate ? 'Review your backup' : 'Set up cloud storage'}</h1>
    <p>{candidate ? 'Confirm these records, then import them and open your tracker. Your original backup and device records stay intact.' : 'Google sign-in is complete. Import your saved records once to open the cloud tracker.'}</p>
    <input ref={fileInput} className="cloud-backup-input" type="file" accept=".json,application/json" aria-label="JSON backup file" hidden disabled={busy} onChange={chooseFile} />
    {!candidate ? <>
      {!hasDeviceRecords && <p className="cloud-storage-note">No records are saved in this browser at this address. Choose the JSON backup you downloaded from your original tracker.</p>}
      <div className="cloud-choices"><button type="button" className="button primary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={16} />Choose JSON backup</button>{hasDeviceRecords && <button type="button" className="button secondary" disabled={busy} onClick={reviewDevice}>Review this device</button>}</div>
      <p className="field-hint">Open Downloads and select the .json file itself. Folders cannot be imported.</p>
      <details className="cloud-start-fresh"><summary>Starting without an existing backup?</summary><p>The starting plan has 5 accounts, 13 budget items, no recorded transactions, and unknown opening balances. Choose your backup if you already have records.</p><button type="button" className="button secondary" onClick={() => review(initialState(), 'Starting plan — no recorded transactions')}>Review starting plan</button></details>
    </> : <>
      <h2 className="cloud-source">{source}</h2>
      <dl className="cloud-counts">{stateTables.filter(table => candidate[table].length).map(table => <div key={table}><dt>{tableLabels[table]}</dt><dd>{candidate[table].length}</dd></div>)}</dl>
      <p>{candidate.transactions.length} transactions. {candidate.accounts.filter(a => a.balanceCents !== null).length} known opening balances. Amounts, classifications, timestamps, and history will be preserved.</p>
      {!copied && <><button type="button" className="button secondary" disabled={busy} onClick={download}><Download size={16} />Download safety backup</button><label className="cloud-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />I have kept a backup and reviewed these records.</label>{!confirmed && <p className="field-hint">Check the box above to enable Import & open tracker.</p>}</>}
      <button type="button" className="button primary" disabled={(!confirmed && !copied) || busy} onClick={() => void openTracker()}>{busy ? copied ? 'Opening tracker…' : 'Importing records…' : copied ? 'Open tracker' : 'Import & open tracker'}</button>
      {!copied && <button type="button" className="text-button" disabled={busy} onClick={() => { setCandidate(undefined); setConfirmed(false); setError(''); }}><ArrowLeft size={16} />Choose different records</button>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="button" className="text-button" disabled={busy} onClick={async () => { setError(''); setBusy(true); try { await onSignOut(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><LogOut size={16} />Sign out</button>
  </section></div>;
}
