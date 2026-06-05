import type { ArrowType, EdgeStyle } from '../parser/types';

export type Placement = 'top' | 'bottom';

const ARROWS: Array<{ key: ArrowType; label: string; glyph: string }> = [
  { key: 'directed', label: 'directed', glyph: '→' },
  { key: 'bidirectional', label: 'bidirectional', glyph: '↔' },
  { key: 'undirected', label: 'undirected', glyph: '—' },
];

const STYLES: Array<{ key: EdgeStyle; label: string; dash: string }> = [
  { key: 'solid', label: 'solid', dash: '' },
  { key: 'dashed', label: 'dashed', dash: '6 4' },
  { key: 'dotted', label: 'dotted', dash: '2 3' },
];

const COLORS = ['#0f172a', '#dc2626', '#16a34a', '#2563eb', '#a16207', '#7c3aed'];

export function EdgeMenu({
  x,
  y,
  placement,
  arrow,
  style,
  color,
  onSetArrow,
  onReverse,
  onSetStyle,
  onSetColor,
  onClearStyle,
  onClearColor,
  onClose,
}: {
  x: number;
  y: number;
  placement: Placement;
  arrow: ArrowType;
  style: EdgeStyle | undefined;
  color: string | undefined;
  onSetArrow: (a: ArrowType) => void;
  onReverse: () => void;
  onSetStyle: (s: EdgeStyle) => void;
  onSetColor: (c: string) => void;
  onClearStyle: () => void;
  onClearColor: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`edge-menu placement-${placement}`}
      style={{ left: x, top: y }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="edge-menu-row">
        <span className="edge-menu-label">arrow</span>
        {ARROWS.map((a) => (
          <button
            key={a.key}
            type="button"
            className={`edge-menu-chip ${arrow === a.key ? 'is-on' : ''}`}
            onClick={() => onSetArrow(a.key)}
            title={a.label}
          >
            {a.glyph}
          </button>
        ))}
        <button
          type="button"
          className="edge-menu-chip"
          onClick={onReverse}
          title="invertir direccion (swap origen/destino)"
        >
          ⇄
        </button>
      </div>
      <div className="edge-menu-row">
        <span className="edge-menu-label">style</span>
        {STYLES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`edge-menu-chip ${style === s.key || (!style && s.key === 'solid') ? 'is-on' : ''}`}
            onClick={() => onSetStyle(s.key)}
            title={s.label}
          >
            <svg width={22} height={6} viewBox="0 0 22 6">
              <line
                x1={1}
                y1={3}
                x2={21}
                y2={3}
                stroke="currentColor"
                strokeWidth={1.6}
                strokeDasharray={s.dash || undefined}
              />
            </svg>
          </button>
        ))}
        <button
          type="button"
          className="edge-menu-x"
          onClick={onClearStyle}
          title="Reset style"
        >
          x
        </button>
      </div>
      <div className="edge-menu-row">
        <span className="edge-menu-label">color</span>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`edge-menu-swatch ${color?.toLowerCase() === c ? 'is-on' : ''}`}
            style={{ background: c }}
            onClick={() => onSetColor(c)}
            title={c}
          />
        ))}
        <button
          type="button"
          className="edge-menu-x"
          onClick={onClearColor}
          title="Reset color"
        >
          x
        </button>
      </div>
      <button
        type="button"
        className="edge-menu-close"
        onClick={onClose}
        aria-label="cerrar"
        tabIndex={-1}
      >
        x
      </button>
    </div>
  );
}
