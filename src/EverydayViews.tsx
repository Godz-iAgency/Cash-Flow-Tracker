import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, ChevronDown, Pencil, Plus } from 'lucide-react';
import { accountFlows, budgetSpent, money, monthBudgets, scopedTransactions, summarize, type Account, type Budget, type Scope, type State, type Transaction } from '../shared/model';
import type { IncomeSource } from '../shared/allocation';
import { EntryRows, Metric } from './SimpleViews';
import type { ReactNode } from 'react';

type View = { state: State; month: string; scope: Scope | 'All' };
export function WaterCard({ children, variant = 'surface', className = '' }: { children: ReactNode; variant?: 'surface' | 'flow'; className?: string }) {
  return <section className={`water-photo water-${variant} ${className}`}><div className="water-copy">{children}</div></section>;
}
export function IncomeView({ state, month, scope, onAdd, onAddSource, onEditSource, onPaid, onEdit }: View & { onAdd: () => void; onAddSource: () => void; onEditSource: (s: IncomeSource) => void; onPaid: (s: IncomeSource) => void; onEdit: (t: Transaction) => void }) {
  const entries = scopedTransactions(state, month, scope).filter(t => t.type === 'Income');
  const sources = state.incomeSources.filter(s => scope === 'All' || s.scope === scope);
  return <div className="everyday-view"><WaterCard variant="flow"><span className="water-label">Received this month</span><strong className="water-value">{money(summarize(entries).income)}</strong><button className="text-button" onClick={onAdd}>I got paid<ArrowDownLeft size={17} /></button></WaterCard>
    <section className="simple-section"><div className="section-head water-section-head"><h2>Income sources</h2><button className="text-button" onClick={onAddSource}><Plus size={16} />Add source</button></div><div className="clean-list">{sources.map(s => <div className="source-row" key={s.id}><span className="list-copy"><strong>{s.name}</strong><small>{s.scope}{s.defaultAccountId && ` · ${state.accounts.find(a => a.id === s.defaultAccountId)?.name ?? 'Choose an account'}`}</small></span><button className="text-button" aria-label={`Edit ${s.name}`} onClick={() => onEditSource(s)}><Pencil size={15} /><span>Edit</span></button><button className="button secondary" onClick={() => onPaid(s)}>Add pay</button></div>)}{!sources.length && <p className="quiet-empty">Add a job or a business that pays you.</p>}</div></section>
    <details className="simple-disclosure"><summary>Payments received<ChevronDown size={17} /></summary><div className="disclosure-body"><EntryRows state={state} entries={entries} onEdit={onEdit} empty="No payments added this month yet." /></div></details>
  </div>;
}
export function ExpensesView({ state, month, scope, onEdit, onAdd, onPay, onEntries }: View & { onEdit: (b: Budget) => void; onAdd: () => void; onPay: (b: Budget) => void; onEntries: (title: string, entries: Transaction[]) => void }) {
  const bills = monthBudgets(state, month, scope), entries = scopedTransactions(state, month, scope).filter(t => t.type === 'Expense');
  return <div className="everyday-view"><WaterCard className="small-water-card"><span className="water-label">Spent this month</span><button className="water-value value-link" onClick={() => onEntries('Spent this month', entries)}>{money(summarize(entries).expenses)}<ArrowUpRight size={20} /></button></WaterCard>
    <section className="simple-section"><div className="section-head water-section-head"><h2>My expense list</h2><button className="text-button" onClick={onAdd}><Plus size={16} />Add item</button></div>
      <p className="list-hint" id="paid-help">Check Paid to record a payment. Open a checked box to review it.</p>
      <div className="clean-list expense-list">{bills.map(b => { const payments = entries.filter(t => budgetSpent(b, [t]) > 0), spent = budgetSpent(b, entries), paid = spent >= b.amountCents && spent > 0; return <div className="expense-row" key={b.id}>
        <label className="paid-check"><input type="checkbox" aria-label={`Paid ${b.label}`} aria-describedby="paid-help" checked={paid} onChange={() => paid ? onEntries(`${b.label} payments`, payments) : onPay(b)} /><span>Paid</span></label>
        <button className="list-copy expense-name" onClick={() => onEntries(`${b.label} payments`, payments)}><strong>{b.label}</strong><small>{scope === 'All' ? `${b.scope} · ` : ''}{spent > 0 && !paid ? `${money(Math.max(0, b.amountCents - spent))} left` : b.category}</small></button>
        <span className="list-amount">{money(b.amountCents)}</span><button className="text-button edit-expense" aria-label={`Edit ${b.label}`} onClick={() => onEdit(b)}><Pencil size={15} /><span>Edit</span></button>
      </div>; })}{!bills.length && <p className="quiet-empty">No expense items here yet.</p>}</div></section>
    <details className="simple-disclosure"><summary>What I spent<ChevronDown size={17} /></summary><div className="disclosure-body"><EntryRows state={state} entries={entries} onEdit={t => onEntries(t.merchant || t.subcategory, [t])} empty="Nothing spent this month yet." /></div></details>
  </div>;
}
function accountName(state: State, id: string | undefined) { const a = state.accounts.find(a => a.id === id); return a ? `${a.name}${a.lastFour ? ` · ${a.lastFour}` : ''}` : 'Account no longer listed'; }
export function CashFlowView({ state, month, scope, onEdit, onMove, banks }: View & { onEdit: (t: Transaction) => void; onMove: () => void; banks: ReactNode }) {
  const rows = scopedTransactions(state, month, scope);
  return <div className="everyday-view"><WaterCard variant="flow" className="flow-water-card"><span className="water-label">Between my accounts</span><button className="water-action" onClick={onMove}><ArrowLeftRight size={23} />Move money<ArrowRight size={19} /></button></WaterCard>
    <details className="simple-disclosure bank-list" open><summary>Banks &amp; cards<ChevronDown size={17} /></summary><div className="disclosure-body">{banks}</div></details>
    <section className="simple-section"><div className="section-head water-section-head"><h2>Where money went</h2></div><div className="clean-list movement-list">{rows.map(t => { const from = t.type === 'Income' ? t.merchant || 'Income' : accountName(state, t.accountId), to = t.type === 'Income' ? accountName(state, t.accountId) : t.type === 'Transfer' ? accountName(state, t.toAccountId) : t.merchant || t.subcategory || 'Expense', Icon = t.type === 'Income' ? ArrowDownLeft : t.type === 'Transfer' ? ArrowLeftRight : ArrowUpRight; return <button className="movement-row" key={t.id} onClick={() => onEdit(t)}><span className="entry-symbol"><Icon size={18} /></span><span className="movement-copy"><small>{new Date(`${t.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {t.type === 'Income' ? 'Received' : t.type === 'Transfer' ? 'Moved' : 'Spent'}</small><span className="movement-path"><strong>{from}</strong><ArrowRight size={15} /><strong>{to}</strong></span></span><span className="list-amount">{money(t.amountCents)}</span><ArrowRight size={15} /></button>; })}{!rows.length && <p className="quiet-empty">No money moves added this month yet.</p>}</div></section></div>;
}
export function IncomeStatement({ state, month, scope }: View) {
  const totals = summarize(scopedTransactions(state, month, scope));
  return <div className="disclosure-body"><div className="simple-metrics"><Metric label="Money received" value={money(totals.income)} /><Metric label="Money spent" value={money(totals.expenses)} /><Metric label="Left over" value={money(totals.net)} warning={totals.net < 0} /></div><p className="panel-note">From your entries. Moving money between accounts does not count as income or spending.</p></div>;
}
export function CashStatement({ state, month, scope }: View) {
  // Both ends of a cross-scope transfer are included for the selected bank.
  const entries = scopedTransactions(state, month, 'All'), accounts = state.accounts.filter(a => a.type !== 'Credit card' && (scope === 'All' || a.scope === scope));
  return <div className="disclosure-body"><p className="panel-note">Money in and out of each bank account, including transfers. A card payment appears when money leaves the bank.</p>{accounts.map((a: Account) => { const flow = accountFlows(a.id, entries); return <details className="statement-account plain-disclosure" key={a.id}><summary>{a.name} · {a.lastFour}</summary><div className="simple-metrics"><Metric label="Money in" value={money(flow.inflows)} /><Metric label="Money out" value={money(flow.outflows)} /><Metric label="Change" value={money(flow.inflows - flow.outflows)} /></div></details>; })}</div>;
}
