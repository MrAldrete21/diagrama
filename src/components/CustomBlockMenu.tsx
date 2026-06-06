import { useEffect, useRef, useState } from 'react';
import type { LayoutNode } from '../layout/layout';
import type { ListStyle } from '../parser/types';

export type CustomBlockApply =
  | { kind: 'list'; items: string[]; listStyle: ListStyle }
  | { kind: 'note'; content: string }
  | { kind: 'image'; src: string }
  | { kind: 'upload'; items: string[] }
  | { kind: 'rectangle' };

type Tab = 'list' | 'note' | 'image' | 'upload';

export function CustomBlockMenu({
  node,
  onApply,
  onClose,
}: {
  node: LayoutNode;
  onApply: (cfg: CustomBlockApply) => void;
  onClose: () => void;
}) {
  const initialTab: Tab =
    node.shape === 'note'
      ? 'note'
      : node.shape === 'image'
        ? 'image'
        : node.shape === 'upload'
          ? 'upload'
          : 'list';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [items, setItems] = useState((node.items ?? []).join('\n'));
  const [listStyle, setListStyle] = useState<ListStyle>(node.listStyle ?? 'bullets');
  const [content, setContent] = useState(node.content ?? '');
  const [src, setSrc] = useState(node.src ?? '');
  const itemsRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const srcRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-focus the modal root (not a textarea) so WASD nav works immediately.
  // The user can click / Tab into the textarea to type content.
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const firstBtn = modalRef.current?.querySelector<HTMLButtonElement>(
        '.block-type-tab.is-active',
      );
      firstBtn?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);


  const handleApplyList = () => {
    const list = items
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    onApply({ kind: 'list', items: list, listStyle });
  };

  const handleApplyNote = () => {
    onApply({ kind: 'note', content });
  };

  const handleApplyImage = () => {
    onApply({ kind: 'image', src });
  };

  const handleApplyUpload = () => {
    const list = items
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    onApply({ kind: 'upload', items: list });
  };

  const handleBackToRect = () => {
    onApply({ kind: 'rectangle' });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') setSrc(result);
    };
    reader.readAsDataURL(f);
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="modal custom-block-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>Bloque custom — {node.id}</h2>
          <button
            type="button"
            className="btn btn-ghost modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            x
          </button>
        </header>
        <div className="block-type-tabs">
          <button
            type="button"
            className={`block-type-tab ${tab === 'list' ? 'is-active' : ''}`}
            onClick={() => setTab('list')}
          >
            lista
          </button>
          <button
            type="button"
            className={`block-type-tab ${tab === 'note' ? 'is-active' : ''}`}
            onClick={() => setTab('note')}
          >
            note (texto largo)
          </button>
          <button
            type="button"
            className={`block-type-tab ${tab === 'image' ? 'is-active' : ''}`}
            onClick={() => setTab('image')}
          >
            image
          </button>
          <button
            type="button"
            className={`block-type-tab ${tab === 'upload' ? 'is-active' : ''}`}
            onClick={() => setTab('upload')}
          >
            buzon (progreso)
          </button>
        </div>
        <div className="modal-body custom-block-body">
          {tab === 'list' && (
            <section>
              <div className="list-style-toggle">
                <span className="list-style-label">estilo</span>
                <button
                  type="button"
                  className={`list-style-btn ${listStyle === 'bullets' ? 'is-active' : ''}`}
                  onClick={() => setListStyle('bullets')}
                >
                  • bullets
                </button>
                <button
                  type="button"
                  className={`list-style-btn ${listStyle === 'numbered' ? 'is-active' : ''}`}
                  onClick={() => setListStyle('numbered')}
                >
                  1. numbered
                </button>
              </div>
              <p className="custom-block-hint">
                Un item por linea. Ctrl+Enter aplica.
              </p>
              <textarea
                ref={itemsRef}
                className="block-items-input"
                value={items}
                placeholder={'Item 1\nItem 2\nItem 3'}
                rows={8}
                onChange={(e) => setItems(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleApplyList();
                  }
                }}
              />
            </section>
          )}
          {tab === 'image' && (
            <section>
              <p className="custom-block-hint">
                Pega una URL (http/https/data:image), o cargá un archivo local.
                Ctrl+Enter aplica.
              </p>
              <input
                ref={srcRef}
                type="text"
                className="block-items-input"
                value={src}
                placeholder="https://... o data:image/png;base64,..."
                onChange={(e) => setSrc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleApplyImage();
                  }
                }}
                style={{ marginBottom: 10 }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => fileRef.current?.click()}
                >
                  cargar archivo
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  style={{ display: 'none' }}
                />
                {src && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setSrc('')}
                  >
                    limpiar
                  </button>
                )}
              </div>
              {src && (
                <div className="image-preview-wrap">
                  <img src={src} alt="preview" className="image-preview" />
                </div>
              )}
            </section>
          )}
          {tab === 'upload' && (
            <section>
              <p className="custom-block-hint">
                Buzon de progreso: un checklist (listas → elementos → archivos).
                Doble-click sobre el nodo abre la interfaz para crear listas y SUBIR
                contenido. Aca podes sembrar los primeros elementos (uno por linea) —
                arrancan como lista "Pedidos". El nodo pasa a "done" cuando completas
                todas las listas. Ctrl+Enter aplica.
              </p>
              <textarea
                className="block-items-input"
                value={items}
                placeholder={'video de la seña HOLA\nfoto del avatar\ndoc de criterios'}
                rows={8}
                onChange={(e) => setItems(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleApplyUpload();
                  }
                }}
              />
            </section>
          )}
          {tab === 'note' && (
            <section>
              <p className="custom-block-hint">
                Contenido largo tipo Word. El bloque queda chico por default. Con el
                nodo seleccionado, Enter en el canvas lo expande para leer todo.
                Ctrl+Enter aplica.
              </p>
              <textarea
                ref={contentRef}
                className="block-items-input note-content-input"
                value={content}
                placeholder={'Escribi acá tu nota...'}
                rows={12}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleApplyNote();
                  }
                }}
              />
            </section>
          )}
        </div>
        <footer className="custom-block-footer">
          {(node.shape === 'list' ||
            node.shape === 'note' ||
            node.shape === 'image' ||
            node.shape === 'upload') && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleBackToRect}
              title="Vuelve a rectangulo"
            >
              quitar bloque
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={
              tab === 'list'
                ? handleApplyList
                : tab === 'note'
                  ? handleApplyNote
                  : tab === 'image'
                    ? handleApplyImage
                    : handleApplyUpload
            }
            title="Ctrl+Enter"
          >
            aplicar {tab}
          </button>
        </footer>
      </div>
    </div>
  );
}
