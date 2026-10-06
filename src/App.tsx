import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeftRight, BarChart3, CalendarDays, ClipboardList, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, CreditCard, Download, LayoutDashboard, LoaderCircle, LogOut, Plus, RefreshCw, ShieldCheck, Wallet, Check } from 'lucide-react';
import { currentMonth, localDate, money, budgetSpent, scopedTransactions, monthBudgets, parseCents, validateTransaction, type Account, type Budget, type Scope, type State, type Transaction, type TransactionType } from '../shared/model';
import { initialState } from '../shared/seed';
import { Modal, Empty, monthLabel } from './components';
import { AccountsView, BalanceHero, BudgetView, Dashboard, Insights, Ledger, type Page } from './pages';
import TransactionForm from './TransactionForm';
import SimpleEntry from './SimpleEntry';
import { HomeView, ActivityView, BudgetList, AccountsList, EntriesDialog, SpendingButtons } from './SimpleViews';
import { BudgetEditor, IncomeEditor, AccountEditor, BankCheck } from './SimpleEditors';
import { bankCheck, removeEntry, validateBudgetChange, validateIncomeChange, validateAccountChange } from '../shared/simple';
import { fundingFor } from '../shared/allocation';
import { api } from './api';
import { friendlyError } from './words';
import { BackupDialog, ChangeHistory } from './TrackerTools';
import CloudSetup from './CloudSetup';
import { BrandMark } from './Brand';
import { InstallControls } from './Pwa';
import { MoreMenu } from './MoreMenu';
import { SaveRipple } from './WaterTheme';
import { undoEntry } from '../shared/undo';
import { waterPreviewState } from '../shared/waterPreview';
import type { FirebaseOptions } from 'firebase/app';
import { extendState, validateAction, validateCheckIn, type DailyCheckIn, type FinancialAction, type LeakReview } from '../shared/actions';
import { detectLeaks, type FinancialLeak } from '../shared/leaks';
import { ActionForm, NotesReminders } from './financialActions';
import { balanceSnapshotIds, localMinute, currentBalance, validateFunding, validateIncomeSource, validateMonthReview, validateSettings, type ExpenseFunding, type IncomeSource, type MonthReview, type TrackerSettings } from '../shared/allocation';
import { FundingForm, FundingSection, IncomeSourceForm, MoneyFlow, MonthEndReview, SettingsForm } from './AllocationViews';
import { DailyCheckIn as DailyCheckInCard, CheckInHistory } from './DailyReview';
import { ReconciliationForm, ReconciliationPanel } from './Reconciliation';
import { validateReconciliation } from '../shared/reconciliation';
import { FinancialLeakPanel } from './awareness';
type Mode = 'loading' | 'local' | 'cloud' | 'login' | 'setup' | 'error';
const visualPreview = new URLSearchParams(window.location.search).get('preview') === 'water' || new URLSearchParams(window.location.search).get('preview') === 'simple';
const storageKey = visualPreview ? 'cash-flow-water-preview' : 'cash-flow-tracker-v1';
const navigation = [{ name: 'Dashboard' as Page, icon: LayoutDashboard }, { name: 'Transactions' as Page, icon: ArrowLeftRight }, { name: 'Budget' as Page, icon: Wallet }, { name: 'Accounts' as Page, icon: CreditCard }, { name: 'Advanced' as Page, icon: MoreHorizontal }];
const pageTitles: Record<Page, string> = {
  Dashboard: 'Home',
  Advanced: 'More',
  Transactions: 'History',
  Budget: 'Plan',
  Accounts: 'My money',
  Insights: 'My spending',
  'Money Flow': 'Money in & out',
  'Check-In History': 'Daily checks',
  'Month-End Review': 'Monthly review',
  'Notes & Reminders': 'Notes & reminders',
};
function stepMonth(month: string, direction: number) { const date = new Date(`${month}-15T12:00:00`); date.setMonth(date.getMonth() + direction); return localDate(date).slice(0, 7); }
function ValueEditor({ title, label, initial, allowNegative = false, snapshot = false, note, onClose, onSave }: { title: string; label: string; initial: number | null; allowNegative?: boolean; snapshot?: boolean; note: string; onClose: () => void; onSave: (value: number, asOf?: string) => Promise<void> }) {
  const [value, setValue] = useState(initial === null ? '' : (initial / 100).toFixed(2)), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [asOf, setAsOf] = useState(localMinute);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const negative = allowNegative && value.startsWith('-'); const cents = parseCents(negative ? value.slice(1) : value); await onSave(negative ? -cents : cents, snapshot ? asOf : undefined); onClose(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } }
  return <Modal title={title} subtitle={note} onClose={onClose}><form onSubmit={submit}><label htmlFor="edit-value">{label}<input data-autofocus id="edit-value" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} required placeholder="0.00" /></label>{snapshot && <label htmlFor="balance-as-of">Balance as of<input id="balance-as-of" type="datetime-local" value={asOf} max={localMinute()} required onChange={e => setAsOf(e.target.value)} /><span className="field-hint">Enter the date and time this bank balance represents. Older entries are already included.</span></label>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div></form></Modal>;
}
function Login({ onSuccess, google = false }: { onSuccess: () => void; google?: boolean }) {
  const [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function login(e?: FormEvent) {
    e?.preventDefault(); setBusy(true); setError('');
    try {
      if (google) { const client = await import('./firebaseClient'); await client.signInGoogle(); await api('cloud/info'); }
      else await api('login', { password });
      onSuccess();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <div className="login-screen"><form className="panel login-card" onSubmit={login}><BrandMark /><h1>Cash Flow Tracker</h1>{google ? null : <label htmlFor="password">Your password<input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus /></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Signing in…' : google ? 'Continue with Google' : 'Open Cash Flow Tracker'}<ArrowRight size={17} /></button><InstallControls /></form></div>;
}
export default function App() {
  const [state, setState] = useState<State>(initialState), [mode, setMode] = useState<Mode>('loading'), [aiEnabled, setAiEnabled] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseOptions>();
  const [sheetsExportEnabled, setSheetsExportEnabled] = useState(false), [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  const [page, setPage] = useState<Page>('Dashboard'), [month, setMonth] = useState(currentMonth), [scope, setScope] = useState<Scope | 'All'>(() => { const saved = localStorage.getItem('cash-flow-scope'); return saved === 'Business' || saved === 'All' ? saved : 'Personal'; });
  const [transactionOpen, setTransactionOpen] = useState(false), [edit, setEdit] = useState<Transaction>(), [accountEdit, setAccountEdit] = useState<Account>(), [budgetEdit, setBudgetEdit] = useState<Budget>();
  const [fundingEdit, setFundingEdit] = useState<Budget>(), [settingsOpen, setSettingsOpen] = useState(false), [sourceOpen, setSourceOpen] = useState(false), [sourceEdit, setSourceEdit] = useState<IncomeSource>();
  const [moreOpen, setMoreOpen] = useState(false);
  const [entryPreset, setEntryPreset] = useState<Partial<Transaction>>();
  const [planOpen, setPlanOpen] = useState(false), [incomeOpen, setIncomeOpen] = useState(false), [accountOpen, setAccountOpen] = useState(false), [accountDetails, setAccountDetails] = useState<Account>();
  const [bankOpen, setBankOpen] = useState(false), [bankAccount, setBankAccount] = useState<Account>(), [advancedEntry, setAdvancedEntry] = useState(false);
  const [entryList, setEntryList] = useState<{title: string; ids: string[]}>();
  function showEntries(title: string, entries: Transaction[]) { setEntryList({title, ids: entries.map(t => t.id)}); }
  function openBank(account?: Account) { setBankAccount(account); setBankOpen(true); }
  useEffect(() => { localStorage.setItem('cash-flow-scope', scope); }, [scope]);
  const [undo, setUndo] = useState<{ id: string; revision: number }>();
  const [undoBusy, setUndoBusy] = useState(false);
  const [draftType, setDraftType] = useState<TransactionType>('Expense');
  const [comparisonAccount, setComparisonAccount] = useState<Account>();
  const [clock, setClock] = useState(() => new Date());
  const today = localDate(clock), [ledgerDate, setLedgerDate] = useState('');
  const [actionOpen, setActionOpen] = useState(false), [actionEdit, setActionEdit] = useState<FinancialAction>(), [actionPreset, setActionPreset] = useState<Partial<FinancialAction>>();
  const [help, setHelp] = useState(false), [history, setHistory] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [refreshing, setRefreshing] = useState(false);
  async function load() {
    setError(''); setRefreshing(true);
    try {
      if (visualPreview) {
        const saved = localStorage.getItem(storageKey);
        setState(saved ? extendState(JSON.parse(saved)) : waterPreviewState());
        setMode('local'); return;
      }
      let status = await api<{ configured: boolean; authenticated: boolean; aiEnabled: boolean; backend?: string; sheetsExportEnabled?: boolean; firebase?: FirebaseOptions }>('status');
      if (status.backend === 'firestore' && status.firebase) {
        setFirebaseConfig(status.firebase);
        await (await import('./firebaseClient')).initializeCloud(status.firebase);
        status = await api<typeof status>('status');
      } else setFirebaseConfig(undefined);
      setAiEnabled(status.configured && status.aiEnabled); setSheetsExportEnabled(Boolean(status.sheetsExportEnabled));
      if (status.configured && !status.authenticated) { setMode('login'); return; }
      if (status.backend === 'firestore' && status.authenticated && !(await api<{ initialized: boolean }>('cloud/info')).initialized) { setMode('setup'); return; }
      if (status.configured) { const next = await api<State>('state'); setState(extendState(next)); setMode('cloud'); }
      else { const saved = localStorage.getItem(storageKey); if (saved) { const parsed = JSON.parse(saved) as State; if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.budgets) || !Array.isArray(parsed.categories) || !Array.isArray(parsed.income) || !Array.isArray(parsed.audit)) throw new Error('Your on-device data could not be read. Recover it before continuing.'); setState(extendState(parsed)); } setMode('local'); }
    } catch (e) { setError(friendlyError(e)); setMode('error'); } finally { setRefreshing(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches || document.hidden || document.documentElement.dataset.entryOpen === 'true') return;
    const animation = document.querySelector('main')?.animate([{ opacity: .8 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    const cancel = () => animation?.cancel();
    reduced.addEventListener('change', cancel);
    return () => { cancel(); reduced.removeEventListener('change', cancel); };
  }, [page]);
  useEffect(() => {
    const update = () => setClock(new Date());
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
  useEffect(() => { if (!message) return; const id = setTimeout(() => { setMessage(''); setUndo(undefined); }, 5000); return () => clearTimeout(id); }, [message, undo?.id, undo?.revision]);
  function saveLocal(next: State) { localStorage.setItem(storageKey, JSON.stringify(next)); setState(next); }
  async function applySaved(next: State) {
    if (mode === 'local') { saveLocal(next); return; }
    setState(next);
    try { setState(extendState(await api<State>('state'))); }
    catch { throw new Error('The change was saved. Refresh data to load the latest records before making another change.'); }
  }
  function localSnapshot(): State { const saved = localStorage.getItem(storageKey); return saved ? extendState(JSON.parse(saved)) : state; }
  function audit(entity: string, entityId: string, before: unknown, after: unknown) { return { id: crypto.randomUUID(), entity, entityId, at: new Date().toISOString(), before, after }; }
  async function saveTransaction(input: Transaction) {
    const base = mode === 'local' ? localSnapshot() : state;
    const previous = base.transactions.find(t => t.id === input.id);
    const result = mode === 'cloud' ? await api<Transaction>('transactions', input) : validateTransaction(input, base, previous);
    const next = { ...base, transactions: [...base.transactions.filter(t => t.id !== result.id), result], audit: [...base.audit, audit('transaction', result.id, previous ?? null, result)] };
    await applySaved(next);
    setEntryList(undefined);
    setUndo({ id: result.id, revision: result.revision });
    setMessage('Saved');
  }
  async function saveSimple(table: 'budgets' | 'income' | 'accounts', route: string, input: unknown, validate: (v: unknown, s: State) => Budget | State['income'][number] | Account) {
    const base = mode === 'local' ? localSnapshot() : state;
    const after = mode === 'cloud' ? await api<Budget | State['income'][number] | Account>(route, input) : validate(input, base);
    const records = base[table].filter(r => !(r.id === after.id && (table === 'accounts' || ('month' in r && 'month' in after && r.month === after.month))));
    await applySaved({ ...base, [table]: [...records, after], audit: [...base.audit, audit(route, after.id, base[table].filter(r => r.id === after.id), after)] }); setMessage('Saved.');
  }
  async function saveBank(input: unknown) {
    const base = mode === 'local' ? localSnapshot() : state;
    const result = mode === 'cloud' ? await api<ReturnType<typeof bankCheck>>('bank-check', input) : bankCheck(input, base);
    await applySaved({ ...base, accounts: base.accounts.map(a => result.accounts.find(b => b.id === a.id) ?? a), balanceReconciliations: [...base.balanceReconciliations, ...result.balanceReconciliations], dailyCheckIns: [...base.dailyCheckIns.filter(c => !result.dailyCheckIns.some(b => b.id === c.id)), ...result.dailyCheckIns], audit: [...base.audit, audit('bank check', result.balanceReconciliations[0].accountId, base.accounts.find(a => a.id === result.balanceReconciliations[0].accountId), result)] });
  }
  async function deleteEntry(entry: Transaction) {
    const base = mode === 'local' ? localSnapshot() : state;
    const result = mode === 'cloud' ? await api<Transaction>(`transactions/${entry.id}/remove`, {revision: entry.revision}) : removeEntry(base, entry.id, entry.revision);
    await applySaved({ ...base, transactions: base.transactions.filter(t => t.id !== entry.id), audit: [...base.audit, audit('entry removed', entry.id, entry, result)] }); setEntryList(undefined); setMessage('Entry removed.'); setUndo(undefined);
  }
  function payBudget(budget: Budget) {
    const legacyFunding = fundingFor(state, budget.id, month), dueDay = budget.dueDay !== undefined ? budget.dueDay : legacyFunding?.dueDay;
    const remaining = budget.amountCents - budgetSpent(budget, scopedTransactions(state, month, budget.scope));
    setEdit(undefined); setDraftType('Expense'); setEntryPreset({ type: 'Expense', amountCents: dueDay ? Math.max(0, remaining) : undefined, subcategory: budget.label, category: budget.category, scope: budget.scope, classification: budget.classification ?? 'Need', accountId: (budget.paymentAccountId ?? legacyFunding?.paymentAccountId) || undefined }); setTransactionOpen(true);
  }
  async function undoSave() {
    if (!undo || undoBusy) return;
    setUndoBusy(true);
    try {
      const base = mode === 'local' ? localSnapshot() : state;
      const restored = mode === 'cloud' ? (await api<{ transaction: Transaction | null }>(`transactions/${undo.id}/undo`, { revision: undo.revision })).transaction : undoEntry(base, undo.id, undo.revision).restored;
      const current = base.transactions.find(transaction => transaction.id === undo.id);
      const next = { ...base, transactions: [...base.transactions.filter(transaction => transaction.id !== undo.id), ...(restored ? [restored] : [])], audit: [...base.audit, audit('transaction undo', undo.id, current, restored)] };
      await applySaved(next); setMessage('Undone'); setUndo(undefined);
    } catch (error) { setMessage((error as Error).message); setUndo(undefined); }
    finally { setUndoBusy(false); }
  }
  async function saveBalance(balanceCents: number, asOf = localMinute()) {
    const base = mode === 'local' ? localSnapshot() : state;
    const before = base.accounts.find(a => a.id === accountEdit!.id)!;
    const balanceIncludedTransactionIds = balanceSnapshotIds(base.transactions, asOf);
    const after = mode === 'cloud' ? await api<Account>(`accounts/${before.id}/balance`, { balanceCents, balanceAsOf: asOf }) : { ...before, balanceAsOf: asOf, balanceIncludedTransactionIds, balanceCents, balanceUpdatedAt: new Date().toISOString() };
    const next = { ...base, accounts: base.accounts.map(a => a.id === after.id ? after : a), audit: [...base.audit, audit('account', after.id, before, after)] };
    await applySaved(next); setMessage('Account balance updated.');
  }
  async function saveBudget(amountCents: number) {
    const base = mode === 'local' ? localSnapshot() : state;
    const before = monthBudgets(base, month, scope).find(b => b.id === budgetEdit!.id)!;
    const after = mode === 'cloud' ? await api<Budget>(`budgets/${before.id}`, { amountCents, month }) : { ...before, amountCents, month };
    const next = { ...base, budgets: [...base.budgets.filter(b => !(b.id === after.id && b.month === month)), after], audit: [...base.audit, audit('budget', after.id, before, after)] };
    await applySaved(next); setMessage(`Budget updated for ${monthLabel(month)}.`);
  }
  async function saveAction(input: FinancialAction) {
    const base = mode === 'local' ? localSnapshot() : state, before = base.notesReminders.find(a => a.id === input.id);
    const after = mode === 'cloud' ? await api<FinancialAction>('actions', input) : validateAction(input, base, before);
    const next = { ...base, notesReminders: [...base.notesReminders.filter(a => a.id !== after.id), after], audit: [...base.audit, audit('financial action', after.id, before ?? null, after)] };
    await applySaved(next);
    setMessage(after.status === 'Completed' ? 'Action completed and kept in history.' : 'Financial action saved.');
  }
  async function confirmCheckIn(input: Pick<DailyCheckIn, 'date' | 'scope' | 'revision' | 'transactionFingerprint'>) {
    const base = mode === 'local' ? localSnapshot() : state;
    const after = mode === 'cloud' ? await api<DailyCheckIn>('check-ins', input) : validateCheckIn(input, base);
    const before = base.dailyCheckIns.find(c => c.id === after.id);
    const next = { ...base, dailyCheckIns: [...base.dailyCheckIns.filter(c => c.id !== after.id), after], audit: [...base.audit, audit('daily check-in', after.id, before ?? null, after)] };
    await applySaved(next);
    setMessage('Today’s recorded transactions confirmed.');
  }
  async function dismissLeak(leak: FinancialLeak) {
    const base = mode === 'local' ? localSnapshot() : state;
    if (base.leakReviews.some(r => r.id === leak.id)) return;
    if (!detectLeaks(base, leak.month, 'All').some(l => l.id === leak.id)) throw new Error('This review has changed. Refresh before dismissing.');
    const after = mode === 'cloud' ? await api<LeakReview>('leak-reviews', { id: leak.id, month: leak.month }) : { id: leak.id, month: leak.month, dismissedAt: new Date().toISOString() };
    const next = { ...base, leakReviews: [...base.leakReviews, after], audit: [...base.audit, audit('leak review', after.id, null, after)] };
    await applySaved(next);
    setMessage('Review dismissed. Changed entries can bring it back for review.');
  }
  async function saveExtension<K extends 'expenseFunding' | 'settings' | 'incomeSources' | 'monthReviews' | 'balanceReconciliations'>(table: K, route: string, input: unknown, validate: (input: unknown, state: State) => State[K][number]) {
    const base = mode === 'local' ? localSnapshot() : state;
    const after = mode === 'cloud' ? await api<State[K][number]>(route, input) : validate(input, base);
    const before = base[table].find(r => r.id === after.id) ?? null;
    const next = { ...base, [table]: [...base[table].filter(r => r.id !== after.id), after], audit: [...base.audit, audit(route, after.id, before, after)] };
    await applySaved(next);
    setMessage('Saved.');
  }
  const saveReconciliation = (v: unknown) => saveExtension('balanceReconciliations', 'balance-reconciliations', v, validateReconciliation);
  const saveFunding = (v: ExpenseFunding) => saveExtension('expenseFunding', 'expense-funding', v, validateFunding);
  const saveSettings = (v: TrackerSettings) => saveExtension('settings', 'settings', v, validateSettings);
  const saveSource = (v: IncomeSource) => saveExtension('incomeSources', 'income-sources', v, validateIncomeSource);
  const saveMonthReview = (v: MonthReview) => saveExtension('monthReviews', 'month-reviews', v, validateMonthReview);
  function reviewDay(date: string) { setMonth(date.slice(0, 7)); setLedgerDate(date); setPage('Transactions'); window.scrollTo({ top: 0 }); }
  function addAction(preset?: Partial<FinancialAction>) { setActionEdit(undefined); setActionPreset(preset); setActionOpen(true); }
  function editAction(action: FinancialAction) { setActionEdit(action); setActionPreset(undefined); setActionOpen(true); }
  function download() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `cash-flow-backup-${localDate()}.json`; a.click(); URL.revokeObjectURL(url); setMessage('Backup downloaded.');
  }
  function startTransaction(type: TransactionType) { setEntryPreset(undefined); setEdit(undefined); setDraftType(type); setTransactionOpen(true); }
  const add = () => startTransaction('Expense'), onEdit = (t: Transaction) => { setEdit(t); setTransactionOpen(true); };
  function navigate(next: Page) { setPage(next); setLedgerDate(''); window.scrollTo({ top: 0 }); }
  async function logout() { if (firebaseConfig) await (await import('./firebaseClient')).signOutGoogle(); await api('logout', {}); setHelp(false); setMode('login'); }
  if (mode === 'setup') return <CloudSetup onImported={load} onSignOut={logout} />;
  if (mode === 'login') return <Login google={Boolean(firebaseConfig)} onSuccess={() => void load()} />;
  if (mode === 'loading' || mode === 'error') return <div className="login-screen"><div className="panel login-card"><BrandMark /><h1>{mode === 'loading' ? 'Loading tracker…' : 'Connection unavailable'}</h1>{mode === 'loading' ? <LoaderCircle className="spin" /> : <><p role="alert">{error}</p><button className="button primary" onClick={() => void load()}>Try again<RefreshCw size={17} /></button></>}</div></div>;
  const mainPage = navigation.some(n => n.name === page) ? page : 'Advanced';
  return <div className="app-shell" data-page={page}>
    <SaveRipple />
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar">
      <a href="#" className="brand" onClick={e => { e.preventDefault(); navigate('Dashboard'); }}><BrandMark /><span>Cash Flow<span className="brand-sub">TRACKER</span></span></a>
      <nav aria-label="Main navigation">{navigation.map(({ name, icon: Icon }) => <button key={name} aria-label={pageTitles[name]} className={`nav-link ${mainPage === name ? 'active' : ''}`} aria-current={mainPage === name ? 'page' : undefined} onClick={() => navigate(name)}><Icon size={20} /><span>{pageTitles[name]}</span></button>)}</nav>
      <div className="sidebar-bottom legacy-advanced"><button className="nav-link" aria-label="More" onClick={() => setMoreOpen(true)}><MoreHorizontal size={20} /><span>More</span></button></div>
    </aside>
    <div className="main-shell">
    <header className="topbar"><a href="#" className="mobile-brand" onClick={e => { e.preventDefault(); navigate('Dashboard'); }}><BrandMark /><span>Cash Flow</span></a><button className="icon-button" aria-label="More" onClick={() => setMoreOpen(true)}><MoreHorizontal size={24} /></button></header>
    <main id="main" className="main-content">{mainPage !== page && <button className="text-button advanced-back" onClick={() => navigate('Advanced')}>Back to More</button>}<div className="page-heading"><div><h1>{pageTitles[page]}</h1></div>{page !== 'Notes & Reminders' && <button className="button primary heading-add" onClick={add}><Plus size={18} /><span>Add entry</span></button>}</div><div className="view-toolbar">{['Transactions', 'Budget', 'Insights', 'Money Flow', 'Check-In History', 'Month-End Review'].includes(page) && <div className="month-picker"><button className="icon-button" aria-label="Previous month" onClick={() => setMonth(stepMonth(month, -1))}><ChevronLeft size={18} /></button><label><CalendarDays size={17} /><span>{monthLabel(month)}</span><input aria-label="Select month" type="month" value={month} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value); }} /></label><button className="icon-button" aria-label="Next month" onClick={() => setMonth(stepMonth(month, 1))}><ChevronRight size={18} /></button></div>}<div className="segmented scope-picker" aria-label="Show personal, business or all" style={page === 'Check-In History' || page === 'Advanced' ? { display: 'none' } : undefined}>{(['Personal', 'Business', 'All'] as const).map(s => <button key={s} aria-pressed={scope === s} className={scope === s ? 'active' : ''} onClick={() => setScope(s)}>{s}</button>)}</div></div>
      {visualPreview && page === 'Advanced' && <div className="local-notice"><span className="status-dot local" /><span>Preview · sample data</span></div>}
      {page === 'Dashboard' && <HomeView state={state} scope={scope} onEdit={onEdit} onAccounts={() => navigate('Accounts')} onBudget={() => { setMonth(currentMonth()); navigate('Budget'); }} onBank={openBank} onAdd={startTransaction} onEntries={showEntries} />}
      {page === 'Transactions' && <ActivityView key={`${month}-${ledgerDate}`} state={state} month={month} scope={scope} onEdit={onEdit} presetDate={ledgerDate} />}
      {page === 'Budget' && <BudgetList state={state} month={month} scope={scope} onEdit={b => { setBudgetEdit(b); setPlanOpen(true); }} onAdd={() => { setBudgetEdit(undefined); setPlanOpen(true); }} onIncome={() => setIncomeOpen(true)} onPay={payBudget} onEntries={showEntries} />}
      {page === 'Accounts' && <AccountsList state={state} scope={scope} onBank={openBank} onEdit={a => { setAccountDetails(a); setAccountOpen(true); }} onAdd={() => { setAccountDetails(undefined); setAccountOpen(true); }} onEntries={showEntries} />}
      {page === 'Advanced' && <><MoreMenu inline local={mode === 'local'} refreshing={refreshing} onClose={() => {}} onNavigate={navigate} onSettings={() => setSettingsOpen(true)} onStorage={() => setHelp(true)} onRefresh={() => void load()} advancedTools={<><details className="simple-disclosure"><summary>Past changes & other tools<ChevronRight size={16} /></summary><button className="text-button" onClick={() => setHistory(true)}>Change history</button><details className="plain-disclosure"><summary>Review today’s entries</summary><DailyCheckInCard state={state} today={today} onConfirm={confirmCheckIn} onReview={reviewDay} /></details><button className="text-button" onClick={() => setAdvancedEntry(true)}>More entry options{aiEnabled ? ' & AI draft' : ''}</button>{state.accounts.filter(a => scope === 'All' || a.scope === scope).map(a => <details className="advanced-account" key={a.id}><summary>{a.name} · Balance history</summary><ReconciliationPanel state={state} account={a} onCompare={() => setComparisonAccount(a)} /></details>)}{state.accounts.some(a => a.hidden) && <><h3>Hidden accounts</h3>{state.accounts.filter(a => a.hidden).map(a => <button className="text-button" key={a.id} onClick={() => { setAccountDetails(a); setAccountOpen(true); }}>{a.name} · Edit</button>)}</>}</details><details className="simple-disclosure"><summary>Bill settings<ChevronDown size={16} /></summary><FundingSection state={state} month={currentMonth()} scope={scope} onEdit={b => { setMonth(currentMonth()); setFundingEdit(b); }} /></details></>} /></>}
      {page === 'Insights' && <><SpendingButtons state={state} scope={scope} onEntries={showEntries} /><details className="simple-disclosure"><summary>Spending patterns & charts<ChevronDown size={18} /></summary><Insights state={state} month={month} scope={scope} /></details><details className="simple-disclosure"><summary>Things to review<ChevronDown size={18} /></summary><FinancialLeakPanel state={state} month={month} scope={scope} today={today} onCreate={addAction} onDismiss={dismissLeak} onEditTransaction={onEdit} /></details></>}
      {page === 'Money Flow' && <MoneyFlow state={state} month={month} scope={scope} onAddSource={() => { setSourceEdit(undefined); setSourceOpen(true); }} onEditSource={s => { setSourceEdit(s); setSourceOpen(true); }} />}
      {page === 'Check-In History' && <CheckInHistory key={month} state={state} month={month} today={today} onConfirm={confirmCheckIn} onReview={reviewDay} />}
      {page === 'Month-End Review' && <MonthEndReview key={`${month}-${scope}`} state={state} month={month} scope={scope} onSave={saveMonthReview} />}
      {page === 'Notes & Reminders' && <NotesReminders state={state} scope={scope} today={today} onAdd={() => addAction()} onEdit={editAction} onSave={saveAction} />}</main></div>
    {page !== 'Notes & Reminders' && <button className="mobile-add" aria-label="Add entry" onClick={add}><Plus size={23} /><span>Add entry</span></button>}<nav className="mobile-nav" aria-label="Mobile navigation">{navigation.filter(item => ['Dashboard', 'Transactions', 'Budget', 'Accounts', 'Advanced'].includes(item.name)).map(({ name, icon: Icon }) => <button key={name} aria-label={pageTitles[name]} className={mainPage === name ? 'active' : ''} aria-current={mainPage === name ? 'page' : undefined} onClick={() => { setPage(name); setLedgerDate(''); window.scrollTo({ top: 0 }); }}><Icon size={21} /><span>{pageTitles[name]}</span></button>)}</nav>
    {moreOpen && <MoreMenu local={mode === 'local'} refreshing={refreshing} onClose={() => setMoreOpen(false)} onNavigate={navigate} onSettings={() => setSettingsOpen(true)} onStorage={() => setHelp(true)} onRefresh={() => void load()} />}
    <div className={`toast ${message ? 'visible' : ''}`} role="status" aria-live="polite">{message && <><Check size={17} />{message}{message === 'Saved' && <button type="button" className="text-button" onClick={add}>Add another</button>}{message === 'Saved' && undo && <button type="button" className="text-button" disabled={undoBusy} onClick={() => void undoSave()}>{undoBusy ? 'Undoing…' : 'Undo'}</button>}</>}</div>
    {fundingEdit && <FundingForm state={state} budget={fundingEdit} month={month} onBudgetEdit={() => { setBudgetEdit(fundingEdit); setFundingEdit(undefined); setPlanOpen(true); }} onSave={saveFunding} onClose={() => setFundingEdit(undefined)} />}
    {settingsOpen && <SettingsForm state={state} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
    {sourceOpen && <IncomeSourceForm state={state} edit={sourceEdit} onSave={saveSource} onClose={() => setSourceOpen(false)} />}
    {actionOpen && <ActionForm state={state} scope={scope} edit={actionEdit} preset={actionPreset} onClose={() => setActionOpen(false)} onSave={saveAction} />}{transactionOpen && <SimpleEntry state={state} edit={edit} preset={entryPreset} initialType={draftType} initialScope={scope} onClose={() => setTransactionOpen(false)} onSave={saveTransaction} onRemove={deleteEntry} />}
    {advancedEntry && <TransactionForm state={state} onClose={() => setAdvancedEntry(false)} onSave={saveTransaction} aiEnabled={aiEnabled} />}
    {entryList && !transactionOpen && <EntriesDialog title={entryList.title} state={state} entries={state.transactions.filter(t => entryList.ids.includes(t.id))} onEdit={onEdit} onClose={() => setEntryList(undefined)} />}
    {bankOpen && !transactionOpen && <BankCheck state={state} scope={bankAccount?.scope ?? scope} initialAccount={bankAccount} onEdit={onEdit} onSave={saveBank} onClose={() => setBankOpen(false)} onMissing={a => { setBankAccount(a); setEdit(undefined); setEntryPreset({accountId:a.id, scope:a.scope}); setDraftType('Expense'); setTransactionOpen(true); }} />}
    {planOpen && <BudgetEditor state={state} budget={budgetEdit} month={month} scope={scope} onSave={v => saveSimple('budgets', 'budget-items', v, validateBudgetChange)} onClose={() => { setPlanOpen(false); setBudgetEdit(undefined); }} />}
    {incomeOpen && <IncomeEditor state={state} month={month} scope={scope} onSave={v => saveSimple('income', 'planned-income', v, validateIncomeChange)} onClose={() => setIncomeOpen(false)} />}
    {accountOpen && <AccountEditor account={accountDetails} scope={scope} onSave={v => saveSimple('accounts', 'account-details', v, validateAccountChange)} onClose={() => setAccountOpen(false)} />}
    {comparisonAccount && <ReconciliationForm state={state} account={state.accounts.find(a => a.id === comparisonAccount.id)!} onSave={saveReconciliation} onClose={() => setComparisonAccount(undefined)} />}
    {accountEdit && <ValueEditor title="Update account balance" label={`${accountEdit.name} •••• ${accountEdit.lastFour}`} initial={currentBalance(state, accountEdit)} allowNegative snapshot note="Sets a new starting balance. Later movements update it. Use Compare actual balance to check a difference without resetting it." onClose={() => setAccountEdit(undefined)} onSave={saveBalance} />}

    {help && <BackupDialog local={mode === 'local'} preview={visualPreview} sheets={Boolean(firebaseConfig)} sheetsEnabled={sheetsExportEnabled} exporting={exporting} error={exportError} onClose={() => setHelp(false)} onDownload={download} onHistory={() => { setHelp(false); setHistory(true); }} onSignOut={mode === 'cloud' ? () => void logout() : undefined} onExport={() => { setExportError(''); setExporting(true); void api<{ tabs: string[] }>('sheets/export', {}).then(() => setMessage('Copy saved to Google Sheets.')).catch(e => setExportError(friendlyError(e))).finally(() => setExporting(false)); }} />}
    {history && <ChangeHistory state={state} onClose={() => setHistory(false)} />}
  </div>;
}
