import { useEffect, useRef, useState } from 'react';

export type Placement = 'top' | 'bottom';

// Editor (Shift+T) del contenido interno/oculto de un nodo: texto que se guarda
// en el nodo pero NO se muestra graficamente. Se ve con F.
export function ContentEditor({
  x,
  y,
  placement,
  initialValue,
  onSave,
  onClose,
}: {
  x: number;
  y: number;
  placement: Placement;
  initialValue: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);

  return (
    <div
      className={`label-picker content-editor placement-${placement}`}
      style={{ left: x, top: y }}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="label-picker-header">
        <span className="label-picker-title">contenido interno</span>
        <button type="button" className="label-picker-close" onClick={onClose} tabIndex={-1}>
          x
        </button>
      </div>
      <textarea
        ref={ref}
        className="content-editor-area"
        rows={6}
        value={text}
        placeholder="Texto interno del nodo (no se muestra en el nodo)..."
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSave(text);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <div className="solver-footer content-editor-footer">
        <button type="button" className="btn btn-ghost" onClick={() => onSave('')} tabIndex={-1}>
          vaciar
        </button>
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => onSave(text)} tabIndex={-1}>
          guardar (Ctrl+Enter)
        </button>
      </div>
      <div className="label-picker-hint">no aparece en el nodo · F para verlo</div>
    </div>
  );
}
