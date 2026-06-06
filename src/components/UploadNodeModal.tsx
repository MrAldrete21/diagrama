import { useMemo, useRef, useState } from 'react';
import type { DiagramNode } from '../parser/types';
import { uploadAsset, rawUrl, assetKind, type AssetKind } from '../repo/files';

const ROOT_KEY = 'diagrama:filesRoot';

type Preview = { path: string; kind: AssetKind } | null;

// Interfaz del nodo "buzon de progreso" (shape: upload). El modelo pide archivos
// (los escribe como `items:` via el loop) y el usuario los sube aca: se guardan en
// el repo del proyecto y se vinculan al nodo (attr `assets:`). Preview embebido.
export function UploadNodeModal({
  node,
  onSetAssets,
  onClose,
}: {
  node: DiagramNode;
  onSetAssets: (nodeId: string, paths: string[]) => void;
  onClose: () => void;
}) {
  const root = useMemo(() => {
    try {
      return localStorage.getItem(ROOT_KEY) ?? '';
    } catch {
      return '';
    }
  }, []);

  const requests = node.items ?? [];
  const assets = node.assets ?? [];

  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState<Preview>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doUpload = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;
    setErr('');
    setBusy(true);
    const added: string[] = [];
    for (const file of files) {
      const res = await uploadAsset(root, `progreso/${node.id}`, file);
      if (res.ok && res.path) added.push(res.path);
    }
    setBusy(false);
    if (added.length === 0) {
      setErr('no se pudo subir (¿esta corriendo el dev server?)');
      return;
    }
    const next = [...assets, ...added.filter((p) => !assets.includes(p))];
    onSetAssets(node.id, next);
  };

  const unlink = (path: string) => onSetAssets(node.id, assets.filter((p) => p !== path));

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal upload-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{node.label || node.id} — progreso</h2>
          <button
            type="button"
            className="btn btn-ghost modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            x
          </button>
        </header>

        <div className="modal-body upload-modal-body">
          {requests.length > 0 && (
            <section className="upload-section">
              <div className="upload-section-title">el modelo te pide</div>
              <ul className="upload-requests">
                {requests.map((r, i) => (
                  <li key={i} className="upload-request">
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="upload-section">
            <div className="upload-section-title">
              archivos subidos ({assets.length})
            </div>
            {assets.length === 0 ? (
              <div className="upload-empty">Todavia no subiste nada.</div>
            ) : (
              <div className="upload-grid">
                {assets.map((p) => {
                  const kind = assetKind(p);
                  const viewable = kind === 'video' || kind === 'image' || kind === 'pdf' || kind === 'audio';
                  return (
                    <div key={p} className="upload-asset">
                      <button
                        type="button"
                        className="upload-asset-thumb"
                        disabled={!viewable}
                        onClick={() => viewable && setPreview({ path: p, kind })}
                        title={viewable ? 'ver' : p}
                      >
                        {kind === 'image' ? (
                          <img src={rawUrl(root, p)} alt={p} />
                        ) : (
                          <span className={`upload-asset-kind kind-${kind}`}>{kindLabel(kind)}</span>
                        )}
                      </button>
                      <div className="upload-asset-foot">
                        <span className="upload-asset-name" title={p}>
                          {p.split('/').pop()}
                        </span>
                        <button
                          type="button"
                          className="files-row-x"
                          title="desvincular (no borra el archivo)"
                          onClick={() => unlink(p)}
                        >
                          x
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {err && <div className="files-panel-err">{err}</div>}

          <div
            className={`upload-dropzone ${drag ? 'is-drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void doUpload(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'subiendo…' : 'arrastra archivos aca, o hace click para elegir'}
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) void doUpload(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </div>

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

function kindLabel(kind: AssetKind): string {
  switch (kind) {
    case 'video':
      return 'VIDEO';
    case 'pdf':
      return 'PDF';
    case 'audio':
      return 'AUDIO';
    case 'code':
      return 'CODE';
    case 'doc':
      return 'DOC';
    default:
      return 'FILE';
  }
}

function PreviewMedia({ root, preview }: { root: string; preview: { path: string; kind: AssetKind } }) {
  const url = rawUrl(root, preview.path);
  if (preview.kind === 'video') return <video className="files-preview-media" src={url} controls autoPlay />;
  if (preview.kind === 'audio') return <audio className="files-preview-audio" src={url} controls autoPlay />;
  if (preview.kind === 'image') return <img className="files-preview-media" src={url} alt={preview.path} />;
  if (preview.kind === 'pdf')
    return <iframe className="files-preview-media files-preview-pdf" src={url} title={preview.path} />;
  return (
    <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
      abrir archivo
    </a>
  );
}
