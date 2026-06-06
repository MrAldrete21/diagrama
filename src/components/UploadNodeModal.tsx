import { useMemo, useRef, useState } from 'react';
import type { DiagramNode, BuzonData, BuzonList, BuzonItem } from '../parser/types';
import { uploadAsset, rawUrl, assetKind, type AssetKind } from '../repo/files';
import {
  seedBuzon,
  newId,
  itemComplete,
  listComplete,
  buzonProgress,
} from '../buzon/buzon';

const ROOT_KEY = 'diagrama:filesRoot';

type Preview = { path: string; kind: AssetKind } | null;

// Interfaz del nodo "buzon de progreso" (shape: upload). Panel del lado derecho
// (no modal) organizado en SECCIONES: cada lista es una seccion colapsable con
// sus elementos. Checklist anidado listas -> elementos -> archivos. Un elemento
// se completa con >=1 archivo; una lista cuando todos sus elementos estan; el
// nodo pasa a `done` (status, en App) cuando todas las listas estan completas.
export function UploadNodeModal({
  node,
  onSetBuzon,
  onClose,
}: {
  node: DiagramNode;
  onSetBuzon: (nodeId: string, data: BuzonData) => void;
  onClose: () => void;
}) {
  const root = useMemo(() => {
    try {
      return localStorage.getItem(ROOT_KEY) ?? '';
    } catch {
      return '';
    }
  }, []);

  // Estado local = fuente de verdad mientras el panel esta abierto. Se siembra
  // una vez (migra `items:` viejos a una lista "Pedidos").
  const [data, setData] = useState<BuzonData>(() => seedBuzon(node.buzon, node.items));
  const dataRef = useRef(data);
  dataRef.current = data;

  const [preview, setPreview] = useState<Preview>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [err, setErr] = useState('');
  const [newListName, setNewListName] = useState('');

  const setLocal = (next: BuzonData) => setData(next);
  const commit = (next: BuzonData) => {
    setData(next);
    onSetBuzon(node.id, next);
  };
  const commitNow = () => onSetBuzon(node.id, dataRef.current);

  const toggleCollapse = (listId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });

  const mapLists = (fn: (l: BuzonList) => BuzonList): BuzonData => ({
    lists: data.lists.map(fn),
  });
  const inList = (listId: string, fn: (l: BuzonList) => BuzonList) =>
    mapLists((l) => (l.id === listId ? fn(l) : l));
  const inItem = (listId: string, itemId: string, fn: (it: BuzonItem) => BuzonItem) =>
    inList(listId, (l) => ({ ...l, items: l.items.map((it) => (it.id === itemId ? fn(it) : it)) }));

  const addList = () => {
    const name = newListName.trim() || `Lista ${data.lists.length + 1}`;
    commit({ lists: [...data.lists, { id: newId('l'), name, items: [] }] });
    setNewListName('');
  };
  const removeList = (listId: string) =>
    commit({ lists: data.lists.filter((l) => l.id !== listId) });
  const renameList = (listId: string, name: string) =>
    setLocal(inList(listId, (l) => ({ ...l, name })));

  const addItem = (listId: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    commit(inList(listId, (l) => ({ ...l, items: [...l.items, { id: newId('i'), name: n, files: [] }] })));
  };
  const removeItem = (listId: string, itemId: string) =>
    commit(inList(listId, (l) => ({ ...l, items: l.items.filter((it) => it.id !== itemId) })));
  const renameItem = (listId: string, itemId: string, name: string) =>
    setLocal(inItem(listId, itemId, (it) => ({ ...it, name })));

  const removeFile = (listId: string, itemId: string, path: string) =>
    commit(inItem(listId, itemId, (it) => ({ ...it, files: it.files.filter((f) => f !== path) })));

  const uploadTo = async (listId: string, item: BuzonItem, list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;
    setErr('');
    setBusyItem(item.id);
    const added: string[] = [];
    for (const file of files) {
      const res = await uploadAsset(root, `progreso/${node.id}/${listId}`, file);
      if (res.ok && res.path) added.push(res.path);
    }
    setBusyItem(null);
    if (added.length === 0) {
      setErr('no se pudo subir (¿esta corriendo el dev server?)');
      return;
    }
    const cur = dataRef.current;
    const next: BuzonData = {
      lists: cur.lists.map((l) =>
        l.id !== listId
          ? l
          : {
              ...l,
              items: l.items.map((it) =>
                it.id !== item.id ? it : { ...it, files: [...it.files, ...added.filter((p) => !it.files.includes(p))] },
              ),
            },
      ),
    };
    commit(next);
  };

  const prog = buzonProgress(data);
  const allDone = prog.totalLists > 0 && prog.doneLists === prog.totalLists;

  return (
    <>
      <div
        className="solver-panel buzon-panel"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="solver-header">
          <span className="solver-title" title={node.label || node.id}>
            {node.label || node.id} · progreso
          </span>
          <span className={`buzon-overall ${allDone ? 'is-done' : ''}`}>
            {prog.totalLists > 0 ? `${prog.doneLists}/${prog.totalLists}` : '—'}
            {allDone ? ' ✓' : ''}
          </span>
          <button type="button" className="solver-close" onClick={onClose} aria-label="cerrar" tabIndex={-1}>
            x
          </button>
        </header>

        <div className="buzon-body">
          {data.lists.length === 0 && (
            <div className="buzon-empty">
              Sin secciones todavia. Crea una abajo (ej "Senas L5", "Capturas"…) y
              agregale elementos para subir contenido.
            </div>
          )}

          {data.lists.map((list) => {
            const done = listComplete(list);
            const ld = list.items.filter(itemComplete).length;
            const isCollapsed = collapsed.has(list.id);
            return (
              <section key={list.id} className={`buzon-list ${done ? 'is-done' : ''}`}>
                <div className="buzon-list-head">
                  <button
                    type="button"
                    className="buzon-collapse"
                    onClick={() => toggleCollapse(list.id)}
                    title={isCollapsed ? 'expandir' : 'colapsar'}
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </button>
                  <span className={`buzon-check ${done ? 'is-on' : ''}`}>{done ? '✓' : ''}</span>
                  <input
                    className="buzon-list-name"
                    value={list.name}
                    onChange={(e) => renameList(list.id, e.target.value)}
                    onBlur={commitNow}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <span className="buzon-list-prog">
                    {ld}/{list.items.length}
                  </span>
                  <button
                    type="button"
                    className="files-row-x"
                    title="borrar seccion"
                    onClick={() => removeList(list.id)}
                  >
                    x
                  </button>
                </div>

                {!isCollapsed && (
                  <>
                    {list.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        root={root}
                        item={item}
                        busy={busyItem === item.id}
                        drag={dragItem === item.id}
                        onRename={(name) => renameItem(list.id, item.id, name)}
                        onRenameCommit={commitNow}
                        onRemove={() => removeItem(list.id, item.id)}
                        onUpload={(files) => void uploadTo(list.id, item, files)}
                        onDragState={(on) => setDragItem(on ? item.id : null)}
                        onRemoveFile={(p) => removeFile(list.id, item.id, p)}
                        onPreview={(p, kind) => setPreview({ path: p, kind })}
                      />
                    ))}
                    <AddItem onAdd={(name) => addItem(list.id, name)} />
                  </>
                )}
              </section>
            );
          })}

          {err && <div className="files-panel-err">{err}</div>}
        </div>

        <div className="buzon-add-list">
          <input
            className="conditional-input-field"
            placeholder="nueva seccion…"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') addList();
            }}
          />
          <button type="button" className="btn btn-primary" onClick={addList}>
            + seccion
          </button>
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
    </>
  );
}

