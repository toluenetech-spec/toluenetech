import { useEffect, useState } from 'react';

/**
 * Read whether <html> currently has the `.dark` class.
 */
export function isDarkNow(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * Subscribe to dark-mode changes (classList on <html> + OS preference +
 * cross-tab storage). Works with the ThemeProvider toggle.
 */
export default function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(isDarkNow);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const mqHandler = () => update();
    mq.addEventListener?.('change', mqHandler);
    const onStorage = (e: StorageEvent) => { if (e.key === 'theme') update(); };
    window.addEventListener('storage', onStorage);
    return () => {
      obs.disconnect();
      mq.removeEventListener?.('change', mqHandler);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return isDark;
}
