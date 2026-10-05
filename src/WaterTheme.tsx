import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light';
const themeKey = 'cash-flow-appearance';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);
export function WaterThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(themeKey, theme); } catch { /* Appearance works even if storage is unavailable. */ }
    const color = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [theme]);
  useEffect(() => {
    const visibility = () => { document.documentElement.dataset.background = String(document.hidden); };
    const storage = (event: StorageEvent) => { if (event.key === themeKey) setTheme(event.newValue === 'light' ? 'light' : 'dark'); };
    visibility(); document.addEventListener('visibilitychange', visibility); window.addEventListener('storage', storage);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('storage', storage); };
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export function AppearanceSwitch() {
  const appearance = useContext(ThemeContext);
  if (!appearance) return null;
  return <div className="appearance-setting"><span id="appearance-label">Appearance</span><div className="segmented" role="group" aria-labelledby="appearance-label">{(['dark', 'light'] as const).map(theme => <button type="button" key={theme} aria-pressed={appearance.theme === theme} className={appearance.theme === theme ? 'active' : ''} onClick={() => appearance.setTheme(theme)}>{theme === 'dark' ? 'Dark' : 'Light'}</button>)}</div></div>;
}
export function WaterWave() {
  return <svg className="home-wave" viewBox="0 0 1200 48" preserveAspectRatio="none" aria-hidden="true"><path d="M0 22 Q150 2 300 22 T600 22 T900 22 T1200 22 V48 H0Z" /></svg>;
}
export function SaveRipple() {
  const [point, setPoint] = useState<{ x: number; y: number }>();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const saved = (event: Event) => {
      if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setPoint((event as CustomEvent<{ x: number; y: number }>).detail);
      clearTimeout(timer); timer = setTimeout(() => setPoint(undefined), 280);
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => setPoint(undefined);
    window.addEventListener('cash-flow-saved', saved); reduced.addEventListener('change', stop); document.addEventListener('visibilitychange', stop);
    return () => { clearTimeout(timer); window.removeEventListener('cash-flow-saved', saved); reduced.removeEventListener('change', stop); document.removeEventListener('visibilitychange', stop); };
  }, []);
  return point ? <span className="save-ripple" aria-hidden="true" style={{ left: point.x, top: point.y }} /> : null;
}
