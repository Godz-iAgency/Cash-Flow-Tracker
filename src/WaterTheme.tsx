import { useEffect, useState, type ReactNode } from 'react';

// One appearance on every device; old light/dark preferences no longer affect it.
export function WaterThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = 'water';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim());
    const visibility = () => { document.documentElement.dataset.background = String(document.hidden); };
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  return <>{children}</>;
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
