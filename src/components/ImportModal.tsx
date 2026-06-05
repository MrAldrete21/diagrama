import { useEffect, useMemo, useRef, useState } from 'react';
import { parse } from '../parser/parse';
import { cleanImport } from '../source/importText';
import { loadDiagramLibrary, fetchDiagramLibrary } from '../diagrams/library';

// Modal "prompt -> diagrama": pega el DSL que genero un modelo (o carga un .txt)
// y lo importa como un diagrama nuevo (pestana nueva). Muestra una vista previa
// del parseo (cuantos nodos/conexiones, o errores) antes de generar.

export function ImportModal({
  reloadSignal,
  onImport,
  onPickLibrary,
  onClose,
  onCopyGuide,
  onDownloadGuide,
  onCopyLoopGuide,
}: {
  /** Cambia cuando /diagrams se modifico afuera: re-fetchea la biblioteca. */
  reloadSignal?: number;
  onImport: (text: string) => void;
  /** Abrir un diagrama de la biblioteca (vinculado a su archivo para auto-guardar). */
  onPickLibrary?: (d: { name: string; title: string | null; source: string }) => void;
  onClose: () => void;
  onCopyGuide: () => void;
  onDownloadGuide: () => void;
  /** Copia la guia del loop (para pegar en otro proyecto de Claude Code). */
  onCopyLoopGuide?: () => void;
}) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Biblioteca: diagramas .txt en /diagrams. Inicial via import.meta.glob; al
  // abrir (y con el boton recargar) se refresca en vivo desde el dev server.
  const [library, setLibrary] = useState(() => loadDiagramLibrary());
  const [reloading, setReloading] = useState(false);
  const refreshLibrary = async () => {
    setReloading(true);
    try {
      setLibrary(await fetchDiagramLibrary());
    } finally {
      setReloading(false);
    }
  };
  useEffect(() => {
    void refreshLibrary();
    // refresca tambien cuando /diagrams cambia afuera (auto-reload)
  }, [reloadSignal]);

  const cleaned = useMemo(() => cleanImport(text), [text]);

  // Vista previa: parsea el texto limpio y resume contenido / errores.
  const preview = useMemo(() => {
    if (!cleaned.trim()) return null;
    try {
      const r = parse(cleaned);
      let count = 0;
      let kind = 'flowchart';
      if (r.ast.type === 'flowchart') {
        count = r.ast.nodes.length;
        kind = 'flowchart';
      } else if (r.ast.type === 'sequence') {
        count = r.ast.actors.length;
        kind = 'sequence';
      } else if (r.ast.type === 'er') {
        count = r.ast.tables.length;
        kind = 'er';
      }
      const edges =
        r.ast.type === 'flowchart'
          ? r.ast.edges.length
          : r.ast.type === 'sequence'
            ? r.ast.messages.length
            : r.ast.relations.length;
      return { kind, count, edges, errors: r.errors };
    } catch {
      return { kind: '?', count: 0, edges: 0, errors: [{ line: 0, message: 'No se pudo parsear' }] };
    }
  }, [cleaned]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const canGenerate = !!cleaned.trim() && (preview?.count ?? 0) > 0;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal import-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Importar — prompt a diagrama</h2>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Cerrar">
            x
          </button>
        </header>
        <div className="modal-body import-body">
          <p className="import-intro">
            Pega abajo el diagrama en texto (el DSL) que generó un modelo, o cargá un .txt.
            ¿El modelo no sabe el formato? Pasale la guía con los botones de abajo.
          </p>

          <div className="import-library">
            <div className="import-library-title">
              <span>Biblioteca (carpeta <code>/diagrams</code>)</span>
              <button
                type="button"
                className="import-library-reload"
                onClick={refreshLibrary}
                disabled={reloading}
                title="Releer la carpeta /diagrams"
              >
                {reloading ? '...' : '↻ recargar'}
              </button>
            </div>
            {library.length === 0 ? (
              <div className="import-library-empty">
                Vacía. Guardá archivos <code>.txt</code> en la carpeta <code>diagrams/</code> del
                proyecto y recargá para verlos acá.
              </div>
            ) : (
              <div className="import-library-list">
                {library.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="import-library-item"
                    onClick={() =>
                      onPickLibrary
                        ? onPickLibrary({ name: d.name, title: d.title, source: d.source })
                        : onImport(d.source)
                    }
                    title={`Abrir "${d.title ?? d.name}" (se auto-guarda al archivo)`}
                  >
                    <span className="import-library-name">{d.title ?? d.name}</span>
                    <span className="import-library-file">{d.name}.txt</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="import-toolbar">
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              cargar .txt
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.diag,text/plain"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <span className="import-toolbar-spacer" />
            <button type="button" className="btn btn-ghost" onClick={onCopyGuide} title="Copia la guia del formato (DSL) para pegarsela a Claude">
              guía DSL
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDownloadGuide} title="Descarga la guia del DSL (.txt)">
              ↓
            </button>
            {onCopyLoopGuide && (
              <button type="button" className="btn btn-ghost" onClick={onCopyLoopGuide} title="Copia la guia del loop para pegar en OTRO proyecto de Claude Code">
                guía loop (Claude Code)
              </button>
            )}
          </div>

          <textarea
            className="import-textarea"
            placeholder={'type: flowchart\nUser > API\nAPI > DB [shape: cylinder]'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoFocus
          />

          <div className="import-status">
            {preview === null ? (
              <span className="import-status-muted">Esperando texto…</span>
            ) : preview.errors.length > 0 ? (
              <span className="import-status-error">
                ⚠ {preview.errors.length} error(es): {preview.errors.slice(0, 2).map((e) => `L${e.line}: ${e.message}`).join(' · ')}
              </span>
            ) : (
              <span className="import-status-ok">
                ✓ {preview.kind} · {preview.count} nodo(s) · {preview.edges} conexión(es)
              </span>
            )}
          </div>
        </div>
        <footer className="import-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canGenerate}
            onClick={() => onImport(cleaned)}
          >
            generar en pestaña nueva
          </button>
        </footer>
      </div>
    </div>
  );
}
