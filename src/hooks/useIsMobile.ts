import { useEffect, useState } from 'react';

// Detecta viewport movil: pantalla chica O puntero grueso (touch) en pantalla
// media. Se re-evalua en resize / cambio de orientacion. SSR-safe.
const QUERY = '(max-width: 760px), (pointer: coarse) and (max-width: 1024px)';

function read(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(read);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    // addEventListener('change') es el API moderno; addListener el legacy (Safari viejo).
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
}
