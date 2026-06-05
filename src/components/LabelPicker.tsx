import { useEffect, useRef, useState } from 'react';
import {
  PRESET_LABELS,
  labelDef,
  resolveLabelDescription,
  hasLabelOverride,
  type LabelPrompts,
} from '../renderer/labels';

export type Placement = 'top' | 'bottom';

const COLS = 3;

export type PickerMode =
  | { kind: 'tag' }
  | { kind: 'create'; directionHint: string };

export function LabelPicker({
  x,
  y,
  placement,
  currentLabels,
  mode = { kind: 'tag' },
  labelPrompts,
  onToggle,
  onAddCustom,
  onEditPrompt,
  onClose,
}: {
  x: number;
  y: number;
  placement: Placement;
  currentLabels: string[];
  mode?: PickerMode;
  /** Overrides editables de la descripcion/prompt de cada label. */
  labelPrompts?: LabelPrompts;
  onToggle: (key: string) => void;
  onAddCustom: (key: string) => void;
  /** Guarda (o resetea con text vacio) el prompt custom de una label. */
  onEditPrompt?: (key: string, text: string) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [gridIdx, setGridIdx] = useState(0);
  const [customText, setCustomText] = useState('');
  // Label cuyo prompt se esta editando (null = grilla normal).
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const total = PRESET_LABELS.length;

  // Keep latest gridIdx + onToggle in a ref so the window listener (registered
  // once) always reads the freshest value, even on rapid key presses.
  const gridIdxRef = useRef(gridIdx);
  gridIdxRef.current = gridIdx;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const editableRef = useRef(!!onEditPrompt);
  editableRef.current = !!onEditPrompt;
  const promptsRef = useRef(labelPrompts);
  promptsRef.current = labelPrompts;

  // Abre el editor de prompt para una label, prellenando con la descripcion
  // efectiva (override del usuario si existe, si no la default).
  const beginEdit = (key: string) => {
    if (!editableRef.current) return;
    setEditingKey(key);
    setDraft(resolveLabelDescription(key, promptsRef.current));
  };

  // Foco automatico al textarea cuando se abre el editor.
  useEffect(() => {
    if (editingKey) editRef.current?.focus();
  }, [editingKey]);

  // Window-level WASD/Enter so it works with no focus needed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement;
      const inField = a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (inField) return;
      const k = e.key.toLowerCase();
      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      // R edita el prompt de la label enfocada.
      if (k === 'r' && editableRef.current) {
        consume();
        beginEdit(PRESET_LABELS[gridIdxRef.current].key);
        return;
      }
      const move = (delta: number) => {
        const next = Math.max(0, Math.min(total - 1, gridIdxRef.current + delta));
        gridIdxRef.current = next;
        setGridIdx(next);
      };
      if (k === 'a' || e.key === 'ArrowLeft') {
        consume();
        move(-1);
        return;
      }
      if (k === 'd' || e.key === 'ArrowRight') {
        consume();
        move(1);
        return;
      }
      if (k === 'w' || e.key === 'ArrowUp') {
        consume();
        move(-COLS);
        return;
      }
      if (k === 's' || e.key === 'ArrowDown') {
        consume();
        move(COLS);
        return;
      }
      if (e.key === 'Enter') {
        consume();
        onToggleRef.current(PRESET_LABELS[gridIdxRef.current].key);
        return;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [total]);

  const handleCustomSubmit = () => {
    const k = customText.trim();
    if (!k) return;
    onAddCustom(k);
    setCustomText('');
  };

  const commitEdit = () => {
    if (editingKey && onEditPrompt) onEditPrompt(editingKey, draft);
    setEditingKey(null);
  };
  const resetEdit = () => {
    if (editingKey && onEditPrompt) onEditPrompt(editingKey, '');
    setEditingKey(null);
  };

  const editingDef = editingKey ? labelDef(editingKey) : null;

  return (
    <div
      ref={rootRef}
      className={`label-picker placement-${placement}`}
      style={{ left: x, top: y }}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="label-picker-header">
        <span className="label-picker-title">
          {editingDef
            ? `prompt: ${editingDef.display}`
            : mode.kind === 'create'
              ? `crear ${mode.directionHint} con label`
              : 'labels'}
        </span>
        <button
          type="button"
          className="label-picker-close"
          onClick={editingKey ? () => setEditingKey(null) : onClose}
          tabIndex={-1}
        >
          x
        </button>
      </div>

      {editingDef ? (
        <div className="label-prompt-editor">
          <span className="label-prompt-chip" style={{ background: editingDef.bg, color: editingDef.fg }}>
            {editingDef.display}
          </span>
          <textarea
            ref={editRef}
            className="label-prompt-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                commitEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditingKey(null);
              }
            }}
            placeholder="descripcion que ve el prompt generator..."
            rows={5}
          />
          <div className="label-prompt-actions">
            <button type="button" className="btn" onClick={commitEdit} tabIndex={-1}>
              guardar
            </button>
            <button
              type="button"
              className="btn"
              onClick={resetEdit}
              tabIndex={-1}
              disabled={!hasLabelOverride(editingKey!, labelPrompts)}
            >
              default
            </button>
          </div>
          <div className="label-picker-hint">Ctrl+Enter guarda · Esc cancela</div>
        </div>
      ) : (
        <>
          <div className="label-picker-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {PRESET_LABELS.map((l, i) => {
              const active = currentLabels.includes(l.key);
              const focused = i === gridIdx;
              const customized = hasLabelOverride(l.key, labelPrompts);
              return (
                <button
                  key={l.key}
                  type="button"
                  className={`label-cell ${active ? 'is-on' : ''} ${focused ? 'is-focused' : ''}`}
                  style={{
                    background: active ? l.bg : 'transparent',
                    color: active ? l.fg : 'var(--text-muted)',
                    borderColor: active ? l.fg : 'var(--palette-border)',
                  }}
                  onClick={(e) => {
                    setGridIdx(i);
                    // Shift+click edita el prompt en vez de togglear la label.
                    if (e.shiftKey && onEditPrompt) {
                      beginEdit(l.key);
                    } else {
                      onToggle(l.key);
                    }
                  }}
                  title={customized ? 'prompt editado · R o Shift+click edita' : 'R o Shift+click edita el prompt'}
                  tabIndex={-1}
                >
                  {l.display}
                  {customized && <span className="label-cell-dot" />}
                </button>
              );
            })}
          </div>
          {currentLabels.length > 0 && (
            <div className="label-picker-active">
              <span className="label-picker-active-title">en el bloque:</span>
              <div className="label-picker-active-chips">
                {currentLabels.map((k) => {
                  const def = labelDef(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      className="label-active-chip"
                      style={{ background: def.bg, color: def.fg, borderColor: def.fg }}
                      onClick={() => onToggle(k)}
                      title="Quitar"
                      tabIndex={-1}
                    >
                      {def.display} ×
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="label-picker-custom">
            <input
              ref={customInputRef}
              type="text"
              className="label-picker-custom-input"
              placeholder="custom label..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
            />
            <button
              type="button"
              className="btn"
              onClick={handleCustomSubmit}
              tabIndex={-1}
            >
              +
            </button>
          </div>
          <div className="label-picker-hint">
            WASD grid · Enter {mode.kind === 'create' ? 'crea' : 'toggle'}
            {onEditPrompt ? ' · R edita prompt' : ''}
          </div>
        </>
      )}
    </div>
  );
}
