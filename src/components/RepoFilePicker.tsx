import { useEffect, useMemo, useState } from 'react';
import { fetchRepoFiles } from '../repo/files';

const ROOT_KEY = 'diagrama:filesRoot';
const SHOWN = 200;

// Picker de archivos REALES del repo (con su path). Reemplaza al file explorer del
// navegador (que solo da el nombre). `root` apunta al proyecto (otro repo) y se
// persiste; vacio = el repo del dev server de diagrama.
export function RepoFilePicker({
  initialSelected,
  onPick,
  onClose,
}: {
  initialSelected: string[];
  onPick: (paths: string[]) => void;
  onClose: () => void;
}) {
  const [root, setRoot] = useState<string>(() => {
    try {
      return localStorage.getItem(ROOT_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [filter, setFilter] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [resolvedRoot, setResolvedRoot] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));

  const load = async (r: string) => {
    setLoading(true);
    const res = await fetchRepoFiles(r);
    setFiles(res.files);
    setResolvedRoot(res.root);
    setTruncated(!!res.truncated);
    setLoading(false);
  };

  useEffect(() => {
    void load(root);
    // solo al montar; recargas manuales via "cargar"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f ? files.filter((p) => p.toLowerCase().includes(f)) : files;
    return list.slice(0, SHOWN);
  }, [files, filter]);

  const toggle = (p: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const applyRoot = () => {
    try {
      localStorage.setItem(ROOT_KEY, root);
    } catch {
      /* ignore */
    }
    void load(root);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal repo-picker" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Archivos del repo</h2>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Cerrar">
            x
          </button>
        </header>
        <div className="modal-body repo-picker-body">
          <div className="repo-picker-root">
            <input
              className="repo-picker-input"
              placeholder="raíz del proyecto (vacío = repo de diagrama)"
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyRoot();
              }}
            />
            <button type="button" className="btn" onClick={applyRoot}>
              cargar
            </button>
          </div>
          <div className="repo-picker-meta">
            {loading
              ? 'cargando…'
              : `${files.length} archivo(s) en ${resolvedRoot || '(repo)'}${truncated ? ' (truncado)' : ''}`}
          </div>
          <input
            className="repo-picker-input"
            placeholder="filtrar (ej: api, .ts, components/)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          <div className="repo-picker-list">
            {shown.map((p) => (
              <button
                key={p}
                type="button"
                className={`repo-picker-item ${selected.has(p) ? 'is-on' : ''}`}
                onClick={() => toggle(p)}
              >
                <span className="repo-picker-check">{selected.has(p) ? '✓' : ''}</span>
                <span className="repo-picker-path">{p}</span>
              </button>
            ))}
            {!loading && shown.length === 0 && (
              <div className="repo-picker-empty">Sin resultados. ¿Es correcta la raíz?</div>
            )}
          </div>
        </div>
        <footer className="import-footer">
          <span className="solver-hint">{selected.size} seleccionado(s)</span>
          <div className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selected.size === 0}
            onClick={() => onPick([...selected])}
          >
            vincular
          </button>
        </footer>
      </div>
    </div>
  );
}
