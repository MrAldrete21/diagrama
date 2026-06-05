import { useCallback, useMemo, useState } from 'react';

// Menus/popovers anclados al nodo seleccionado. Son mutuamente exclusivos
// (solo uno abierto a la vez), por eso se modelan con un unico estado `active`
// en lugar de N booleanos sueltos (lo que antes generaba wiring disperso y
// bugs de deps arrays).
export type NodeMenu =
  | 'context'
  | 'label'
  | 'constraint'
  | 'content-edit'
  | 'content-view'
  | 'attr-picker'
  | 'attr-editor'
  | 'custom-block';

export type NodeMenuApi = {
  active: NodeMenu | null;
  isOpen: (m: NodeMenu) => boolean;
  open: (m: NodeMenu) => void;
  close: () => void;
  /** Abre `m` si `canOpen`; si ya estaba abierto, lo cierra (toggle). */
  toggle: (m: NodeMenu, canOpen?: boolean) => void;
};

export function useNodeMenu(): NodeMenuApi {
  const [active, setActive] = useState<NodeMenu | null>(null);
  const isOpen = useCallback((m: NodeMenu) => active === m, [active]);
  const open = useCallback((m: NodeMenu) => setActive(m), []);
  const close = useCallback(() => setActive(null), []);
  const toggle = useCallback(
    (m: NodeMenu, canOpen = true) =>
      setActive((cur) => (cur === m ? null : canOpen ? m : null)),
    [],
  );
  // Identidad estable salvo cuando cambia `active`, asi se puede listar el
  // objeto entero como dep de useEffect sin re-correr en cada render.
  return useMemo(
    () => ({ active, isOpen, open, close, toggle }),
    [active, isOpen, open, close, toggle],
  );
}
