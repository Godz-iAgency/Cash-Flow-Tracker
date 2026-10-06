import { useState } from 'react';
import { ArrowDownLeft, ArrowRight, ChevronDown, CreditCard, Wallet } from 'lucide-react';
import type { Account } from '../shared/model';
import { Modal } from './components';
import './current.css';

// Only display labels cross into this window. It has no State, API, storage or save callback.
export type CurrentAccountLabel = Pick<Account, 'name' | 'lastFour' | 'scope' | 'type'>;
const IMAGINED_BANK_CENTS = [68425064, 42783017, 124789036, 35694028, 51873091];
const IMAGINED_CARD_ROOM_CENTS = [8500000, 12500000, 17500000, 23500000, 31500000];
const MONTHLY_INCOME_CENTS = 10000000;
const dollars = (cents: number) => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(cents / 100);

export function Current({ accounts, onClose }: { accounts: readonly CurrentAccountLabel[]; onClose: () => void }) {
  const [view, setView] = useState<'All' | 'Personal' | 'Business'>('All');
  let bank = 0, card = 0;
  const imagined = accounts.map((account, index) => ({...account, key: index, cents: account.type === 'Credit card' ? IMAGINED_CARD_ROOM_CENTS[card++] : IMAGINED_BANK_CENTS[bank++]}));
  const total = imagined.filter(a => a.type !== 'Credit card').reduce((n,a) => n+a.cents,0);
  const shown = imagined.filter(a => view === 'All' || a.scope === view);
  return <Modal title="Current" wide onClose={onClose}>
    <div className="current-window">
      <section className="current-hero" aria-label="Total cash">
        <div className="current-hero-copy"><span className="current-cash-label">Total cash</span><strong className="current-cash">{dollars(total)}</strong></div>
        <span className="current-water-mark" aria-hidden="true">CURRENT</span>
      </section>
      <details className="current-income"><summary><span className="current-income-icon"><ArrowDownLeft size={24} /></span><span className="current-income-copy">Coming in every month<strong>{dollars(MONTHLY_INCOME_CENTS)}</strong></span><span className="current-income-link">See income<ChevronDown size={17} /></span></summary><div className="current-income-split"><div><span>Personal income</span><strong>{dollars(6000000)}</strong></div><div><span>Business income</span><strong>{dollars(4000000)}</strong></div></div></details>
      <div className="current-account-heading"><h3>My five accounts</h3><div className="segmented current-scope" aria-label="Accounts">{(['All','Personal','Business'] as const).map(v => <button key={v} aria-pressed={view===v} className={view===v?'active':''} onClick={()=>setView(v)}>{v}</button>)}</div></div>
      <div className="current-accounts">{shown.map(a => <details key={a.key} className={`current-account ${a.type==='Credit card'?'current-card':'current-bank'}`}><summary><span className="current-account-top"><span className="current-account-icon">{a.type==='Credit card'?<CreditCard size={19}/>:<Wallet size={19}/>}</span><span>{a.scope}</span><ChevronDown size={16}/></span><strong className="current-account-name">{a.name}</strong><span className="current-account-type">{a.type} · {a.lastFour}</span><strong className="current-account-money">{dollars(a.cents)}</strong></summary><div className="current-account-detail"><p>{a.type==='Credit card'?'Available on this card. Separate from total cash.':'Included in total cash.'}</p></div></details>)}</div>
      <footer className="current-footer"><button className="button secondary" onClick={onClose}>Back to my tracker<ArrowRight size={16}/></button></footer>
    </div>
  </Modal>;
}
