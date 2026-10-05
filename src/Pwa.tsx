import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Download, RefreshCw } from 'lucide-react';
import { Modal } from './components';
import { BrandMark } from './Brand';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type PwaContextValue = { installed: boolean; prompt?: InstallPrompt; waiting?: ServiceWorkerRegistration; online: boolean; clearPrompt: () => void; update: () => void };
const PwaContext = createContext<PwaContextValue | undefined>(undefined);
const standalone = () => matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(standalone), [prompt, setPrompt] = useState<InstallPrompt>();
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration>(), [online, setOnline] = useState(navigator.onLine);
  const updateRequested = useRef(false);
  useEffect(() => {
    let stopped = false, registration: ServiceWorkerRegistration | undefined, lastCheck = 0;
    const media = matchMedia('(display-mode: standalone)');
    const refreshInstalled = () => setInstalled(standalone());
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const appInstalled = () => { setInstalled(true); setPrompt(undefined); };
    const connection = () => setOnline(navigator.onLine);
    const changed = () => { if (updateRequested.current) window.location.reload(); };
    const inspect = () => { if (!stopped && registration?.waiting && navigator.serviceWorker.controller) setWaiting(registration); };
    const check = () => {
      if (!document.hidden && navigator.onLine && registration && Date.now() - lastCheck > 60000) {
        lastCheck = Date.now(); void registration.update().catch(() => {});
      }
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', appInstalled);
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    media.addEventListener('change', refreshInstalled);
    document.addEventListener('visibilitychange', check);
    if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(value => {
        if (stopped) return;
        registration = value; inspect();
        value.addEventListener('updatefound', () => value.installing?.addEventListener('statechange', inspect));
        check();
      }).catch(() => { /* Installation support never blocks login or financial actions. */ });
    }
    return () => {
      stopped = true;
      window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', appInstalled);
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection);
      media.removeEventListener('change', refreshInstalled); document.removeEventListener('visibilitychange', check);
      if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('controllerchange', changed);
    };
  }, []);
  function update() {
    if (!waiting?.waiting || !navigator.onLine) return;
    updateRequested.current = true; waiting.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  }
  return <PwaContext.Provider value={{ installed, prompt, waiting, online, clearPrompt: () => setPrompt(undefined), update }}>{children}</PwaContext.Provider>;
}

export function InstallControls({ inlineHelp = false }: { inlineHelp?: boolean } = {}) {
  const pwa = useContext(PwaContext);
  const [instructions, setInstructions] = useState(false), [error, setError] = useState('');
  if (!pwa) return null;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(navigator.userAgent);
  async function install() {
    if (!pwa?.prompt) { setInstructions(true); return; }
    try { await pwa.prompt.prompt(); await pwa.prompt.userChoice; }
    catch { setError('Use your browser menu to install the app.'); setInstructions(true); }
    finally { pwa.clearPrompt(); }
  }
  const help = <div className="install-instructions">
        <BrandMark />{error && <p role="alert">{error}</p>}
        {ios ? <>
          <p>Open this website in Safari.</p>
          <ol>
            <li>Tap the Share button.</li>
            <li>Choose <strong>Add to Home Screen</strong>.</li>
            <li>Turn on <strong>Open as Web App</strong>, if shown.</li>
            <li>Tap <strong>Add</strong>.</li>
          </ol>
        </> : android ? <>
          <p>Open this website in Chrome.</p>
          <ol>
            <li>Tap the three-dot menu.</li>
            <li>Choose <strong>Install and create shortcut</strong>, then <strong>Install</strong>. Older versions may show <strong>Install app</strong> or <strong>Add to home screen</strong>.</li>
            <li>Confirm the installation.</li>
          </ol>
        </> : <p>Use the install icon in Chrome or Edge’s address bar, or open this website on your phone to add it to the home screen.</p>}
        <p>Sign in with the same Google account on each device. An internet connection is needed for Firestore.</p>
      </div>;
  return <><span className="pwa-controls">
    {!pwa.installed && <button type="button" className="text-button" onClick={() => void install()}><Download size={16} />Install app</button>}
    {pwa.waiting && <button type="button" className="text-button" disabled={!pwa.online} onClick={pwa.update}><RefreshCw size={16} />Update app</button>}
  </span>{instructions && (inlineHelp ? help : createPortal(<Modal title="Install Cash Flow" onClose={() => setInstructions(false)}>{help}</Modal>, document.body))}</>;
}
