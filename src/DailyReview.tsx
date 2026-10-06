import { friendlyError } from './words';
import { useEffect, useState } from 'react';
import { CalendarDays, ClipboardCheck, Check } from 'lucide-react';
import { localDate, money, type State } from '../shared/model';
import { transactionFingerprint, type DailyCheckIn } from '../shared/actions';
import { checkInHistory, checkInStatus, dailyMovement, settingsFor } from '../shared/allocation';
import { dateLabel } from './financialActions';
import { monthLabel } from './components';
export type ConfirmDay = (input: Pick<DailyCheckIn, 'date' | 'scope' | 'revision' | 'transactionFingerprint'>) => Promise<void>;
function Confirmation({ state, date, today, onConfirm, onReview }: { state: State; date: string; today: string; onConfirm: ConfirmDay; onReview: (date: string) => void }) {
  const status = checkInStatus(state, date), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function confirm() { setBusy(true); setError(''); try { await onConfirm({ date, scope: 'All', revision: status.record?.revision ?? 0, transactionFingerprint: transactionFingerprint(state, date, 'All') }); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } }
  return <><div className="check-in-buttons"><button className="button secondary" onClick={() => onReview(date)}>{date === today ? 'Review Today' : 'Review Transactions'}</button><button className="button primary" disabled={busy || status.complete || date > today} onClick={() => void confirm()}><Check size={16} />{busy ? 'Saving…' : status.complete ? 'Complete' : 'Confirm entries'}</button></div>{status.changed && <p className="panel-note">{date === today ? 'Today’s' : 'This day’s'} entries changed after confirmation. Review and confirm this day again.</p>}{error && <p className="form-error" role="alert">{error}</p>}</>;
}
export function DailyCheckIn({ state, today, onConfirm, onReview }: { state: State; today: string; onConfirm: ConfirmDay; onReview: (date: string) => void }) {
  const daily = dailyMovement(state, today), status = checkInStatus(state, today);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const update = () => setNow(new Date()); const timer = setInterval(update, 30000); window.addEventListener('focus', update); return () => { clearInterval(timer); window.removeEventListener('focus', update); }; }, []);
  const settings = settingsFor(state), time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const reviewDue = !status.complete && time >= settings.reminderTime;
  return <section className="panel check-in-card">
    <div className="panel-heading"><div><h2>Today’s review</h2><p>{dateLabel(today)} · All accounts</p></div><span role={reviewDue ? 'status' : undefined} className={`check-status ${status.complete ? 'complete' : ''}`}>{status.complete ? 'Complete' : reviewDue ? 'Review due' : 'Pending'}</span></div>
    <p className="check-in-summary">{money(daily.expenses)} spent · {daily.count} {daily.count === 1 ? 'transaction' : 'transactions'}</p>
    <Confirmation state={state} date={today} today={today} onConfirm={onConfirm} onReview={onReview} />
  </section>;
}
export function CheckInHistory({ state, month, today, onConfirm, onReview }: { state: State; month: string; today: string; onConfirm: ConfirmDay; onReview: (date: string) => void }) {
  const history = checkInHistory(state, month, today), [date, setDate] = useState(month === today.slice(0, 7) ? today : `${month}-01`);
  const movement = dailyMovement(state, date), status = checkInStatus(state, date);
  return <><div className="ledger-summary"><div><span>Consecutive check-in days</span><strong>{history.consecutive}</strong></div><div><span>Completed days this month</span><strong>{history.completed}</strong></div><div><span>Missed days this month</span><strong>{history.missed}</strong></div></div><p className="panel-note">Every day is shown. Today remains pending until confirmed; future days are upcoming. A changed entry requires another review. All accounts are included.</p><section className="panel"><div className="panel-heading"><h2>{monthLabel(month)} · Review history</h2><CalendarDays size={20} /></div><div className="check-calendar">{history.entries.map(e => <button key={e.date} className={`${e.complete ? 'complete' : ''} ${e.date === date ? 'selected' : ''}`} disabled={e.future} onClick={() => setDate(e.date)} aria-label={`${dateLabel(e.date)}: ${e.future ? 'Upcoming' : e.complete ? 'Complete' : e.date < today ? 'Missing' : 'Not checked in'}`}><strong>{Number(e.date.slice(-2))}</strong><span>{e.future ? 'Upcoming' : e.complete ? 'Complete' : e.date < today ? 'Missing' : 'Pending'}</span></button>)}</div></section><section className="panel day-review" key={date}><div className="panel-heading"><div><h2>{dateLabel(date)}</h2><p>{status.complete ? 'Complete' : 'Not checked in'} · {movement.count} recorded transactions</p></div><ClipboardCheck size={20} /></div><div className="plan-lines"><div><span>Income</span><strong>{money(movement.income)}</strong></div><div><span>Spending</span><strong>{money(movement.expenses)}</strong></div><div><span>Transfers</span><strong>{money(movement.transfers)}</strong></div></div><h3>Is every dollar that moved on this day recorded?</h3><Confirmation state={state} date={date} today={today} onConfirm={onConfirm} onReview={onReview} />{status.record && <p className="panel-note">Last confirmed {new Date(status.record.confirmedAt).toLocaleString()} · {status.record.transactionsReviewed ?? JSON.parse(status.record.transactionFingerprint).length} transactions reviewed</p>}</section></>;
}
