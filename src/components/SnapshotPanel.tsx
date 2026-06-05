import { useState } from 'react';
import {
  listSnapshots,
  saveSnapshot,
  removeSnapshot,
  diffSources,
  type Snapshot,
} from '../snapshots/snapshots';

export function SnapshotPanel({
  currentSource,
  onLoad,
  onDiffPrompt,
  onClose,
}: {
  currentSource: string;
  onLoad: (source: string) => void;
  /** Copia el dev-prompt SOLO de los nodos nuevos respecto al snapshot. */
  onDiffPrompt?: (addedNodeIds: string[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<Snapshot[]>(() => listSnapshots());
  const [name, setName] = useState('');
  const [diffId, setDiffId] = useState<string | null>(null);

  const refresh = () => setList(listSnapshots());

  const handleSave = () => {
    saveSnapshot(name, currentSource);
    setName('');
    refresh();
  };

  const diffSnap = diffId ? list.find((s) => s.id === diffId) : null;
  const diff = diffSnap ? diffSources(diffSnap.source, currentSource) : null;

  return (
    <div
      className="solver-panel"
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="solver-header">
        <span className="solver-title">snapshots</span>
        <button type="button" className="solver-close" onClick={onClose} aria-label="cerrar" tabIndex={-1}>
          x
        </button>
      </header>

      <div className="snapshot-save">
        <input
          className="conditional-input-field"
          placeholder="nombre (ej: v1 MVP)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') handleSave();
          }}
        />
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          guardar actual
        </button>
      </div>

      {list.length === 0 ? (
        <div className="solver-empty">Sin snapshots. Guarda el estado actual.</div>
      ) : (
        <div className="snapshot-list">
          {list.map((s) => (
            <div key={s.id} className="snapshot-row">
              <span className="snapshot-name" title={s.name}>
                {s.name}
              </span>
              <div className="snapshot-actions">
                <button type="button" className="btn btn-ghost" onClick={() => onLoad(s.source)}>
                  cargar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setDiffId(diffId === s.id ? null : s.id)}
                >
                  diff
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    removeSnapshot(s.id);
                    if (diffId === s.id) setDiffId(null);
                    refresh();
                  }}
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {diff && (
        <div className="snapshot-diff">
          <div className="snapshot-diff-title">vs actual (que cambio desde "{diffSnap?.name}")</div>
          <div className="snapshot-diff-cols">
            <div>
              <strong>+ nodos:</strong> {diff.addedNodes.join(', ') || '—'}
              <br />
              <strong>− nodos:</strong> {diff.removedNodes.join(', ') || '—'}
            </div>
            <div>
              <strong>+ edges:</strong> {diff.addedEdges.join(', ') || '—'}
              <br />
              <strong>− edges:</strong> {diff.removedEdges.join(', ') || '—'}
            </div>
          </div>
          {onDiffPrompt && diff.addedNodes.length > 0 && (
            <button
              type="button"
              className="btn btn-primary snapshot-diff-prompt"
              onClick={() => onDiffPrompt(diff.addedNodes)}
            >
              copiar prompt de lo nuevo ({diff.addedNodes.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
