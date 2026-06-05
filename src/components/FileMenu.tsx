import { useEffect, useRef, useState } from 'react';
import type { RecentMeta } from '../fs/recentFiles';

export function FileMenu({
  currentName,
  isDirty,
  recents,
  onNew,
  onOpen,
  onImport,
  onExportSpec,
  autoSpec,
  onToggleAutoSpec,
  onSave,
  onSaveAs,
  onPickRecent,
  onForgetRecent,
}: {
  currentName: string | null;
  isDirty: boolean;
  recents: RecentMeta[];
  onNew: () => void;
  onOpen: () => void;
  onImport?: () => void;
  onExportSpec?: () => void;
  autoSpec?: boolean;
  onToggleAutoSpec?: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPickRecent: (id: string) => void;
  onForgetRecent: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const label = currentName
    ? `${currentName}${isDirty ? ' •' : ''}`
    : isDirty
      ? 'untitled •'
      : 'file';

  return (
    <div className="file-menu" ref={rootRef}>
      <button
        type="button"
        className={`btn ${open ? 'is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Archivo (Ctrl+O abrir, Ctrl+S guardar)"
      >
        {label}
      </button>
      {open && (
        <div className="file-menu-dropdown">
          <button
            type="button"
            className="file-menu-item"
            onClick={() => {
              setOpen(false);
              onNew();
            }}
          >
            <span>nuevo</span>
            <kbd>Ctrl+N</kbd>
          </button>
          <button
            type="button"
            className="file-menu-item"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            <span>abrir...</span>
            <kbd>Ctrl+O</kbd>
          </button>
          {onImport && (
            <button
              type="button"
              className="file-menu-item"
              onClick={() => {
                setOpen(false);
                onImport();
              }}
            >
              <span>importar (prompt)...</span>
              <kbd>Ctrl+I</kbd>
            </button>
          )}
          <button
            type="button"
            className="file-menu-item"
            onClick={() => {
              setOpen(false);
              onSave();
            }}
          >
            <span>guardar</span>
            <kbd>Ctrl+S</kbd>
          </button>
          <button
            type="button"
            className="file-menu-item"
            onClick={() => {
              setOpen(false);
              onSaveAs();
            }}
          >
            <span>guardar como...</span>
            <kbd>Ctrl+Shift+S</kbd>
          </button>
          {(onExportSpec || onToggleAutoSpec) && <div className="file-menu-divider" />}
          {onExportSpec && (
            <button
              type="button"
              className="file-menu-item"
              onClick={() => {
                setOpen(false);
                onExportSpec();
              }}
            >
              <span>exportar spec (design.md)</span>
            </button>
          )}
          {onToggleAutoSpec && (
            <button
              type="button"
              className="file-menu-item"
              onClick={() => onToggleAutoSpec()}
            >
              <span>spec auto-export</span>
              <kbd>{autoSpec ? 'on' : 'off'}</kbd>
            </button>
          )}
          {recents.length > 0 && (
            <>
              <div className="file-menu-divider" />
              <div className="file-menu-section">recientes</div>
              {recents.map((r) => (
                <div key={r.id} className="file-menu-recent">
                  <button
                    type="button"
                    className="file-menu-item file-menu-recent-name"
                    onClick={() => {
                      setOpen(false);
                      onPickRecent(r.id);
                    }}
                    title={r.name}
                  >
                    <span>{r.name}</span>
                  </button>
                  <button
                    type="button"
                    className="file-menu-recent-forget"
                    onClick={(e) => {
                      e.stopPropagation();
                      onForgetRecent(r.id);
                    }}
                    title="Quitar de recientes"
                    aria-label="Quitar"
                  >
                    x
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
