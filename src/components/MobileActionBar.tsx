import type { ReactNode } from 'react';

// Barra de acciones tactil (fija abajo) que reemplaza los atajos de teclado en
// movil. Scroll horizontal si no entran todos. Las acciones contextuales
// (editar, estilo, labels, borrar) se deshabilitan si no hay nodo seleccionado.

type Props = {
  hasSelection: boolean;
  connectActive: boolean;
  codeActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAddNode: () => void;
  onEditLabel: () => void;
  onStyle: () => void;
  onLabels: () => void;
  onToggleConnect: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onToggleCode: () => void;
  onMore: () => void;
};

function Btn({
  label,
  icon,
  onClick,
  disabled,
  active,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`mobile-action-btn ${active ? 'is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        {icon}
      </svg>
      <span>{label}</span>
    </button>
  );
}

export function MobileActionBar(p: Props) {
  const S = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <div className="mobile-action-bar" role="toolbar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mobile-action-scroll">
        <Btn
          label="nodo"
          onClick={p.onAddNode}
          icon={<><rect x="3" y="6" width="13" height="9" rx="2" {...S} /><line x1="20" y1="9" x2="20" y2="15" {...S} /><line x1="17" y1="12" x2="23" y2="12" {...S} /></>}
        />
        <Btn
          label="editar"
          onClick={p.onEditLabel}
          disabled={!p.hasSelection}
          icon={<><path d="M4 20h4l10-10-4-4L4 16v4z" {...S} /><line x1="13.5" y1="6.5" x2="17.5" y2="10.5" {...S} /></>}
        />
        <Btn
          label="estilo"
          onClick={p.onStyle}
          disabled={!p.hasSelection}
          icon={<><circle cx="12" cy="12" r="8" {...S} /><circle cx="9" cy="9" r="1.3" fill="currentColor" /><circle cx="15" cy="9" r="1.3" fill="currentColor" /><circle cx="9.5" cy="14.5" r="1.3" fill="currentColor" /></>}
        />
        <Btn
          label="labels"
          onClick={p.onLabels}
          disabled={!p.hasSelection}
          icon={<><path d="M3 7l7-3 11 5-4 9-11-5V7z" {...S} /><circle cx="8" cy="9" r="1.4" fill="currentColor" /></>}
        />
        <Btn
          label="conectar"
          onClick={p.onToggleConnect}
          active={p.connectActive}
          icon={<><circle cx="6" cy="6" r="2.5" {...S} /><circle cx="18" cy="18" r="2.5" {...S} /><line x1="8" y1="8" x2="16" y2="16" {...S} /></>}
        />
        <Btn
          label="borrar"
          onClick={p.onDelete}
          disabled={!p.hasSelection}
          icon={<><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" {...S} /></>}
        />
        <Btn
          label="undo"
          onClick={p.onUndo}
          disabled={!p.canUndo}
          icon={<><path d="M9 7L4 12l5 5" {...S} /><path d="M4 12h11a5 5 0 0 1 0 10h-3" {...S} /></>}
        />
        <Btn
          label="redo"
          onClick={p.onRedo}
          disabled={!p.canRedo}
          icon={<><path d="M15 7l5 5-5 5" {...S} /><path d="M20 12H9a5 5 0 0 0 0 10h3" {...S} /></>}
        />
        <Btn
          label="fit"
          onClick={p.onFit}
          icon={<><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...S} /></>}
        />
        <Btn
          label="code"
          onClick={p.onToggleCode}
          active={p.codeActive}
          icon={<><path d="M9 8l-4 4 4 4M15 8l4 4-4 4" {...S} /></>}
        />
        <Btn
          label="mas"
          onClick={p.onMore}
          icon={<><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></>}
        />
      </div>
    </div>
  );
}
