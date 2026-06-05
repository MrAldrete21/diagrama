export type Placement = 'top' | 'bottom';

// Visor (F) del contenido interno de un nodo (solo lectura).
export function ContentView({
  x,
  y,
  placement,
  label,
  content,
  onClose,
}: {
  x: number;
  y: number;
  placement: Placement;
  label: string;
  content: string;
  onClose: () => void;
}) {
  return (
    <div
      className={`label-picker content-view placement-${placement}`}
      style={{ left: x, top: y }}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="label-picker-header">
        <span className="label-picker-title">{label}</span>
        <button type="button" className="label-picker-close" onClick={onClose} tabIndex={-1}>
          x
        </button>
      </div>
      <div className="content-view-body">{content || '(vacio)'}</div>
      <div className="label-picker-hint">F o Shift cierra</div>
    </div>
  );
}
