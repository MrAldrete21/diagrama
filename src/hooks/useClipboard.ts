import { useRef } from 'react';
import { useDocStore } from '../store/useDocStore';
import { parse } from '../parser/parse';
import { buildCopySnippet, renameSnippetIds, appendSnippet } from '../source/edit';
import type { DiagramAST } from '../parser/types';
import type { LayoutResult } from '../layout/layout';

// Copy / paste / duplicate de nodos. La copia se sintetiza desde el AST (no
// extrae texto crudo) y se guarda tambien en un ref interno como fallback si
// el portapapeles del SO falla o esta bloqueado. El paste acepta cualquier DSL
// valido (sin marcador) o la copia interna.
export function useClipboard(opts: {
  ast: DiagramAST;
  layoutResult: LayoutResult | null;
  selectedIds: ReadonlySet<string>;
  setSelectedIds: (ids: Set<string>) => void;
  showToast: (msg: string) => void;
}) {
  const { ast, layoutResult, selectedIds, setSelectedIds, showToast } = opts;
  const internalClipboardRef = useRef<string | null>(null);

  const setSource = useDocStore((s) => s.setSource);
  const setManualPosition = useDocStore((s) => s.setManualPosition);
  const setManualSize = useDocStore((s) => s.setManualSize);

  const handleCopy = async () => {
    if (selectedIds.size === 0 || ast.type !== 'flowchart') return;
    const snippet = buildCopySnippet(ast, selectedIds);
    if (!snippet) return;
    // Siempre guardamos internamente por si el clipboard del SO falla.
    internalClipboardRef.current = snippet;
    try {
      await navigator.clipboard.writeText(snippet);
      showToast(`Copiado: ${selectedIds.size}`);
    } catch {
      showToast(`Copiado (interno): ${selectedIds.size}`);
    }
  };

  const handlePaste = async () => {
    if (ast.type !== 'flowchart') return;
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // ignore; usamos el fallback interno abajo
    }
    // Sin marcador: aceptamos el texto del portapapeles si parsea como un
    // flowchart valido (≥1 nodo, sin errores). Si no, usamos la copia interna.
    const looksLikeDsl = (t: string): boolean => {
      if (!t || !t.trim()) return false;
      const r = parse(t);
      return r.ast.type === 'flowchart' && r.ast.nodes.length > 0 && r.errors.length === 0;
    };
    if (!looksLikeDsl(text)) {
      text = internalClipboardRef.current ?? '';
    }
    if (!looksLikeDsl(text)) {
      showToast('Nada que pegar — copiá primero con Ctrl+C');
      return;
    }
    const { source, manualPositions, manualSizes } = useDocStore.getState();
    const existing = new Set(ast.nodes.map((n) => n.id));
    const { text: renamed, newIds, map } = renameSnippetIds(text, existing);
    for (const [oldId, newId] of Object.entries(map)) {
      const pos = manualPositions[oldId];
      if (pos) setManualPosition(newId, { x: pos.x + 40, y: pos.y + 40 });
      const sz = manualSizes[oldId];
      if (sz) setManualSize(newId, sz);
    }
    setSource(appendSnippet(source, renamed));
    setSelectedIds(new Set(newIds));
    showToast(`Pegado: ${newIds.length}`);
  };

  const handleDuplicateSelected = () => {
    if (selectedIds.size === 0 || ast.type !== 'flowchart') return;
    const snippet = buildCopySnippet(ast, selectedIds);
    if (!snippet) return;
    const { source, manualPositions, manualSizes } = useDocStore.getState();
    const existing = new Set(ast.nodes.map((n) => n.id));
    const { text, newIds, map } = renameSnippetIds(snippet, existing);
    for (const [oldId, newId] of Object.entries(map)) {
      const pos = manualPositions[oldId];
      const baseNode = ast.nodes.find((n) => n.id === oldId);
      if (pos) {
        setManualPosition(newId, { x: pos.x + 40, y: pos.y + 40 });
      } else if (baseNode && layoutResult?.kind === 'flowchart') {
        const lay = layoutResult.nodes.find((n) => n.id === oldId);
        if (lay) setManualPosition(newId, { x: lay.x + 40, y: lay.y + 40 });
      }
      const sz = manualSizes[oldId];
      if (sz) setManualSize(newId, sz);
    }
    setSource(appendSnippet(source, text));
    setSelectedIds(new Set(newIds));
    showToast(`Duplicado: ${newIds.length}`);
  };

  return { handleCopy, handlePaste, handleDuplicateSelected };
}
