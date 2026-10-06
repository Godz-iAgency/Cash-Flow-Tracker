import { ArrowRight, ArrowLeftRight, BarChart3, CalendarDays, ClipboardList, RefreshCw, Settings, ShieldCheck } from 'lucide-react';
import { Modal } from './components';
import { InstallControls } from './Pwa';
import { AppearanceSwitch } from './WaterTheme';
import type { Page } from './pages';

export function MoreMenu({ local, refreshing, onClose, onNavigate, onSettings, onStorage, onRefresh, inline = false }: {
  inline?: boolean;
  local: boolean; refreshing: boolean; onClose: () => void; onNavigate: (page: Page) => void;
  onSettings: () => void; onStorage: () => void; onRefresh: () => void;
}) {
  const tools = [
    { page: 'Insights' as Page, label: 'Spending insights', icon: BarChart3 },
    { page: 'Notes & Reminders' as Page, label: 'Notes & Reminders', icon: ClipboardList },
    { page: 'Money Flow' as Page, label: 'View money flow', icon: ArrowLeftRight },
    { page: 'Check-In History' as Page, label: 'Review check-in history', icon: CalendarDays },
    { page: 'Month-End Review' as Page, label: 'View month-end review', icon: BarChart3 },
  ];
  function open(action: () => void) { onClose(); action(); }
  const content = <>
    <div className="more-menu">
      <div className="more-links">
        {tools.map(({ page, label, icon: Icon }) => <button key={page} aria-label={label} onClick={() => open(() => onNavigate(page))}><Icon size={20} /><span>{page}</span><ArrowRight size={16} /></button>)}
      </div>
      <div className="more-links">
        <button aria-label="Tracker settings" onClick={() => open(onSettings)}><Settings size={20} /><span>Settings</span><ArrowRight size={16} /></button>
        <button onClick={() => open(onStorage)}><ShieldCheck size={20} /><span>Storage &amp; backup</span><ArrowRight size={16} /></button>
        <button disabled={refreshing} onClick={() => open(onRefresh)}><RefreshCw size={20} className={refreshing ? 'spin' : ''} /><span>Refresh data</span></button>
      </div>
      <div className="more-install"><InstallControls inlineHelp /><small>{local ? 'Saved on this device' : 'Cloud storage'}</small></div>
      <AppearanceSwitch />
    </div>
  </>;
  return inline ? content : <Modal title="Advanced" onClose={onClose}>{content}</Modal>;
}
