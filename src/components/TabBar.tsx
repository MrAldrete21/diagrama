import type { TabMeta } from '../store/useDocStore';

// Barra de pestanas tradicional: una pestania por diagrama abierto + boton "+".
export function TabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onAdd,
}: {
  tabs: TabMeta[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}) {
  const single = tabs.length === 1;
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tab"
          aria-selected={t.id === activeId}
          className={`tab ${t.id === activeId ? 'is-active' : ''}`}
          onClick={() => onSelect(t.id)}
          onAuxClick={(e) => {
            // click del medio cierra la pestania
            if (e.button === 1) {
              e.preventDefault();
              onClose(t.id);
            }
          }}
          title={t.title}
        >
          <span className="tab-title">{t.title || 'sin titulo'}</span>
          <button
            type="button"
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.id);
            }}
            aria-label="cerrar pestania"
            title={single ? 'Vaciar diagrama' : 'Cerrar pestania'}
            tabIndex={-1}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="tab-add"
        onClick={() => onAdd()}
        title="Nueva pestania"
        aria-label="nueva pestania"
      >
        +
      </button>
    </div>
  );
}
