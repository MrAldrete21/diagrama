import { useEffect, useMemo, useRef, useState } from 'react';
import type { DiagramNode, NodeStatus } from '../parser/types';
import {
  fetchRepoFiles,
  uploadAsset,
  rawUrl,
  assetKind,
  type AssetKind,
} from '../repo/files';

const ROOT_KEY = 'diagrama:filesRoot';

type Preview = { path: string; kind: AssetKind } | null;

// Panel "Archivos / Progreso": muestra ordenadas las listas de file/tests/assets
// de cada nodo, marca cuales existen en el repo, y permite SUBIR evidencia
// (videos/imagenes/docs) que se vincula al nodo via el attr `assets`. El preview
// reproduce video/imagen/pdf embebido. Subir es dev-only (endpoint del server);
// en prod queda solo-lectura.
export function FilesPanel({
  nodes,
  onSetAssets,
  onSelectNode,
  onClose,
}: {
  nodes: DiagramNode[];
  onSetAssets: (nodeId: string, paths: string[]) => void;
  onSelectNode: (id: string) => void;
  onClose: () => void;
}) {
  const root = useMemo(() => {
    try {
      return localStorage.getItem(ROOT_KEY) ?? '';
    } catch {
      return '';
    }
  }, []);

  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Preview>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState('');

  const refreshExisting = async () => {
    const res = await fetchRepoFiles(root);
    setExisting(new Set(res.files));
  };
  useEffect(() => {
    void refreshExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo flagueamos "falta" si el server respondio con archivos (si no, no sabemos).
  const known = existing.size > 0;

  const withFiles = useMemo(
    () => nodes.filter((n) => n.files?.length || n.tests?.length || n.assets?.length),
    [nodes],
  );

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return withFiles;
    return withFiles.filter((n) => {
      if (n.label.toLowerCase().includes(f) || n.id.toLowerCase().includes(f)) return true;
      const all = [...(n.files ?? []), ...(n.tests ?? []), ...(n.assets ?? [])];
      return all.some((p) => p.toLowerCase().includes(f));
    });
  }, [withFiles, filter]);

  const totals = useMemo(() => {
    let files = 0;
    let tests = 0;
    let assets = 0;
    for (const n of withFiles) {
      files += n.files?.length ?? 0;
      tests += n.tests?.length ?? 0;
      assets += n.assets?.length ?? 0;
    }
    return { files, tests, assets };
  }, [withFiles]);

  const doUpload = async (node: DiagramNode, list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;
    setErr('');
    setUploadingId(node.id);
    const added: string[] = [];
    for (const file of files) {
      const res = await uploadAsset(root, `progreso/${node.id}`, file);
      if (res.ok && res.path) added.push(res.path);
    }
    setUploadingId(null);
    if (added.length === 0) {
      setErr('no se pudo subir (¿esta corriendo el dev server?)');
      return;
    }
    const current = node.assets ?? [];
    const next = [...current, ...added.filter((p) => !current.includes(p))];
    onSetAssets(node.id, next);
    void refreshExisting();
  };

  const unlinkAsset = (node: DiagramNode, path: string) => {
    onSetAssets(node.id, (node.assets ?? []).filter((p) => p !== path));
  };

  return (
    <div
      className="solver-panel files-panel"
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="solver-header">
        <span className="solver-title">archivos / progreso</span>
        <button
          type="button"
          className="solver-close"
          onClick={onClose}
          aria-label="cerrar"
          tabIndex={-1}
        >
          x
        </button>
      </header>

      <div className="files-panel-summary">
        {withFiles.length} nodo(s) · {totals.files} archivo(s) · {totals.tests} test(s) · {totals.assets} evidencia(s)
      </div>

      <input
        className="conditional-input-field files-panel-filter"
        placeholder="filtrar por nodo o ruta…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />

      {err && <div className="files-panel-err">{err}</div>}

      {shown.length === 0 ? (
        <div className="solver-empty">
          Ningun nodo tiene archivos. Vincula con Shift+L (archivos) o subi evidencia abajo.
        </div>
      ) : (
        <div className="files-panel-body">
          {shown.map((node) => (
            <div
              key={node.id}
              className={`files-card ${dragId === node.id ? 'is-drag' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragId(node.id);
              }}
              onDragLeave={() => setDragId((d) => (d === node.id ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragId(null);
                void doUpload(node, e.dataTransfer.files);
              }}
            >
              <div className="files-card-head">
                <StatusDot status={node.status} />
                <button
                  type="button"
                  className="files-card-title"
                  title={`seleccionar ${node.id}`}
                  onClick={() => onSelectNode(node.id)}
                >
                  {node.label || node.id}
                </button>
              </div>

              <FileSection
                title="archivos"
                paths={node.files}
                known={known}
                existing={existing}
              />
              <FileSection
                title="tests"
                paths={node.tests}
                known={known}
                existing={existing}
              />

              <div className="files-section">
                <div className="files-section-title files-section-assets">evidencia / avance</div>
                {(node.assets ?? []).map((p) => {
                  const kind = assetKind(p);
                  const viewable = kind === 'video' || kind === 'image' || kind === 'pdf' || kind === 'audio';
                  return (
                    <div key={p} className="files-row files-row-asset">
                      <KindIcon kind={kind} />
                      <button
                        type="button"
                        className="files-row-path files-row-link"
                        disabled={!viewable}
                        onClick={() => viewable && setPreview({ path: p, kind })}
                        title={viewable ? 'ver' : p}
                      >
                        {p}
                      </button>
                      <button
                        type="button"
                        className="files-row-x"
                        title="desvincular (no borra el archivo)"
                        onClick={() => unlinkAsset(node, p)}
                      >
                        x
                      </button>
                    </div>
                  );
                })}
                <UploadButton
                  busy={uploadingId === node.id}
                  onFiles={(list) => void doUpload(node, list)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="files-preview-overlay" onClick={() => setPreview(null)}>
          <div className="files-preview-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="files-preview-close"
              onClick={() => setPreview(null)}
              aria-label="cerrar"
            >
              x
            </button>
            <PreviewMedia root={root} preview={preview} />
            <div className="files-preview-name">{preview.path}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileSection({
  title,
  paths,
  known,
  existing,
}: {
  title: string;
  paths: string[] | undefined;
  known: boolean;
  existing: Set<string>;
}) {
  if (!paths || paths.length === 0) return null;
  return (
    <div className="files-section">
      <div className="files-section-title">{title}</div>
      {paths.map((p) => {
        const missing = known && !existing.has(p);
        return (
          <div key={p} className="files-row" title={p}>
            <KindIcon kind={assetKind(p)} />
            <span className={`files-row-path ${missing ? 'is-missing' : ''}`}>{p}</span>
            {missing && (
              <span className="files-row-warn" title="no existe en el repo">
                ⚠
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadButton({
  busy,
  onFiles,
}: {
  busy: boolean;
  onFiles: (list: FileList) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="files-upload-btn"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {busy ? 'subiendo…' : '+ subir evidencia'}
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

function PreviewMedia({ root, preview }: { root: string; preview: { path: string; kind: AssetKind } }) {
  const url = rawUrl(root, preview.path);
  if (preview.kind === 'video') return <video className="files-preview-media" src={url} controls autoPlay />;
  if (preview.kind === 'audio') return <audio className="files-preview-audio" src={url} controls autoPlay />;
  if (preview.kind === 'image') return <img className="files-preview-media" src={url} alt={preview.path} />;
  if (preview.kind === 'pdf') return <iframe className="files-preview-media files-preview-pdf" src={url} title={preview.path} />;
  return (
    <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
      abrir archivo
    </a>
  );
}

const STATUS_COLOR: Record<NodeStatus, string> = {
  todo: '#94a3b8',
  wip: '#f59e0b',
  done: '#22c55e',
  blocked: '#ef4444',
};

function StatusDot({ status }: { status?: NodeStatus }) {
  if (!status) return <span className="files-status-dot files-status-none" />;
  return (
    <span
      className="files-status-dot"
      style={{ background: STATUS_COLOR[status] }}
      title={status}
    />
  );
}

function KindIcon({ kind }: { kind: AssetKind }) {
  const sz = 13;
  const common = { width: sz, height: sz, viewBox: '0 0 16 16', fill: 'none' } as const;
  switch (kind) {
    case 'video':
      return (
        <svg {...common} className="files-kind files-kind-media">
          <rect x="1.5" y="3.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M11 6.5 L14.5 4.5 L14.5 11.5 L11 9.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common} className="files-kind files-kind-media">
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="5.5" cy="6" r="1.3" fill="currentColor" />
          <path d="M2.5 12 L6 8.5 L9 11 L11.5 8.5 L14 11" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case 'pdf':
    case 'doc':
      return (
        <svg {...common} className="files-kind">
          <path d="M4 1.5 H10 L13 4.5 V14 H4 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M10 1.5 V4.5 H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case 'audio':
      return (
        <svg {...common} className="files-kind files-kind-media">
          <path d="M9 2 L9 14 M9 4 L5 6 H2 V10 H5 L9 12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M11.5 5 a3 3 0 0 1 0 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'code':
      return (
        <svg {...common} className="files-kind">
          <path d="M6 4 L2.5 8 L6 12 M10 4 L13.5 8 L10 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...common} className="files-kind">
          <path d="M4 1.5 H10 L13 4.5 V14 H4 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
  }
}
