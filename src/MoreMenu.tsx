import type { ReactNode } from 'react';
import { ArrowRight, ArrowLeftRight, BarChart3, CalendarDays, ClipboardList, RefreshCw, Settings, ShieldCheck } from 'lucide-react';
import { Modal } from './components';
import { InstallControls } from './Pwa';
import type { Page } from './pages';

export function MoreMenu({ local, refreshing, onClose, onNavigate, onSettings, onStorage, onRefresh, inline = false, advancedTools }: {
  inline?: boolean; advancedTools?: ReactNode;
  local: boolean; refreshing: boolean; onClose: () => void; onNavigate: (page: Page) => void;
  onSettings: () => void; onStorage: () => void; onRefresh: () => void;
}) {
  const tools = [
    { page: 'Insights' as Page, label: 'My spending', note: 'Today, this week and this month', icon: BarChart3 },
    { page: 'Accounts' as Page, label: 'Banks & cards', note: 'Balances and account details', icon: ArrowLeftRight },
    { page: 'Notes & Reminders' as Page, label: 'Notes & reminders', note: 'Things to remember', icon: ClipboardList },
    { page: 'Check-In History' as Page, label: 'Daily checks', note: 'Days you have reviewed', icon: CalendarDays },
    { page: 'Month-End Review' as Page, label: 'Monthly review', note: 'Look back and plan ahead', icon: BarChart3 },
  ];
  function open(action: () => void) { onClose(); action(); }
  const content = <>
    <div className="more-menu">
      <details className="simple-disclosure advanced-tools"><summary>More tools<ArrowRight size={16} /></summary><div className="more-links">
        {tools.map(({ page, label, note, icon: Icon }) => <button key={page} aria-label={label} onClick={() => open(() => onNavigate(page))}><Icon size={20} /><span><strong>{label}</strong><small>{note}</small></span><ArrowRight size={16} /></button>)}
      </div>{advancedTools}</details>
      <section className="tool-group" aria-labelledby="app-tools"><h2 id="app-tools">Your app</h2><div className="more-links">
        <button aria-label="Tracker settings" onClick={() => open(onSettings)}><Settings size={20} /><span>Settings</span><ArrowRight size={16} /></button>
        <button onClick={() => open(onStorage)}><ShieldCheck size={20} /><span>Backup &amp; devices</span><ArrowRight size={16} /></button>
        <button disabled={refreshing} onClick={() => open(onRefresh)}><RefreshCw size={20} /><span>{refreshing ? 'Reloading…' : 'Reload records'}</span></button>
      </div><div className="more-install"><InstallControls inlineHelp /><small>{local ? 'Saved in this browser' : 'Saved privately online'}</small></div></section>
    </div>
  </>;
  return inline ? content : <Modal title="Advanced" onClose={onClose}>{content}</Modal>;
}
