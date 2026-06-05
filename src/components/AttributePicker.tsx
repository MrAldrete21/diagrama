import { useEffect, useRef } from 'react';

export type AttrKey = 'progress' | 'quantity' | 'icon';

export type AttributeState = {
  progress: boolean | undefined;
  quantity: number | undefined;
  icon: string | undefined;
};

export type Placement = 'top' | 'bottom';

const ATTRS: Array<{ key: AttrKey; label: string }> = [
  { key: 'progress', label: 'progress' },
  { key: 'quantity', label: 'quantity' },
  { key: 'icon', label: 'icon' },
];

export function AttributePicker({
  x,
  y,
  placement,
  state,
  onToggle,
  onClose,
}: {
  x: number;
  y: number;
  placement: Placement;
  state: AttributeState;
  onToggle: (key: AttrKey) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const first = rootRef.current?.querySelector<HTMLButtonElement>('.attr-chip');
      first?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const isOn = (k: AttrKey): boolean => {
    if (k === 'progress') return state.progress !== undefined;
    if (k === 'quantity') return state.quantity !== undefined;
    if (k === 'icon') return state.icon !== undefined && state.icon !== '';
    return false;
  };

  return (
    <div
      ref={rootRef}
      className={`attr-picker placement-${placement}`}
      style={{ left: x, top: y }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="attr-picker-header">
        <span className="attr-picker-title">atributos</span>
        <button
          type="button"
          className="attr-picker-close"
          onClick={onClose}
          aria-label="Cerrar"
          tabIndex={-1}
        >
          x
        </button>
      </div>
      <div className="attr-picker-row">
        {ATTRS.map((a) => {
          const on = isOn(a.key);
          return (
            <button
              key={a.key}
              type="button"
              className={`attr-chip ${on ? 'is-on' : ''}`}
              onClick={() => onToggle(a.key)}
              title={on ? `Quitar ${a.label}` : `Agregar ${a.label}`}
            >
              <span className="attr-chip-glyph">
                <AttrGlyph attr={a.key} state={state} />
              </span>
              <span className="attr-chip-label">{a.label}</span>
              {on && a.key === 'quantity' && state.quantity !== undefined && (
                <span className="attr-chip-value">{state.quantity}</span>
              )}
              {on && a.key === 'icon' && state.icon && (
                <span className="attr-chip-value">{state.icon}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="attr-picker-hint">WASD navega · Enter toggle</div>
    </div>
  );
}

function AttrGlyph({ attr, state }: { attr: AttrKey; state: AttributeState }) {
  if (attr === 'progress') {
    const done = state.progress === true;
    return (
      <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
        <rect
          x={1}
          y={1}
          width={12}
          height={12}
          rx={3}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
        />
        {done && (
          <path
            d="M 3 7 L 6 10 L 11 4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    );
  }
  if (attr === 'quantity') {
    return (
      <svg width={16} height={14} viewBox="0 0 16 14" aria-hidden>
        <rect
          x={1}
          y={2}
          width={14}
          height={10}
          rx={5}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
        />
        <text
          x={8}
          y={7.5}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={7}
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
          fontWeight={700}
          fill="currentColor"
        >
          9
        </text>
      </svg>
    );
  }
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
      <circle cx={7} cy={5} r={2.4} fill="none" stroke="currentColor" strokeWidth={1.4} />
      <path
        d="M 2.5 12.5 C 3.5 9.5 10.5 9.5 11.5 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}
