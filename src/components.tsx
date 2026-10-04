import { useEffect, useRef, useId, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, X, Leaf, Pencil } from 'lucide-react';
import { money, summarize, type TransactionType, type Transaction, type State } from '../shared/model';
export const monthLabel = (month: string, short = false) => new Date(`${month}-15T12:00:00`).toLocaleDateString('en-US', { month: short ? 'short' : 'long', year: 'numeric' });
export function IconBox({ type, small = false }: { type: TransactionType; small?: boolean }) {
  const Icon = type === 'Income' ? ArrowDownLeft : type === 'Transfer' ? ArrowLeftRight : ArrowUpRight;
  return <span className={`icon-box ${type.toLowerCase()} ${small ? 'small' : ''}`}><Icon size={small ? 16 : 20} /></span>;
}
export function Progress({ value, className = '' }: { value: number; className?: string }) {
  const percentage = Math.max(0, Math.min(100, value));
  return <div className={`progress ${value > 100 ? 'over' : ''} ${className}`} role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used"><span style={{ width: `${percentage}%` }} /></div>;
}
export function Empty({ title, text, action, onClick }: { title: string; text: string; action?: string; onClick?: () => void }) {
  return <div className="empty"><span className="empty-icon"><Leaf size={24} /></span><h3>{title}</h3><p>{text}</p>{action && <button className="button secondary" onClick={onClick}>{action}</button>}</div>;
}
export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => { const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]'); (first ?? ref.current)?.focus(); });
    function handle(event: KeyboardEvent) {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') {
        const elements = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])];
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', handle);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handle); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><div className="modal-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21} /></button></div><div className="modal-content" tabIndex={0} role="region" aria-label={`${title} content`}>{children}</div></div></div>;
}
export function TransactionList({ transactions, state, onEdit, compact = false }: { transactions: Transaction[]; state: State; onEdit: (t: Transaction) => void; compact?: boolean }) {
  return <div className={`transaction-list ${compact ? 'compact' : ''}`}>
    {!compact && <div className="transaction-table-head"><span>Transaction</span><span>Category</span><span>Account</span><span>Amount</span></div>}
    {transactions.map(t => { const account = state.accounts.find(a => a.id === t.accountId), destination = state.accounts.find(a => a.id === t.toAccountId); return <button className="transaction-row" key={t.id} onClick={() => onEdit(t)} aria-label={`Edit ${t.merchant || t.description}, ${money(t.amountCents)}`}><span className="transaction-main"><IconBox type={t.type} /><span><strong>{t.merchant || t.description}</strong><small>{new Date(`${t.date}T${t.time}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {t.time}{compact ? ` · ${t.subcategory || t.category}` : ''} · {t.scope} · •••• {account?.lastFour}{t.type === 'Transfer' && ` → •••• ${destination?.lastFour}`}</small></span></span>{!compact && <><span className="transaction-category"><span>{t.subcategory || t.category}</span><small>{t.category}{t.classification && ` · ${t.classification}`}</small></span><span className="transaction-account"><span>{account?.name.replace(' Personal', '').replace(' Business', '')}{t.type === 'Transfer' && ` → ${destination?.name.replace(' Personal', '').replace(' Business', '')}`}</span><small>•••• {account?.lastFour}{t.type === 'Transfer' && ` → •••• ${destination?.lastFour}`} · {t.scope}</small></span></>}<span className={`transaction-amount ${t.type.toLowerCase()}`}><strong>{t.type === 'Income' ? '+' : t.type === 'Expense' ? '−' : ''}{money(t.amountCents)}</strong><small>{t.type === 'Transfer' ? 'Transfer' : t.classification || t.type}<Pencil size={12} /></small></span></button>; })}
  </div>;
}
export function ActivityChart({ transactions, month }: { transactions: Transaction[]; month: string }) {
  const chartId = useId();
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const values = Array.from({ length: days }, (_, i) => summarize(transactions.filter(t => Number(t.date.slice(-2)) === i + 1)));
  const max = Math.max(100, ...values.flatMap(v => [v.income, v.expenses]));
  const point = (value: number, index: number) => ((index + .5) / days * 800).toFixed(2) + ',' + (200 - value / max * 200).toFixed(2);
  const line = (key: 'income' | 'expenses') => values.map((v, i) => (i ? 'L' : 'M') + point(v[key], i)).join(' ');
  const area = (key: 'income' | 'expenses') => line(key) + ' L' + ((days - .5) / days * 800).toFixed(2) + ',200 L' + (.5 / days * 800).toFixed(2) + ',200 Z';
  return <div className="activity-chart"><div className="chart-bars" role="img" aria-label={`Daily income and expenses for ${monthLabel(month)}`}>
    {[100, 50, 0].map(y => <div className="chart-guide" key={y} style={{ bottom: `${y}%` }}><span>{money(Math.round(max * y / 100))}</span></div>)}
    <svg className="cash-chart" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={chartId + '-income'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".28" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient><linearGradient id={chartId + '-spent'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold)" stopOpacity=".14" /><stop offset="100%" stopColor="var(--gold)" stopOpacity="0" /></linearGradient></defs>{(['income', 'expenses'] as const).map(key => values.some(v => v[key] > 0) && <g key={key}><path d={area(key)} fill={'url(#' + chartId + '-' + (key === 'income' ? 'income' : 'spent') + ')'} /><path d={line(key)} className={key === 'income' ? 'income-line' : 'expense-line'} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></g>)}{values.map((v, i) => <rect key={i} x={i / days * 800} y="0" width={800 / days} height="200" fill="transparent"><title>{monthLabel(month, true)} {i + 1}: income {money(v.income)}, spent {money(v.expenses)}</title></rect>)}</svg>
  </div><div className="chart-x"><span>1 {monthLabel(month, true).split(' ')[0]}</span><span>10</span><span>20</span><span>{days}</span></div>{!transactions.some(t => t.type !== 'Transfer') && <span className="chart-empty">Your cash flow will take shape here.</span>}</div>;
}
export function MoneyCard({ label, value, note, icon, className = '' }: { label: string; value: number; note: string; icon: ReactNode; className?: string }) {
  return <article className={`money-card ${className}`}><div className="money-card-top"><span>{label}</span><span className="money-icon">{icon}</span></div><h2>{money(value)}</h2><p>{note}</p></article>;
}
