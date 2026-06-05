import { useEffect, useRef, useState } from 'react';

export type Placement = 'top' | 'bottom';

type Zone = 'carousel' | 'button';

// Menu (Shift+R) del sistema de constraints:
// - arriba: carrusel de 3 (centro + 2 lados, ventana deslizante) con los
//   constraints existentes. A/D mueve, Enter aplica el central al nodo.
// - abajo: boton (W/S para enfocarlo, Enter activa) para hacer constraint
//   el nodo actual.
// Los constraints aplicados se reflejan en el prompt generator.
export function ConstraintMenu({
  x,
  y,
  placement,
  nodeLabel,
  isConstraint,
  constraints,
  appliedIds,
  onToggleSelf,
  onToggleApply,
  onClose,
}: {
  x: number;
  y: number;
  placement: Placement;
  nodeLabel: string;
  isConstraint: boolean;
  constraints: Array<{ id: string; label: string }>;
  appliedIds: string[];
  onToggleSelf: () => void;
  onToggleApply: (id: string) => void;
  onClose: () => void;
}) {
  const applied = new Set(appliedIds);
  const hasConstraints = constraints.length > 0;
  const [center, setCenter] = useState(0);
  const [zone, setZone] = useState<Zone>(hasConstraints ? 'carousel' : 'button');

  // Refs para que el listener global (registrado una vez) lea valores frescos.
  const centerRef = useRef(center);
  centerRef.current = center;
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;
  const fns = useRef({ onToggleSelf, onToggleApply });
  fns.current = { onToggleSelf, onToggleApply };

  const clampCenter = (i: number) =>
    Math.max(0, Math.min(constraintsRef.current.length - 1, i));

  // WASD + Enter a nivel window (capture) para que funcione sin focus y para
  // no chocar con el WASD de navegacion de nodos de la app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      const list = constraintsRef.current;
      if (k === 'a' || e.key === 'ArrowLeft') {
        consume();
        if (list.length > 0) {
          setZone('carousel');
          setCenter((c) => Math.max(0, c - 1));
        }
        return;
      }
      if (k === 'd' || e.key === 'ArrowRight') {
        consume();
        if (list.length > 0) {
          setZone('carousel');
          setCenter((c) => Math.min(list.length - 1, c + 1));
        }
        return;
      }
      if (k === 'w' || e.key === 'ArrowUp') {
        consume();
        if (list.length > 0) setZone('carousel');
        return;
      }
      if (k === 's' || e.key === 'ArrowDown') {
        consume();
        setZone('button');
        return;
      }
      if (e.key === 'Enter') {
        consume();
        if (zoneRef.current === 'button' || list.length === 0) {
          fns.current.onToggleSelf();
        } else {
          const c = list[centerRef.current];
          if (c) fns.current.onToggleApply(c.id);
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div
      className={`label-picker constraint-menu placement-${placement}`}
      style={{ left: x, top: y }}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="label-picker-header">
        <span className="label-picker-title">constraints</span>
        <button type="button" className="label-picker-close" onClick={onClose} tabIndex={-1}>
          x
        </button>
      </div>

      <div className="constraint-section-title">aplicar a "{nodeLabel}"</div>
      {!hasConstraints ? (
        <div className="label-picker-hint constraint-empty">
          No hay constraints todavia. Marca un nodo como constraint con el boton de abajo.
        </div>
      ) : (
        <div className="constraint-carousel">
          {[-1, 0, 1].map((off) => {
            const idx = center + off;
            const c = constraints[idx];
            if (!c) return <div key={off} className="constraint-slot is-empty" aria-hidden />;
            const on = applied.has(c.id);
            const isCenter = off === 0;
            const focused = isCenter && zone === 'carousel';
            return (
              <button
                key={c.id}
                type="button"
                className={`constraint-slot ${isCenter ? 'is-center' : 'is-side'} ${on ? 'is-on' : ''} ${focused ? 'is-focused' : ''}`}
                onClick={() => {
                  if (isCenter) {
                    onToggleApply(c.id);
                  } else {
                    setCenter(clampCenter(idx));
                    setZone('carousel');
                  }
                }}
                title={c.label}
                tabIndex={-1}
              >
                {on && <span className="constraint-check">✓</span>}
                <span className="constraint-slot-label">{c.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className={`constraint-self ${isConstraint ? 'is-on' : ''} ${zone === 'button' ? 'is-focused' : ''}`}
        onClick={onToggleSelf}
        tabIndex={-1}
      >
        {isConstraint ? '✓ Este nodo es un constraint' : 'Hacer constraint este nodo'}
      </button>

      <div className="label-picker-hint">A/D elegir · Enter aplicar · S↓ boton · Shift cierra</div>
    </div>
  );
}
