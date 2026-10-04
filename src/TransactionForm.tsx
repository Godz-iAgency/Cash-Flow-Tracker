import { useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Check, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { localDate, parseCents, validateTransaction, type State, type Transaction, type TransactionType, type Scope } from '../shared/model';
import { IconBox, Modal } from './components';
import { fundingFor } from '../shared/allocation';
import { api } from './api';
export default function TransactionForm({ state, edit, onClose, onSave, aiEnabled }: { state: State; edit?: Transaction; onClose: () => void; onSave: (t: Transaction) => Promise<void>; aiEnabled: boolean }) {
  const now = new Date();
  const [type, setType] = useState<TransactionType>(edit?.type ?? 'Expense');
  const [amount, setAmount] = useState(edit ? (edit.amountCents / 100).toFixed(2) : '');
  const [merchant, setMerchant] = useState(edit?.merchant || edit?.description || '');
  const [description, setDescription] = useState(edit?.description ?? '');
  const [category, setCategory] = useState(edit?.category ?? 'Food');
  const [subcategory, setSubcategory] = useState(edit?.subcategory ?? 'Grocery');
  const [accountId, setAccountId] = useState(edit?.accountId ?? '');
  const [scope, setScope] = useState<Scope>(edit?.scope ?? 'Personal');
  const [toAccountId, setToAccountId] = useState(edit?.toAccountId ?? '');
  const [classification, setClassification] = useState<'Need' | 'Want' | ''>(edit?.classification || 'Need');
  const [date, setDate] = useState(edit?.date ?? localDate());
  const [time, setTime] = useState(edit?.time ?? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  const [notes, setNotes] = useState(edit?.notes ?? '');
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [details, setDetails] = useState(Boolean(edit));
  const [aiOpen, setAiOpen] = useState(false), [aiText, setAiText] = useState(''), [aiBusy, setAiBusy] = useState(false), [review, setReview] = useState('');
  const id = useRef(edit?.id ?? crypto.randomUUID());
  const items = state.budgets.filter(b => b.category === category && b.scope === scope).filter((b, i, all) => all.findIndex(v => v.label === b.label) === i);
  async function draft() {
    setError(''); setAiBusy(true);
    try {
      const result = await api<Record<string, unknown>>('ai/draft', { text: aiText, date: localDate() });
      if (['Expense', 'Income', 'Transfer'].includes(String(result.type))) setType(result.type as TransactionType);
      if (typeof result.amount === 'string') { parseCents(result.amount); setAmount(result.amount); } else setAmount('');
      setMerchant(typeof result.merchant === 'string' ? result.merchant : '');
      setCategory(state.categories.some(c => c.name === result.category) ? String(result.category) : '');
      setSubcategory(typeof result.subcategory === 'string' ? result.subcategory : '');
      setAccountId(state.accounts.some(a => a.id === result.accountId) ? String(result.accountId) : '');
      setToAccountId(state.accounts.some(a => a.id === result.toAccountId) ? String(result.toAccountId) : '');
      setScope(result.scope === 'Personal' || result.scope === 'Business' ? result.scope : scope);
      setClassification(result.classification === 'Need' || result.classification === 'Want' ? result.classification : '');
      if (typeof result.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) setDate(result.date);
      if (typeof result.time === 'string' && /^\d{2}:\d{2}$/.test(result.time)) setTime(result.time);
      setReview(`Review every field before saving.${Array.isArray(result.uncertainties) && result.uncertainties.length ? ` Please confirm: ${result.uncertainties.map(String).join(', ')}.` : ''}`);
      setAiOpen(false); setDetails(true);
    } catch (e) { setError((e as Error).message); } finally { setAiBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      const transaction = validateTransaction({ id: id.current, type, amountCents: parseCents(amount), merchant, description, category, subcategory, accountId, toAccountId, scope, classification, date, time, notes, revision: edit?.revision }, state, edit);
      await onSave(edit ? { ...transaction, revision: edit.revision } : transaction);
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <Modal title={edit ? 'Edit transaction' : 'Add a transaction'} subtitle={edit ? 'Your previous entry stays in the audit history.' : 'Every cent counts. Capture it while it’s fresh.'} onClose={onClose}>
    <form onSubmit={submit} className="transaction-form">
      <div className="segmented transaction-types" aria-label="Transaction type">{(['Expense', 'Income', 'Transfer'] as const).map(t => <button key={t} type="button" aria-pressed={type === t} className={type === t ? 'active' : ''} onClick={() => { setType(t); setCategory(t === 'Income' ? 'Employment' : 'Food'); setSubcategory(t === 'Expense' ? 'Grocery' : ''); }}><IconBox type={t} small />{t}</button>)}</div>
      {aiEnabled && !edit && <><button type="button" className="ai-link" onClick={() => setAiOpen(!aiOpen)}><Sparkles size={16} />Describe a transaction</button>{aiOpen && <div className="ai-entry"><label htmlFor="ai-text">What happened?</label><textarea id="ai-text" value={aiText} maxLength={2000} onChange={e => setAiText(e.target.value)} placeholder="Spent $6.42 at H-E-B on candy using Capital One checking." /><button className="button secondary" type="button" disabled={!aiText.trim() || aiBusy} onClick={draft}>{aiBusy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}Create draft</button><p>Gemini proposes an entry. You review and save it.</p></div>}</>}
      {review && <div className="notice" role="status"><ShieldCheck size={18} /><span>{review}</span></div>}
      <label className="amount-label" htmlFor="amount">Amount<span className="amount-input"><span aria-hidden="true">$</span><input data-autofocus id="amount" inputMode="decimal" placeholder="0.00" required value={amount} onChange={e => setAmount(e.target.value)} autoComplete="off" /></span></label>
      <label htmlFor="merchant">{type === 'Income' ? 'Income source' : type === 'Transfer' ? 'Transfer description' : 'Merchant / payee'}<input id="merchant" placeholder={type === 'Income' ? 'e.g. Paycheck' : type === 'Transfer' ? 'e.g. Move to savings' : 'e.g. H-E-B, coffee, rent'} value={merchant} onChange={e => setMerchant(e.target.value)} maxLength={200} required /></label>
      <label htmlFor="transaction-scope">Personal or Business<select id="transaction-scope" value={scope} onChange={e => { setScope(e.target.value as Scope); setSubcategory(''); }}><option>Personal</option><option>Business</option></select><span className="field-hint">Classification is independent of the payment account.</span></label>
      {type === 'Income' && state.incomeSources.length > 0 && <label htmlFor="income-source">Saved income source (optional)<select id="income-source" value="" onChange={e => { const source = state.incomeSources.find(s => s.id === e.target.value); if (source) { setMerchant(source.name); setScope(source.scope); setCategory(source.category); setAccountId(source.defaultAccountId); } }}><option value="">Choose a saved source or enter above</option>{state.incomeSources.map(s => <option key={s.id} value={s.id}>{s.name} · {s.scope}</option>)}</select></label>}
      {type !== 'Transfer' && <div className="form-grid"><label htmlFor="category">Category<select id="category" value={category} required onChange={e => { setCategory(e.target.value); setSubcategory(''); }}><option value="" disabled>Choose a category</option>{state.categories.map(c => <option key={c.id}>{c.name}</option>)}</select></label>{type === 'Expense' && <label htmlFor="subcategory">Plan item / subcategory<select id="subcategory" value={items.some(b => b.label === subcategory) ? subcategory : ''} onChange={e => { setSubcategory(e.target.value); const budget = items.find(b => b.label === e.target.value); if (budget) setAccountId(fundingFor(state, budget.id, date.slice(0, 7))?.paymentAccountId ?? ''); }}><option value="">Unplanned / custom</option>{items.map(b => <option key={b.id}>{b.label}</option>)}</select></label>}</div>}
      {type === 'Expense' && !items.some(b => b.label === subcategory) && <label htmlFor="custom-subcategory">Subcategory (optional)<input id="custom-subcategory" value={subcategory} maxLength={100} onChange={e => setSubcategory(e.target.value)} placeholder="e.g. Snacks" /></label>}
      <label htmlFor="account">{type === 'Transfer' ? 'From account' : type === 'Income' ? 'Destination account' : 'Payment account'}<select id="account" value={accountId} required onChange={e => setAccountId(e.target.value)}><option value="" disabled>Choose an account</option>{state.accounts.map(a => <option key={a.id} value={a.id}>{a.name} •••• {a.lastFour} · {a.scope}</option>)}</select></label>
      {type === 'Transfer' && <label htmlFor="to-account">To account<select id="to-account" value={toAccountId} required onChange={e => setToAccountId(e.target.value)}><option value="" disabled>Choose destination</option>{state.accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name} •••• {a.lastFour} · {a.scope}</option>)}</select><span className="field-hint">Transfers don’t count as income or spending.</span></label>}
      {type === 'Expense' && <fieldset className="classification"><legend>Need or want?</legend><div className="segmented">{(['Need', 'Want'] as const).map(c => <button type="button" key={c} aria-pressed={classification === c} className={classification === c ? 'active' : ''} onClick={() => setClassification(c)}>{c === 'Need' ? <ShieldCheck size={17} /> : <Sparkles size={17} />}{c}</button>)}</div></fieldset>}
      <button type="button" className="text-button details-toggle" aria-expanded={details} onClick={() => setDetails(!details)}><CalendarDays size={16} />{details ? 'Hide extra details' : 'Date, time & notes'}<span>{date === localDate() ? 'Today' : date} · {time}</span></button>
      {details && <div className="extra-details"><div className="form-grid"><label htmlFor="date">Date<input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required /></label><label htmlFor="time">Time<input id="time" type="time" value={time} onChange={e => setTime(e.target.value)} required /></label></div><label htmlFor="description">Description (optional)<input id="description" value={description} maxLength={500} onChange={e => setDescription(e.target.value)} /></label><label htmlFor="notes">Notes (optional)<textarea id="notes" value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} placeholder="Anything you’d like to remember" /></label></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="button primary" disabled={saving}>{saving ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{saving ? 'Saving…' : edit ? 'Save changes' : review ? 'Confirm & save' : 'Save transaction'}</button></div>
    </form>
  </Modal>;
}
