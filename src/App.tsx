import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeftRight, BarChart3, CalendarDays, ClipboardList, ChevronLeft, ChevronRight, CircleHelp, Cloud, CreditCard, Coins, Download, LayoutDashboard, Leaf, LoaderCircle, LogOut, Plus, RefreshCw, ShieldCheck, Wallet, Check } from 'lucide-react';
import { currentMonth, localDate, money, monthBudgets, parseCents, scopedTransactions, summarize, validateTransaction, type Account, type Budget, type Scope, type State, type Transaction, type TransactionType } from '../shared/model';
import { initialState } from '../shared/seed';
import { Modal, Empty, Progress, monthLabel } from './components';
import { AccountsView, BalanceHero, BudgetView, Dashboard, Insights, Ledger, type Page } from './pages';
import TransactionForm from './TransactionForm';
import { api } from './api';
import { extendState, validateAction, validateCheckIn, type DailyCheckIn, type FinancialAction, type LeakReview } from '../shared/actions';
import { detectLeaks, type FinancialLeak } from '../shared/leaks';
import { ActionForm, FinancialActionsCard, NotesReminders } from './financialActions';
import { balanceSnapshotIds, localMinute, currentBalance, validateFunding, validateIncomeSource, validateMonthReview, validateSettings, type ExpenseFunding, type IncomeSource, type MonthReview, type TrackerSettings } from '../shared/allocation';
import { FundingForm, FundingSection, IncomeAllocation, IncomeSourceForm, MoneyFlow, MonthEndReview, SettingsForm } from './AllocationViews';
import { DailyCheckIn as DailyCheckInCard, CheckInHistory } from './DailyReview';
import { ReconciliationForm } from './Reconciliation';
import { validateReconciliation } from '../shared/reconciliation';
import { DailyFinancialAxiom, FinancialLeakPanel } from './awareness';
type Mode = 'loading' | 'local' | 'sheets' | 'login' | 'error';
const storageKey = 'cash-flow-tracker-v1';
const navigation = [{ name: 'Dashboard' as Page, icon: LayoutDashboard }, { name: 'Transactions' as Page, icon: ArrowLeftRight }, { name: 'Budget' as Page, icon: Wallet }, { name: 'Accounts' as Page, icon: CreditCard }, { name: 'Insights' as Page, icon: BarChart3 }, { name: 'Notes & Reminders' as Page, icon: ClipboardList }, { name: 'Money Flow' as Page, icon: ArrowLeftRight }, { name: 'Check-In History' as Page, icon: CalendarDays }, { name: 'Month-End Review' as Page, icon: BarChart3 }];
const pageTitles: Record<Page, string> = {
  Dashboard: 'Dashboard',
  Transactions: 'Transactions',
  Budget: 'Budget',
  Accounts: 'Accounts',
  Insights: 'Insights',
  'Money Flow': 'Money Flow',
  'Check-In History': 'Check-In History',
  'Month-End Review': 'Month-End Review',
  'Notes & Reminders': 'Notes & Reminders',
};
function stepMonth(month: string, direction: number) { const date = new Date(`${month}-15T12:00:00`); date.setMonth(date.getMonth() + direction); return localDate(date).slice(0, 7); }
function ValueEditor({ title, label, initial, allowNegative = false, snapshot = false, note, onClose, onSave }: { title: string; label: string; initial: number | null; allowNegative?: boolean; snapshot?: boolean; note: string; onClose: () => void; onSave: (value: number, asOf?: string) => Promise<void> }) {
  const [value, setValue] = useState(initial === null ? '' : (initial / 100).toFixed(2)), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [asOf, setAsOf] = useState(localMinute);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const negative = allowNegative && value.startsWith('-'); const cents = parseCents(negative ? value.slice(1) : value); await onSave(negative ? -cents : cents, snapshot ? asOf : undefined); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Modal title={title} subtitle={note} onClose={onClose}><form onSubmit={submit}><label htmlFor="edit-value">{label}<input data-autofocus id="edit-value" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} required placeholder="0.00" /></label>{snapshot && <label htmlFor="balance-as-of">Balance as of<input id="balance-as-of" type="datetime-local" value={asOf} max={localMinute()} required onChange={e => setAsOf(e.target.value)} /><span className="field-hint">Enter the date and time this bank balance represents. Older entries are already included.</span></label>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div></form></Modal>;
}
function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <div className="login-screen"><form className="panel login-card" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api('login', { password }); onSuccess(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><span className="brand-mark"><Coins size={25} /></span><h1>Cash Flow Tracker</h1><label htmlFor="password">Your password<input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Open Cash Flow Tracker'}<ArrowRight size={17} /></button><small><ShieldCheck size={14} />Your data stays in your private Google Sheet.</small></form></div>;
}
export default function App() {
  const [state, setState] = useState<State>(initialState), [mode, setMode] = useState<Mode>('loading'), [aiEnabled, setAiEnabled] = useState(false);
  const [page, setPage] = useState<Page>('Dashboard'), [month, setMonth] = useState(currentMonth), [scope, setScope] = useState<Scope | 'All'>('Personal');
  const [transactionOpen, setTransactionOpen] = useState(false), [edit, setEdit] = useState<Transaction>(), [accountEdit, setAccountEdit] = useState<Account>(), [budgetEdit, setBudgetEdit] = useState<Budget>();
  const [fundingEdit, setFundingEdit] = useState<Budget>(), [settingsOpen, setSettingsOpen] = useState(false), [sourceOpen, setSourceOpen] = useState(false), [sourceEdit, setSourceEdit] = useState<IncomeSource>();
  const [heroActionsVisible, setHeroActionsVisible] = useState(true);
  const [draftType, setDraftType] = useState<TransactionType>('Expense');
  const [comparisonAccount, setComparisonAccount] = useState<Account>();
  const [clock, setClock] = useState(() => new Date());
  const today = localDate(clock), [ledgerDate, setLedgerDate] = useState('');
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
  useEffect(() => { if (!message) return; const id = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(id); }, [message]);
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
    const result = mode === 'sheets' ? await api<Transaction>('transactions', input) : validateTransaction(input, base, previous);
    const next = { ...base, transactions: [...base.transactions.filter(t => t.id !== result.id), result], audit: [...base.audit, audit('transaction', result.id, previous ?? null, result)] };
    await applySaved(next);
    setMessage(previous ? 'Transaction updated. Previous version preserved.' : 'Transaction saved. Every cent accounted for.');
  }
  async function saveBalance(balanceCents: number, asOf = localMinute()) {
    const base = mode === 'local' ? localSnapshot() : state;
    const before = base.accounts.find(a => a.id === accountEdit!.id)!;
    const balanceIncludedTransactionIds = balanceSnapshotIds(base.transactions, asOf);
    const after = mode === 'sheets' ? await api<Account>(`accounts/${before.id}/balance`, { balanceCents, balanceAsOf: asOf }) : { ...before, balanceAsOf: asOf, balanceIncludedTransactionIds, balanceCents, balanceUpdatedAt: new Date().toISOString() };
    const next = { ...base, accounts: base.accounts.map(a => a.id === after.id ? after : a), audit: [...base.audit, audit('account', after.id, before, after)] };
    await applySaved(next); setMessage('Account balance updated.');
  }
  async function saveBudget(amountCents: number) {
    const base = mode === 'local' ? localSnapshot() : state;
    const before = monthBudgets(base, month, scope).find(b => b.id === budgetEdit!.id)!;
    const after = mode === 'sheets' ? await api<Budget>(`budgets/${before.id}`, { amountCents, month }) : { ...before, amountCents, month };
    const next = { ...base, budgets: [...base.budgets.filter(b => !(b.id === after.id && b.month === month)), after], audit: [...base.audit, audit('budget', after.id, before, after)] };
    await applySaved(next); setMessage(`Budget updated for ${monthLabel(month)}.`);
  }
  async function saveAction(input: FinancialAction) {
    const base = mode === 'local' ? localSnapshot() : state, before = base.notesReminders.find(a => a.id === input.id);
    const after = mode === 'sheets' ? await api<FinancialAction>('actions', input) : validateAction(input, base, before);
    const next = { ...base, notesReminders: [...base.notesReminders.filter(a => a.id !== after.id), after], audit: [...base.audit, audit('financial action', after.id, before ?? null, after)] };
    await applySaved(next);
    setMessage(after.status === 'Completed' ? 'Action completed and kept in history.' : 'Financial action saved.');
  }
  async function confirmCheckIn(input: Pick<DailyCheckIn, 'date' | 'scope' | 'revision' | 'transactionFingerprint'>) {
    const base = mode === 'local' ? localSnapshot() : state;
    const after = mode === 'sheets' ? await api<DailyCheckIn>('check-ins', input) : validateCheckIn(input, base);
    const before = base.dailyCheckIns.find(c => c.id === after.id);
    const next = { ...base, dailyCheckIns: [...base.dailyCheckIns.filter(c => c.id !== after.id), after], audit: [...base.audit, audit('daily check-in', after.id, before ?? null, after)] };
    await applySaved(next);
    setMessage('Today’s recorded transactions confirmed.');
  }
  async function dismissLeak(leak: FinancialLeak) {
    const base = mode === 'local' ? localSnapshot() : state;
    if (base.leakReviews.some(r => r.id === leak.id)) return;
    if (!detectLeaks(base, leak.month, 'All').some(l => l.id === leak.id)) throw new Error('This review has changed. Refresh before dismissing.');
    const after = mode === 'sheets' ? await api<LeakReview>('leak-reviews', { id: leak.id, month: leak.month }) : { id: leak.id, month: leak.month, dismissedAt: new Date().toISOString() };
    const next = { ...base, leakReviews: [...base.leakReviews, after], audit: [...base.audit, audit('leak review', after.id, null, after)] };
    await applySaved(next);
    setMessage('Review dismissed. Changed entries can bring it back for review.');
  }
  async function saveExtension<K extends 'expenseFunding' | 'settings' | 'incomeSources' | 'monthReviews' | 'balanceReconciliations'>(table: K, route: string, input: unknown, validate: (input: unknown, state: State) => State[K][number]) {
    const base = mode === 'local' ? localSnapshot() : state;
    const after = mode === 'sheets' ? await api<State[K][number]>(route, input) : validate(input, base);
    const before = base[table].find(r => r.id === after.id) ?? null;
    const next = { ...base, [table]: [...base[table].filter(r => r.id !== after.id), after], audit: [...base.audit, audit(route, after.id, before, after)] };
    await applySaved(next);
    setMessage('Saved. Previous versions stay in history.');
  }
  const saveReconciliation = (v: unknown) => saveExtension('balanceReconciliations', 'balance-reconciliations', v, validateReconciliation);
  const saveFunding = (v: ExpenseFunding) => saveExtension('expenseFunding', 'expense-funding', v, validateFunding);
  const saveSettings = (v: TrackerSettings) => saveExtension('settings', 'settings', v, validateSettings);
  const saveSource = (v: IncomeSource) => saveExtension('incomeSources', 'income-sources', v, validateIncomeSource);
  const saveMonthReview = (v: MonthReview) => saveExtension('monthReviews', 'month-reviews', v, validateMonthReview);
  function reviewDay(date: string) { setScope('All'); setMonth(date.slice(0, 7)); setLedgerDate(date); setPage('Transactions'); window.scrollTo({ top: 0 }); }
  function addAction(preset?: Partial<FinancialAction>) { setActionEdit(undefined); setActionPreset(preset); setActionOpen(true); }
  function editAction(action: FinancialAction) { setActionEdit(action); setActionPreset(undefined); setActionOpen(true); }
  function download() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `cash-flow-backup-${localDate()}.json`; a.click(); URL.revokeObjectURL(url); setMessage('Backup downloaded, including transaction history.');
  }
  function startTransaction(type: TransactionType) { setEdit(undefined); setDraftType(type); setTransactionOpen(true); }
  const add = () => startTransaction('Expense'), onEdit = (t: Transaction) => { setEdit(t); setTransactionOpen(true); };
  const planned = monthBudgets(state, month, scope).reduce((n, b) => n + b.amountCents, 0), spent = summarize(scopedTransactions(state, month, scope)).expenses;
  if (mode === 'login') return <Login onSuccess={() => void load()} />;
  if (mode === 'loading' || mode === 'error') return <div className="login-screen"><div className="panel login-card"><span className="brand-mark"><Coins size={25} /></span><h1>{mode === 'loading' ? 'Loading tracker…' : 'Connection unavailable'}</h1>{mode === 'loading' ? <LoaderCircle className="spin" /> : <><p role="alert">{error}</p><button className="button primary" onClick={() => void load()}>Try again<RefreshCw size={17} /></button></>}</div></div>;
  return <div className="app-shell" data-page={page}><a className="skip-link" href="#main">Skip to content</a><aside className="sidebar"><a href="#" className="brand" onClick={e => { e.preventDefault(); setPage('Dashboard'); }}><span className="brand-mark"><Coins size={23} /></span><span>Cash Flow<span className="brand-sub">TRACKER</span></span></a><div className="workspace"><span className="avatar">G</span><span><strong>My money space</strong><small>Personal & GODZ-i LLC</small></span><ShieldCheck size={16} /></div><span className="nav-label">YOUR OVERVIEW</span><nav aria-label="Main navigation">{navigation.map(({ name, icon: Icon }) => <button key={name} aria-label={name} className={`nav-link ${page === name ? 'active' : ''}`} aria-current={page === name ? 'page' : undefined} onClick={() => { setPage(name); setLedgerDate(''); window.scrollTo({ top: 0 }); }}><Icon size={20} /><span>{name}</span>{page === name && <span className="nav-dot" />}</button>)}</nav><button className="button primary sidebar-add" onClick={add}><Plus size={18} />Add transaction</button><div className="sidebar-bottom"><div className="sidebar-plan"><span>THIS MONTH’S PLAN<Leaf size={15} /></span><strong>{money(planned - spent)}</strong><p>left in your monthly plan</p><Progress value={planned ? spent / planned * 100 : 0} /><small>{money(spent)} of {money(planned)}</small></div><button className="sidebar-help" onClick={() => setHelp(true)}><CircleHelp size={18} />Help & connection<ArrowUpRight size={15} /></button></div></aside>
    <div className="main-shell"><header className="topbar"><span className="breadcrumb">Cash Flow<span>/</span><strong>{page}</strong></span><div className="topbar-actions"><button className="icon-button mobile-actions-link" aria-label="Notes & Reminders" onClick={() => setPage('Notes & Reminders')}><ClipboardList size={18} /></button><button className="connection-button" onClick={() => setHelp(true)}><span className={`status-dot ${mode === 'local' ? 'local' : ''}`} /><span>{mode === 'local' ? 'On this device' : 'Google Sheets'}</span><Cloud size={15} /></button><button className="icon-button" aria-label="Refresh data" title="Refresh data" disabled={refreshing} onClick={() => void load()}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /></button><button className="profile-button" aria-label="Open help and connection" onClick={() => setHelp(true)}>G</button></div></header>
    <main id="main" className="main-content"><div className="page-heading"><div><h1>{pageTitles[page]}</h1></div><button className="button primary heading-add" onClick={add}><Plus size={18} /><span>Add transaction</span></button></div>{page === 'Dashboard' && <BalanceHero state={state} onActionsVisible={setHeroActionsVisible} onRecord={startTransaction} onAccounts={() => { setPage('Accounts'); setScope('All'); }} />}<div className="view-toolbar">{page !== 'Notes & Reminders' && <div className="month-picker"><button className="icon-button" aria-label="Previous month" onClick={() => setMonth(stepMonth(month, -1))}><ChevronLeft size={18} /></button><label><CalendarDays size={17} /><span>{monthLabel(month)}</span><input aria-label="Select month" type="month" value={month} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value); }} /></label><button className="icon-button" aria-label="Next month" onClick={() => setMonth(stepMonth(month, 1))}><ChevronRight size={18} /></button></div>}<div className="segmented scope-picker" aria-label="Account scope" style={page === 'Check-In History' ? { display: 'none' } : undefined}>{(['Personal', 'Business', 'All'] as const).map(s => <button key={s} aria-pressed={scope === s} className={scope === s ? 'active' : ''} onClick={() => setScope(s)}>{s}</button>)}</div><span className="toolbar-note"><ShieldCheck size={14} />{page === 'Check-In History' ? 'Every account and classification' : scope === 'All' ? 'All accounts in view' : page === 'Accounts' ? `${scope} account ownership` : `${scope} view`}</span></div>
      <nav className="extension-nav" aria-label="Financial review navigation"><button className="text-button" aria-label="View money flow" onClick={() => setPage('Money Flow')}>Money flow</button><button className="text-button" aria-label="Review check-in history" onClick={() => setPage('Check-In History')}>Check-in history</button><button className="text-button" aria-label="View month-end review" onClick={() => setPage('Month-End Review')}>Month-end review</button><button className="text-button" aria-label="Tracker settings" onClick={() => setSettingsOpen(true)}>Settings</button></nav>
      {mode === 'local' && <div className="local-notice"><span className="status-dot local" /><span>Device-only storage. Export backups regularly.</span><button className="text-button" onClick={() => setHelp(true)}>Storage & backup<ArrowRight size={14} /></button></div>}
      {page === 'Dashboard' && <><Dashboard state={state} month={month} scope={scope} add={add} onEdit={onEdit} go={setPage} awareness={<><DailyCheckInCard state={state} today={today} onConfirm={confirmCheckIn} onReview={reviewDay} onHistory={() => { setMonth(today.slice(0, 7)); setPage('Check-In History'); }} onSettings={() => setSettingsOpen(true)} /><IncomeAllocation state={state} month={month} /><div className="awareness-grid"><FinancialActionsCard state={state} scope={scope} today={today} onAdd={() => addAction()} onEdit={editAction} onOpen={() => setPage('Notes & Reminders')} /><DailyFinancialAxiom today={today} /></div></>} /><div className="awareness-after"><FinancialLeakPanel state={state} month={month} scope={scope} today={today} onCreate={addAction} onDismiss={dismissLeak} onEditTransaction={onEdit} compact onOpen={() => setPage('Insights')} /></div></>}{page === 'Transactions' && <Ledger state={state} month={month} scope={scope} onEdit={onEdit} add={add} presetDate={ledgerDate} />}{page === 'Budget' && <><BudgetView state={state} month={month} scope={scope} onEdit={setBudgetEdit} /><FundingSection state={state} month={month} scope={scope} onEdit={setFundingEdit} /></>}{page === 'Accounts' && <AccountsView state={state} month={month} scope={scope} onEdit={setAccountEdit} onReconcile={setComparisonAccount} />}{page === 'Insights' && <><Insights state={state} month={month} scope={scope} /><div className="awareness-after"><FinancialLeakPanel state={state} month={month} scope={scope} today={today} onCreate={addAction} onDismiss={dismissLeak} onEditTransaction={onEdit} /></div></>}
      {page === 'Money Flow' && <MoneyFlow state={state} month={month} scope={scope} onAddSource={() => { setSourceEdit(undefined); setSourceOpen(true); }} onEditSource={s => { setSourceEdit(s); setSourceOpen(true); }} />}
      {page === 'Check-In History' && <CheckInHistory key={month} state={state} month={month} today={today} onConfirm={confirmCheckIn} onReview={reviewDay} />}
      {page === 'Month-End Review' && <><MonthEndReview key={`${month}-${scope}`} state={state} month={month} scope={scope} onSave={saveMonthReview} /><FinancialLeakPanel state={state} month={month} scope={scope} today={today} onCreate={addAction} onDismiss={dismissLeak} onEditTransaction={onEdit} /></>}
      {page === 'Notes & Reminders' && <NotesReminders state={state} scope={scope} today={today} onAdd={() => addAction()} onEdit={editAction} onSave={saveAction} />}<footer className="page-footer"><button className="text-button" onClick={download}><Download size={14} />Export backup</button></footer></main></div>
    {!(page === 'Dashboard' && heroActionsVisible) && <button className="mobile-add" aria-label="Add transaction" onClick={add}><Plus size={23} /><span>Add transaction</span></button>}<nav className="mobile-nav" aria-label="Mobile navigation">{navigation.filter(item => ['Dashboard', 'Transactions', 'Budget', 'Accounts', 'Insights'].includes(item.name)).map(({ name, icon: Icon }) => <button key={name} aria-label={name} className={page === name ? 'active' : ''} aria-current={page === name ? 'page' : undefined} onClick={() => { setPage(name); setLedgerDate(''); window.scrollTo({ top: 0 }); }}><Icon size={21} /><span>{name === 'Transactions' ? 'Entries' : name === 'Dashboard' ? 'Home' : name}</span></button>)}</nav>
    <div className={`toast ${message ? 'visible' : ''}`} role="status" aria-live="polite">{message && <><Check size={17} />{message}</>}</div>
    {fundingEdit && <FundingForm state={state} budget={fundingEdit} month={month} onSave={saveFunding} onClose={() => setFundingEdit(undefined)} />}
    {settingsOpen && <SettingsForm state={state} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
    {sourceOpen && <IncomeSourceForm state={state} edit={sourceEdit} onSave={saveSource} onClose={() => setSourceOpen(false)} />}
    {actionOpen && <ActionForm state={state} scope={scope} edit={actionEdit} preset={actionPreset} onClose={() => setActionOpen(false)} onSave={saveAction} />}{transactionOpen && <TransactionForm state={state} edit={edit} initialType={draftType} onClose={() => setTransactionOpen(false)} onSave={saveTransaction} aiEnabled={aiEnabled} />}
    {comparisonAccount && <ReconciliationForm state={state} account={state.accounts.find(a => a.id === comparisonAccount.id)!} onSave={saveReconciliation} onClose={() => setComparisonAccount(undefined)} />}
    {accountEdit && <ValueEditor title="Update account balance" label={`${accountEdit.name} •••• ${accountEdit.lastFour}`} initial={currentBalance(state, accountEdit)} allowNegative snapshot note="Enter the balance shown by your bank. This explicitly resets the opening snapshot; later dated movements update the displayed balance. To check for discrepancies without resetting it, use Compare actual balance." onClose={() => setAccountEdit(undefined)} onSave={saveBalance} />}
    {budgetEdit && <ValueEditor title={`Plan for ${budgetEdit.label}`} label="Planned amount ($)" initial={budgetEdit.amountCents} note={`Changes apply only to ${monthLabel(month)}. Other months keep their plans.`} onClose={() => setBudgetEdit(undefined)} onSave={saveBudget} />}
    {help && <Modal title="Storage & backup" onClose={() => setHelp(false)}><div className="help-content"><span className="connection-label"><span className={`status-dot ${mode === 'local' ? 'local' : ''}`} />{mode === 'local' ? 'On-device storage' : 'Connected to Google Sheets'}</span><p>{mode === 'local' ? 'Entries are saved in this browser on this device. Download backups regularly. Clearing browser data removes these entries.' : 'Your transactions, accounts, and monthly plans are stored in your private Google Sheet. Edits preserve previous records.'}</p>{mode === 'local' && <><h3>Connect Google Sheets</h3><p>Follow the project’s setup guide to connect a private spreadsheet and set your app password. Your on-device entries are not automatically moved to Sheets; export a backup before switching.</p><a className="button secondary" href="https://github.com/Godz-iAgency/Cash-Flow-Tracker#google-sheets-setup" target="_blank" rel="noreferrer">Open setup guide<ArrowUpRight size={16} /></a></>}<h3>About your starting plan</h3><p>Balances stay unknown until you set opening balances. Income totals come from recorded entries.</p><div className="help-actions"><button className="button secondary" onClick={download}><Download size={16} />Export full backup</button><button className="button secondary" onClick={() => { setHelp(false); setHistory(true); }}><ShieldCheck size={16} />Audit history</button>{mode === 'sheets' && <button className="text-button" onClick={async () => { await api('logout', {}); setHelp(false); setMode('login'); }}><LogOut size={16} />Sign out</button>}</div></div></Modal>}
    {history && <Modal title="Audit history" subtitle="Previous versions are preserved whenever an entry changes." onClose={() => setHistory(false)} wide>{state.audit.length ? <div className="audit-list">{[...state.audit].reverse().map(a => <details key={a.id}><summary><span>{a.entity === 'transaction' ? a.before ? 'Transaction edited' : 'Transaction added' : a.entity === 'account' ? 'Balance updated' : a.entity === 'budget' ? 'Monthly plan updated' : a.entity === 'financial action' ? 'Financial action saved' : a.entity === 'daily check-in' ? 'Daily check-in confirmed' : a.entity === 'leak review' ? 'Review dismissed' : a.entity === 'expense-funding' ? 'Expense funding updated' : a.entity === 'settings' ? 'Tracker settings updated' : a.entity === 'income-sources' ? 'Income source updated' : a.entity === 'balance-reconciliations' ? 'Balance comparison saved' : 'Month review notes saved'}</span><small>{new Date(a.at).toLocaleString()}</small></summary><div className="audit-versions"><div><h3>Before</h3><pre>{JSON.stringify(a.before, null, 2)}</pre></div><div><h3>After</h3><pre>{JSON.stringify(a.after, null, 2)}</pre></div></div></details>)}</div> : <Empty title="No changes recorded" text="Added and edited records appear here." />}</Modal>}
  </div>;
}