function ItemRow({
  root,
  item,
  busy,
  drag,
  onRename,
  onRenameCommit,
  onRemove,
  onUpload,
  onDragState,
  onRemoveFile,
  onPreview,
}: {
  root: string;
  item: BuzonItem;
  busy: boolean;
  drag: boolean;
  onRename: (name: string) => void;
  onRenameCommit: () => void;
  onRemove: () => void;
  onUpload: (files: FileList | File[]) => void;
  onDragState: (on: boolean) => void;
  onRemoveFile: (path: string) => void;
  onPreview: (path: string, kind: AssetKind) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const done = itemComplete(item);
  return (
    <div
      className={`buzon-item ${done ? 'is-done' : ''} ${drag ? 'is-drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragState(true);
      }}
      onDragLeave={() => onDragState(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragState(false);
        onUpload(e.dataTransfer.files);
      }}
    >
      <div className="buzon-item-head">
        <span className={`buzon-check ${done ? 'is-on' : ''}`}>{done ? '✓' : ''}</span>
        <input
          className="buzon-item-name"
          value={item.name}
          onChange={(e) => onRename(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className="buzon-upload-btn"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? '…' : '+ subir'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onUpload(e.target.files);
            e.target.value = '';
          }}
        />
        <button type="button" className="files-row-x" title="borrar elemento" onClick={onRemove}>
          x
        </button>
      </div>
      {item.files.length > 0 && (
        <div className="buzon-files">
          {item.files.map((p) => {
            const kind = assetKind(p);
            const viewable = kind === 'video' || kind === 'image' || kind === 'pdf' || kind === 'audio';
            return (
              <span key={p} className="buzon-file">
                {kind === 'image' ? (
                  <img
                    className="buzon-file-thumb"
                    src={rawUrl(root, p)}
                    alt={p}
                    onClick={() => onPreview(p, kind)}
                  />
                ) : (
                  <button
                    type="button"
                    className="buzon-file-chip"
                    disabled={!viewable}
                    onClick={() => viewable && onPreview(p, kind)}
                    title={p}
                  >
                    {p.split('/').pop()}
                  </button>
                )}
                <button
                  type="button"
                  className="buzon-file-x"
                  title="quitar archivo"
                  onClick={() => onRemoveFile(p)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddItem({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  const submit = () => {
    if (!name.trim()) return;
    onAdd(name);
    setName('');
  };
  return (
    <div className="buzon-add-item">
      <input
        className="buzon-add-item-input"
        placeholder="+ elemento (ej: video de la seña HOLA)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') submit();
        }}
      />
    </div>
  );
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
