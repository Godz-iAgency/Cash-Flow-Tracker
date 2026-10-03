import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeftRight, BarChart3, CalendarDays, ClipboardList, ChevronLeft, ChevronRight, CircleHelp, Cloud, CreditCard, Download, LayoutDashboard, Leaf, LoaderCircle, LogOut, Plus, RefreshCw, ShieldCheck, Wallet, Check } from 'lucide-react';
import { currentMonth, localDate, money, monthBudgets, parseCents, scopedTransactions, summarize, validateTransaction, type Account, type Budget, type Scope, type State, type Transaction } from '../shared/model';
import { initialState } from '../shared/seed';
import { Modal, Empty, Progress, monthLabel } from './components';
import { AccountsView, BudgetView, Dashboard, Insights, Ledger, type Page } from './pages';
import TransactionForm from './TransactionForm';
import { api } from './api';
import { extendState, validateAction, validateCheckIn, type DailyCheckIn, type FinancialAction, type LeakReview } from '../shared/actions';
import { detectLeaks, type FinancialLeak } from '../shared/leaks';
import { ActionForm, FinancialActionsCard, NotesReminders } from './financialActions';
import { DailyFinancialAxiom, FinancialCheckIn, FinancialLeakPanel } from './awareness';
type Mode = 'loading' | 'local' | 'sheets' | 'login' | 'error';
const storageKey = 'cash-flow-tracker-v1';
const navigation = [{ name: 'Dashboard' as Page, icon: LayoutDashboard }, { name: 'Transactions' as Page, icon: ArrowLeftRight }, { name: 'Budget' as Page, icon: Wallet }, { name: 'Accounts' as Page, icon: CreditCard }, { name: 'Insights' as Page, icon: BarChart3 }, { name: 'Notes & Reminders' as Page, icon: ClipboardList }];
const pageText: Record<Page, [string, string]> = {
  Dashboard: ['Your money, in focus.', 'A clear picture of what came in and where it went.'],
  Transactions: ['Every dollar has a story.', 'Your daily ledger. The big things and the little things.'],
  Budget: ['Give every dollar a place.', 'Your monthly plan, alongside what actually happened.'],
  Accounts: ['All your accounts. One place.', 'Keep personal and business money in view.'],
  Insights: ['Small habits. Clear patterns.', 'A little awareness goes a long way.'],
  'Notes & Reminders': ['Notes & Reminders', 'Turn a financial observation into a clear next step.'],
};
function stepMonth(month: string, direction: number) { const date = new Date(`${month}-15T12:00:00`); date.setMonth(date.getMonth() + direction); return localDate(date).slice(0, 7); }
function ValueEditor({ title, label, initial, allowNegative = false, note, onClose, onSave }: { title: string; label: string; initial: number | null; allowNegative?: boolean; note: string; onClose: () => void; onSave: (value: number) => Promise<void> }) {
  const [value, setValue] = useState(initial === null ? '' : (initial / 100).toFixed(2)), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const negative = allowNegative && value.startsWith('-'); const cents = parseCents(negative ? value.slice(1) : value); await onSave(negative ? -cents : cents); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Modal title={title} subtitle={note} onClose={onClose}><form onSubmit={submit}><label htmlFor="edit-value">{label}<input data-autofocus id="edit-value" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} required placeholder="0.00" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div></form></Modal>;
}
function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <div className="login-screen"><form className="panel login-card" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api('login', { password }); onSuccess(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><span className="brand-mark"><BarChart3 size={25} /></span><span className="eyebrow">YOUR PRIVATE MONEY SPACE</span><h1>Welcome back.</h1><p>A little clarity for every dollar.</p><label htmlFor="password">Your password<input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Open Cash Flow Tracker'}<ArrowRight size={17} /></button><small><ShieldCheck size={14} />Your data stays in your private Google Sheet.</small></form></div>;
}
export default function App() {
  const [state, setState] = useState<State>(initialState), [mode, setMode] = useState<Mode>('loading'), [aiEnabled, setAiEnabled] = useState(false);
  const [page, setPage] = useState<Page>('Dashboard'), [month, setMonth] = useState(currentMonth), [scope, setScope] = useState<Scope | 'All'>('Personal');
  const [transactionOpen, setTransactionOpen] = useState(false), [edit, setEdit] = useState<Transaction>(), [accountEdit, setAccountEdit] = useState<Account>(), [budgetEdit, setBudgetEdit] = useState<Budget>();
  const [today, setToday] = useState(localDate), [ledgerDate, setLedgerDate] = useState('');
  const [actionOpen, setActionOpen] = useState(false), [actionEdit, setActionEdit] = useState<FinancialAction>(), [actionPreset, setActionPreset] = useState<Partial<FinancialAction>>();
  const [help, setHelp] = useState(false), [history, setHistory] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [refreshing, setRefreshing] = useState(false);
  async function load() {
    setError(''); setRefreshing(true);
    try {
      const status = await api<{ configured: boolean; authenticated: boolean; aiEnabled: boolean }>('status');
      setAiEnabled(status.configured && status.aiEnabled);
      if (status.configured && !status.authenticated) { setMode('login'); return; }
      if (status.configured) { const next = await api<State>('state'); setState(extendState(next)); setMode('sheets'); }
      else { const saved = localStorage.getItem(storageKey); if (saved) { const parsed = JSON.parse(saved) as State; if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.budgets) || !Array.isArray(parsed.categories) || !Array.isArray(parsed.income) || !Array.isArray(parsed.audit)) throw new Error('Your on-device data could not be read. Recover it before continuing.'); setState(extendState(parsed)); } setMode('local'); }
    } catch (e) { setError((e as Error).message); setMode('error'); } finally { setRefreshing(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const update = () => setToday(localDate());
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  useEffect(() => {
    if (mode !== 'local') return;
    const changed = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue) {
        try { setState(extendState(JSON.parse(event.newValue))); } catch { setError('On-device data changed but could not be read.'); setMode('error'); }
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [mode]);
  useEffect(() => { if (!message) return; const id = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(id); }, [message]);
  function saveLocal(next: State) { localStorage.setItem(storageKey, JSON.stringify(next)); setState(next); }
  function localSnapshot(): State { const saved = localStorage.getItem(storageKey); return saved ? extendState(JSON.parse(saved)) : state; }
  function audit(entity: string, entityId: string, before: unknown, after: unknown) { return { id: crypto.randomUUID(), entity, entityId, at: new Date().toISOString(), before, after }; }
  async function saveTransaction(input: Transaction) {
    const base = mode === 'local' ? localSnapshot() : state;
    const previous = base.transactions.find(t => t.id === input.id);
    const result = mode === 'sheets' ? await api<Transaction>('transactions', input) : validateTransaction(input, base, previous);
    const next = { ...base, transactions: [...base.transactions.filter(t => t.id !== result.id), result], audit: [...base.audit, audit('transaction', result.id, previous ?? null, result)] };
    if (mode === 'local') saveLocal(next); else setState(next);
    setMessage(previous ? 'Transaction updated. Previous version preserved.' : 'Transaction saved. Every cent accounted for.');
  }
  async function saveBalance(balanceCents: number) {
    const base = mode === 'local' ? localSnapshot() : state;
    const before = base.accounts.find(a => a.id === accountEdit!.id)!;
    const after = mode === 'sheets' ? await api<Account>(`accounts/${before.id}/balance`, { balanceCents }) : { ...before, balanceCents, balanceUpdatedAt: new Date().toISOString() };
    const next = { ...base, accounts: base.accounts.map(a => a.id === after.id ? after : a), audit: [...base.audit, audit('account', after.id, before, after)] };
    if (mode === 'local') saveLocal(next); else setState(next); setMessage('Account balance updated.');
  }
  async function saveBudget(amountCents: number) {
    const base = mode === 'local' ? localSnapshot() : state;
    const before = monthBudgets(base, month, scope).find(b => b.id === budgetEdit!.id)!;
    const after = mode === 'sheets' ? await api<Budget>(`budgets/${before.id}`, { amountCents, month }) : { ...before, amountCents, month };
    const next = { ...base, budgets: [...base.budgets.filter(b => !(b.id === after.id && b.month === month)), after], audit: [...base.audit, audit('budget', after.id, before, after)] };
    if (mode === 'local') saveLocal(next); else setState(next); setMessage(`Budget updated for ${monthLabel(month)}.`);
  }
  async function saveAction(input: FinancialAction) {
    const base = mode === 'local' ? localSnapshot() : state, before = base.notesReminders.find(a => a.id === input.id);
    const after = mode === 'sheets' ? await api<FinancialAction>('actions', input) : validateAction(input, base, before);
    const next = { ...base, notesReminders: [...base.notesReminders.filter(a => a.id !== after.id), after], audit: [...base.audit, audit('financial action', after.id, before ?? null, after)] };
    if (mode === 'local') saveLocal(next); else setState(next);
    setMessage(after.status === 'Completed' ? 'Action completed and kept in history.' : 'Financial action saved.');
  }
  async function confirmCheckIn(input: Pick<DailyCheckIn, 'date' | 'scope' | 'revision' | 'transactionFingerprint'>) {
    const base = mode === 'local' ? localSnapshot() : state;
    const after = mode === 'sheets' ? await api<DailyCheckIn>('check-ins', input) : validateCheckIn(input, base);
    const before = base.dailyCheckIns.find(c => c.id === after.id);
    const next = { ...base, dailyCheckIns: [...base.dailyCheckIns.filter(c => c.id !== after.id), after], audit: [...base.audit, audit('daily check-in', after.id, before ?? null, after)] };
    if (mode === 'local') saveLocal(next); else setState(next);
    setMessage('Today’s recorded transactions confirmed.');
  }
  async function dismissLeak(leak: FinancialLeak) {
    const base = mode === 'local' ? localSnapshot() : state;
    if (base.leakReviews.some(r => r.id === leak.id)) return;
    if (!detectLeaks(base, leak.month, 'All').some(l => l.id === leak.id)) throw new Error('This review has changed. Refresh before dismissing.');
    const after = mode === 'sheets' ? await api<LeakReview>('leak-reviews', { id: leak.id, month: leak.month }) : { id: leak.id, month: leak.month, dismissedAt: new Date().toISOString() };
    const next = { ...base, leakReviews: [...base.leakReviews, after], audit: [...base.audit, audit('leak review', after.id, null, after)] };
    if (mode === 'local') saveLocal(next); else setState(next);
    setMessage('Review dismissed. Changed entries can bring it back for review.');
  }
  function addAction(preset?: Partial<FinancialAction>) { setActionEdit(undefined); setActionPreset(preset); setActionOpen(true); }
  function editAction(action: FinancialAction) { setActionEdit(action); setActionPreset(undefined); setActionOpen(true); }
  function download() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `cash-flow-backup-${localDate()}.json`; a.click(); URL.revokeObjectURL(url); setMessage('Backup downloaded, including transaction history.');
  }
  const add = () => { setEdit(undefined); setTransactionOpen(true); }, onEdit = (t: Transaction) => { setEdit(t); setTransactionOpen(true); };
  const planned = monthBudgets(state, month, scope).reduce((n, b) => n + b.amountCents, 0), spent = summarize(scopedTransactions(state, month, scope)).expenses;
  if (mode === 'login') return <Login onSuccess={() => void load()} />;
  if (mode === 'loading' || mode === 'error') return <div className="login-screen"><div className="panel login-card"><span className="brand-mark"><BarChart3 size={25} /></span><h1>{mode === 'loading' ? 'Opening your money space…' : 'Let’s reconnect.'}</h1>{mode === 'loading' ? <LoaderCircle className="spin" /> : <><p role="alert">{error}</p><button className="button primary" onClick={() => void load()}>Try again<RefreshCw size={17} /></button></>}</div></div>;
  return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a><aside className="sidebar"><a href="#" className="brand" onClick={e => { e.preventDefault(); setPage('Dashboard'); }}><span className="brand-mark"><BarChart3 size={23} /></span><span>Cash Flow<span className="brand-sub">TRACKER</span></span></a><div className="workspace"><span className="avatar">G</span><span><strong>My money space</strong><small>Personal & GODZ-i LLC</small></span><ShieldCheck size={16} /></div><span className="nav-label">YOUR OVERVIEW</span><nav aria-label="Main navigation">{navigation.map(({ name, icon: Icon }) => <button key={name} aria-label={name} className={`nav-link ${page === name ? 'active' : ''}`} aria-current={page === name ? 'page' : undefined} onClick={() => { setPage(name); setLedgerDate(''); window.scrollTo({ top: 0 }); }}><Icon size={20} /><span>{name}</span>{page === name && <span className="nav-dot" />}</button>)}</nav><button className="button primary sidebar-add" onClick={add}><Plus size={18} />Add transaction</button><div className="sidebar-bottom"><div className="sidebar-plan"><span>THIS MONTH’S PLAN<Leaf size={15} /></span><strong>{money(planned - spent)}</strong><p>left in your monthly plan</p><Progress value={planned ? spent / planned * 100 : 0} /><small>{money(spent)} of {money(planned)}</small></div><button className="sidebar-help" onClick={() => setHelp(true)}><CircleHelp size={18} />Help & connection<ArrowUpRight size={15} /></button><div className="sidebar-private"><ShieldCheck size={14} />A private place for your money</div></div></aside>
    <div className="main-shell"><header className="topbar"><span className="breadcrumb">My money space<span>/</span><strong>{page}</strong></span><div className="topbar-actions"><button className="icon-button mobile-actions-link" aria-label="Notes & Reminders" onClick={() => setPage('Notes & Reminders')}><ClipboardList size={18} /></button><button className="connection-button" onClick={() => setHelp(true)}><span className={`status-dot ${mode === 'local' ? 'local' : ''}`} /><span>{mode === 'local' ? 'On this device' : 'Google Sheets'}</span><Cloud size={15} /></button><button className="icon-button" aria-label="Refresh data" title="Refresh data" disabled={refreshing} onClick={() => void load()}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /></button><button className="profile-button" aria-label="Open help and connection" onClick={() => setHelp(true)}>G</button></div></header>
    <main id="main" className="main-content"><div className="page-heading"><div><span className="eyebrow">{page === 'Dashboard' ? 'A LITTLE CLARITY, EVERY DAY' : 'YOUR MONEY, YOUR AWARENESS'}</span><h1>{pageText[page][0]}</h1><p>{pageText[page][1]}</p></div><button className="button primary heading-add" onClick={add}><Plus size={18} /><span>Add transaction</span></button></div><div className="view-toolbar">{page !== 'Notes & Reminders' && <div className="month-picker"><button className="icon-button" aria-label="Previous month" onClick={() => setMonth(stepMonth(month, -1))}><ChevronLeft size={18} /></button><label><CalendarDays size={17} /><span>{monthLabel(month)}</span><input aria-label="Select month" type="month" value={month} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value); }} /></label><button className="icon-button" aria-label="Next month" onClick={() => setMonth(stepMonth(month, 1))}><ChevronRight size={18} /></button></div>}<div className="segmented scope-picker" aria-label="Account scope">{(['Personal', 'Business', 'All'] as const).map(s => <button key={s} aria-pressed={scope === s} className={scope === s ? 'active' : ''} onClick={() => setScope(s)}>{s}</button>)}</div><span className="toolbar-note"><ShieldCheck size={14} />{scope === 'All' ? 'All accounts in view' : `${scope} accounts only`}</span></div>
      {mode === 'local' && <div className="local-notice"><span className="status-dot local" /><span>Saved on this device. Connect Google Sheets to keep your history backed up.</span><button className="text-button" onClick={() => setHelp(true)}>Set up<ArrowRight size={14} /></button></div>}
      {page === 'Dashboard' && <><Dashboard state={state} month={month} scope={scope} add={add} onEdit={onEdit} go={setPage} awareness={<div className="awareness-grid"><FinancialActionsCard state={state} scope={scope} today={today} onAdd={() => addAction()} onEdit={editAction} onOpen={() => setPage('Notes & Reminders')} /><DailyFinancialAxiom today={today} /></div>} /><div className="awareness-after"><FinancialCheckIn state={state} scope={scope} today={today} onConfirm={confirmCheckIn} onReview={() => { setMonth(today.slice(0, 7)); setLedgerDate(today); setPage('Transactions'); window.scrollTo({ top: 0 }); }} /><FinancialLeakPanel state={state} month={month} scope={scope} today={today} onCreate={addAction} onDismiss={dismissLeak} onEditTransaction={onEdit} compact onOpen={() => setPage('Insights')} /></div></>}{page === 'Transactions' && <Ledger state={state} month={month} scope={scope} onEdit={onEdit} add={add} presetDate={ledgerDate} />}{page === 'Budget' && <BudgetView state={state} month={month} scope={scope} onEdit={setBudgetEdit} />}{page === 'Accounts' && <AccountsView state={state} month={month} scope={scope} onEdit={setAccountEdit} />}{page === 'Insights' && <><Insights state={state} month={month} scope={scope} /><div className="awareness-after"><FinancialLeakPanel state={state} month={month} scope={scope} today={today} onCreate={addAction} onDismiss={dismissLeak} onEditTransaction={onEdit} /></div></>}
      {page === 'Notes & Reminders' && <NotesReminders state={state} scope={scope} today={today} onAdd={() => addAction()} onEdit={editAction} onSave={saveAction} />}<footer className="page-footer"><span><Leaf size={14} />Awareness over perfection. One entry at a time.</span><button className="text-button" onClick={download}><Download size={14} />Export backup</button></footer></main></div>
    <button className="mobile-add" aria-label="Add transaction" onClick={add}><Plus size={23} /><span>Add transaction</span></button><nav className="mobile-nav" aria-label="Mobile navigation">{navigation.filter(item => item.name !== 'Notes & Reminders').map(({ name, icon: Icon }) => <button key={name} className={page === name ? 'active' : ''} aria-current={page === name ? 'page' : undefined} onClick={() => { setPage(name); setLedgerDate(''); window.scrollTo({ top: 0 }); }}><Icon size={21} /><span>{name}</span></button>)}</nav>
    <div className={`toast ${message ? 'visible' : ''}`} role="status" aria-live="polite">{message && <><Check size={17} />{message}</>}</div>
    {actionOpen && <ActionForm state={state} scope={scope} edit={actionEdit} preset={actionPreset} onClose={() => setActionOpen(false)} onSave={saveAction} />}{transactionOpen && <TransactionForm state={state} edit={edit} onClose={() => setTransactionOpen(false)} onSave={saveTransaction} aiEnabled={aiEnabled} />}
    {accountEdit && <ValueEditor title="Update account balance" label={`${accountEdit.name} •••• ${accountEdit.lastFour}`} initial={accountEdit.balanceCents} allowNegative note="Enter the balance shown by your bank. This is a manual snapshot." onClose={() => setAccountEdit(undefined)} onSave={saveBalance} />}
    {budgetEdit && <ValueEditor title={`Plan for ${budgetEdit.label}`} label="Planned amount ($)" initial={budgetEdit.amountCents} note={`Changes apply only to ${monthLabel(month)}. Other months keep their plans.`} onClose={() => setBudgetEdit(undefined)} onSave={saveBudget} />}
    {help && <Modal title="Your private money space" subtitle="A simple setup. Every dollar accounted for." onClose={() => setHelp(false)}><div className="help-content"><span className="connection-label"><span className={`status-dot ${mode === 'local' ? 'local' : ''}`} />{mode === 'local' ? 'On-device storage' : 'Connected to Google Sheets'}</span><p>{mode === 'local' ? 'Entries are saved in this browser on this device. Download backups regularly. Clearing browser data removes these entries.' : 'Your transactions, accounts, and monthly plans are stored in your private Google Sheet. Edits preserve previous records.'}</p>{mode === 'local' && <><h3>Connect Google Sheets</h3><p>Follow the project’s setup guide to connect a private spreadsheet and set your app password. Your on-device entries are not automatically moved to Sheets; export a backup before switching.</p><a className="button secondary" href="https://github.com/Godz-iAgency/Cash-Flow-Tracker#google-sheets-setup" target="_blank" rel="noreferrer">Open setup guide<ArrowUpRight size={16} /></a></>}<h3>About your starting plan</h3><p>The planned expenses and five account labels come from the supplied written specification. No spreadsheet or account balances were supplied. Your recorded income starts at zero until you enter it.</p><div className="help-actions"><button className="button secondary" onClick={download}><Download size={16} />Export full backup</button><button className="button secondary" onClick={() => { setHelp(false); setHistory(true); }}><ShieldCheck size={16} />Audit history</button>{mode === 'sheets' && <button className="text-button" onClick={async () => { await api('logout', {}); setHelp(false); setMode('login'); }}><LogOut size={16} />Sign out</button>}</div></div></Modal>}
    {history && <Modal title="Audit history" subtitle="Previous versions are preserved whenever an entry changes." onClose={() => setHistory(false)} wide>{state.audit.length ? <div className="audit-list">{[...state.audit].reverse().map(a => <details key={a.id}><summary><span>{a.entity === 'transaction' ? a.before ? 'Transaction edited' : 'Transaction added' : a.entity === 'account' ? 'Balance updated' : a.entity === 'budget' ? 'Monthly plan updated' : a.entity === 'financial action' ? 'Financial action saved' : a.entity === 'daily check-in' ? 'Daily check-in confirmed' : 'Review dismissed'}</span><small>{new Date(a.at).toLocaleString()}</small></summary><div className="audit-versions"><div><h3>Before</h3><pre>{JSON.stringify(a.before, null, 2)}</pre></div><div><h3>After</h3><pre>{JSON.stringify(a.after, null, 2)}</pre></div></div></details>)}</div> : <Empty title="A clean starting point" text="Your audit history will grow as you record and update entries." />}</Modal>}
  </div>;
}
