import { useEffect, useState } from 'react';
import App from './App';
import { MobileApp } from './MobileApp';
import { useIsMobile } from './hooks/useIsMobile';

const VIEW_KEY = 'diagrama:view';

// Override explicito de la app a montar. Prioridad: query (?view=mobile|desktop)
// > localStorage > auto (deteccion de dispositivo). El query lo persiste para que
// quede fijo entre recargas.
function readOverride(): 'mobile' | 'desktop' | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search).get('view');
  if (q === 'mobile' || q === 'desktop') {
    try {
      localStorage.setItem(VIEW_KEY, q);
    } catch {
      /* ignore */
    }
    return q;
  }
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === 'mobile' || stored === 'desktop') return stored;
  } catch {
    /* ignore */
  }
  return null;
}

export function Root() {
  const autoMobile = useIsMobile();
  const [override] = useState<'mobile' | 'desktop' | null>(readOverride);
  const isMobile = override ? override === 'mobile' : autoMobile;

  useEffect(() => {
    document.documentElement.classList.toggle('view-mobile', isMobile);
  }, [isMobile]);

  return isMobile ? <MobileApp /> : <App />;
}
