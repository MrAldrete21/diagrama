import { useEffect, useMemo, useRef, useState } from 'react';
import { ICON_KEYS, IconGlyph, isIconKey } from '../renderer/icons';
import type { IconKey } from '../renderer/icons';

export type EditableAttr = 'progress' | 'quantity' | 'icon';

export type EditorValues = {
  progress: boolean | undefined;
  quantity: number | undefined;
  icon: string | undefined;
};

export type Placement = 'top' | 'bottom';

const ICON_COLS = 7;

export function AttributeEditor({
  x,
  y,
  placement,
  values,
  onSetProgress,
  onSetQuantity,
  onSetIcon,
  onClose,
}: {
  x: number;
  y: number;
  placement: Placement;
  values: EditorValues;
  onSetProgress: (v: boolean) => void;
  onSetQuantity: (v: number) => void;
  onSetIcon: (v: string) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rows = useMemo<EditableAttr[]>(() => {
    const r: EditableAttr[] = [];
    if (values.progress !== undefined) r.push('progress');
    if (values.quantity !== undefined) r.push('quantity');
    if (values.icon !== undefined) r.push('icon');
    return r;
  }, [values.progress, values.quantity, values.icon]);

  const [rowIndex, setRowIndex] = useState(0);
  const [iconGridIdx, setIconGridIdx] = useState(() => {
    const cur = isIconKey(values.icon) ? ICON_KEYS.indexOf(values.icon) : 0;
    return cur >= 0 ? cur : 0;
  });

  useEffect(() => {
    if (rowIndex >= rows.length) setRowIndex(Math.max(0, rows.length - 1));
  }, [rows.length, rowIndex]);

  // Sync grid index when navigating onto the icon row, so it points at the
  // current icon rather than wherever the user left it.
  useEffect(() => {
    if (rows[rowIndex] === 'icon') {
      const cur = isIconKey(values.icon) ? ICON_KEYS.indexOf(values.icon) : -1;
      if (cur >= 0) setIconGridIdx(cur);
    }
  }, [rowIndex, rows, values.icon]);

  // Latest closures for the window-level listener.
  const refs = useRef({
    rows,
    rowIndex,
    iconGridIdx,
    progress: values.progress,
    quantity: values.quantity,
    onSetProgress,
    onSetQuantity,
    onSetIcon,
  });
  refs.current = {
    rows,
    rowIndex,
    iconGridIdx,
    progress: values.progress,
    quantity: values.quantity,
    onSetProgress,
    onSetQuantity,
    onSetIcon,
  };

  // Window-level handler so the editor works regardless of focus.
  useEffect(() => {
    const onWinKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) return;

      const r = refs.current;
      const curRow = r.rows[r.rowIndex];
      const k = e.key.toLowerCase();
      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      };

      // ---- icon row: WASD navigates the grid ----
      if (curRow === 'icon') {
        if (k === 'a' || e.key === 'ArrowLeft') {
          consume();
          setIconGridIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (k === 'd' || e.key === 'ArrowRight') {
          consume();
          setIconGridIdx((i) => Math.min(ICON_KEYS.length - 1, i + 1));
          return;
        }
        if (k === 's' || e.key === 'ArrowDown') {
          consume();
          setIconGridIdx((i) => Math.min(ICON_KEYS.length - 1, i + ICON_COLS));
          return;
        }
        if (k === 'w' || e.key === 'ArrowUp') {
          consume();
          if (r.iconGridIdx - ICON_COLS < 0) {
            setRowIndex((i) => Math.max(0, i - 1));
          } else {
            setIconGridIdx((i) => i - ICON_COLS);
          }
          return;
        }
        if (e.key === 'Enter') {
          consume();
          r.onSetIcon(ICON_KEYS[r.iconGridIdx]);
          return;
        }
        return;
      }

      // ---- quantity row: type digits directly ----
      if (curRow === 'quantity') {
        if (/^\d$/.test(e.key)) {
          consume();
          if (!quantityTyped.current) quantityBuf.current = '';
          quantityBuf.current = (quantityBuf.current + e.key).slice(0, 6);
          quantityTyped.current = true;
          r.onSetQuantity(parseInt(quantityBuf.current, 10) || 0);
          return;
        }
        if (e.key === 'Backspace') {
          consume();
          if (!quantityTyped.current) quantityBuf.current = String(r.quantity ?? 0);
          quantityBuf.current = quantityBuf.current.slice(0, -1);
          quantityTyped.current = true;
          r.onSetQuantity(quantityBuf.current ? parseInt(quantityBuf.current, 10) : 0);
          return;
        }
        if (e.key === '-') {
          consume();
          r.onSetQuantity(-(r.quantity ?? 0));
          return;
        }
        if (k === 'a' || e.key === 'ArrowLeft') {
          consume();
          r.onSetQuantity((r.quantity ?? 0) - 1);
          return;
        }
        if (k === 'd' || e.key === 'ArrowRight') {
          consume();
          r.onSetQuantity((r.quantity ?? 0) + 1);
          return;
        }
      }

      // ---- progress row: A = pending, D = done (explicit) ----
      if (curRow === 'progress') {
        if (k === 'a' || e.key === 'ArrowLeft') {
          consume();
          r.onSetProgress(false);
          return;
        }
        if (k === 'd' || e.key === 'ArrowRight') {
          consume();
          r.onSetProgress(true);
          return;
        }
        if (e.key === 'Enter') {
          consume();
          r.onSetProgress(!r.progress);
          return;
        }
      }

      // ---- W / S: move between rows (when not handled above) ----
      if (k === 'w' || e.key === 'ArrowUp') {
        consume();
        setRowIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (k === 's' || e.key === 'ArrowDown') {
        consume();
        setRowIndex((i) => Math.min(r.rows.length - 1, i + 1));
        return;
      }
    };
    window.addEventListener('keydown', onWinKey, true);
    return () => window.removeEventListener('keydown', onWinKey, true);
  }, []);

  // Reset typing buffer on row change.
  const quantityTyped = useRef(false);
  const quantityBuf = useRef('');
  useEffect(() => {
    quantityTyped.current = false;
    quantityBuf.current = '';
  }, [rowIndex]);

  if (rows.length === 0) {
    return (
      <div
        ref={rootRef}
        className={`attr-editor placement-${placement}`}
        style={{ left: x, top: y }}
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="attr-editor-header">
          <span className="attr-editor-title">editar atributos</span>
          <button
            type="button"
            className="attr-editor-close"
            onClick={onClose}
            tabIndex={-1}
          >
            x
          </button>
        </div>
        <div className="attr-editor-empty">
          Este bloque no tiene atributos. Agregalos con Shift+4.
        </div>
      </div>
    );
  }

  const currentRow = rows[rowIndex];

  return (
    <div
      ref={rootRef}
      className={`attr-editor placement-${placement}`}
      style={{ left: x, top: y }}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="attr-editor-header">
        <span className="attr-editor-title">editar atributos</span>
        <button
          type="button"
          className="attr-editor-close"
          onClick={onClose}
          tabIndex={-1}
        >
          x
        </button>
      </div>
      <div className="attr-editor-rows">
        {rows.map((r, idx) => {
          const active = idx === rowIndex;
          return (
            <div
              key={r}
              className={`attr-row ${active ? 'is-active' : ''}`}
              data-idx={idx}
              onClick={() => setRowIndex(idx)}
            >
              <span className="attr-row-label">{r}</span>
              <div className="attr-row-control">
                {r === 'progress' && (
                  <ProgressControl
                    value={!!values.progress}
                    onChange={onSetProgress}
                  />
                )}
                {r === 'quantity' && (
                  <QuantityControl
                    value={values.quantity ?? 0}
                    onChange={onSetQuantity}
                    onAnyType={() => {
                      quantityTyped.current = true;
                    }}
                  />
                )}
                {r === 'icon' && (
                  <IconValueDisplay value={values.icon ?? ''} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {currentRow === 'icon' && (
        <div className="attr-icon-grid">
          {ICON_KEYS.map((k, i) => (
            <button
              key={k}
              type="button"
              className={`attr-icon-cell ${k === values.icon ? 'is-active' : ''} ${i === iconGridIdx ? 'is-focused' : ''}`}
              onClick={() => {
                setIconGridIdx(i);
                onSetIcon(k);
              }}
              tabIndex={-1}
              title={k}
            >
              <svg width={20} height={20} viewBox="0 0 24 24">
                <IconGlyph name={k} />
              </svg>
            </button>
          ))}
        </div>
      )}
      <div className="attr-editor-hint">
        {currentRow === 'progress' && 'A pending · D done · W/S filas'}
        {currentRow === 'quantity' && '0-9 escribe · Backspace borra · W/S filas'}
        {currentRow === 'icon' && 'WASD navega grid · Enter elige · W arriba sale'}
      </div>
    </div>
  );
}

function ProgressControl({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="attr-toggle">
      <button
        type="button"
        className={`attr-toggle-btn ${value ? '' : 'is-active'}`}
        onClick={() => onChange(false)}
        tabIndex={-1}
      >
        pending
      </button>
      <button
        type="button"
        className={`attr-toggle-btn ${value ? 'is-active' : ''}`}
        onClick={() => onChange(true)}
        tabIndex={-1}
      >
        done
      </button>
    </div>
  );
}

function QuantityControl({
  value,
  onChange,
  onAnyType,
}: {
  value: number;
  onChange: (v: number) => void;
  onAnyType: () => void;
}) {
  return (
    <div className="attr-quantity">
      <button
        type="button"
        className="attr-quantity-btn"
        onClick={() => onChange(value - 1)}
        tabIndex={-1}
        aria-label="menos"
      >
        −
      </button>
      <input
        type="number"
        className="attr-quantity-input"
        value={value}
        onChange={(e) => {
          onAnyType();
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className="attr-quantity-btn"
        onClick={() => onChange(value + 1)}
        tabIndex={-1}
        aria-label="mas"
      >
        +
      </button>
    </div>
  );
}

function IconValueDisplay({ value }: { value: string }) {
  const isKey = isIconKey(value);
  return (
    <div className="attr-icon-display">
      {isKey ? (
        <svg width={18} height={18} viewBox="0 0 24 24">
          <IconGlyph name={value as IconKey} />
        </svg>
      ) : (
        <span className="attr-icon-text">{value || '—'}</span>
      )}
      <span className="attr-icon-name">{value || 'sin icono'}</span>
    </div>
  );
}
