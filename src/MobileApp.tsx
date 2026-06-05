import { useEffect, useMemo, useRef, useState } from 'react';
import { useDocStore } from './store/useDocStore';
import { parse } from './parser/parse';
import { layout } from './layout/layout';
import type { LayoutNode, ManualPositions } from './layout/layout';
import { Diagram } from './renderer/Diagram';
import type { Direction } from './renderer/Diagram';
import { PanZoom } from './renderer/PanZoom';
import type { PanZoomHandle, Transform } from './renderer/PanZoom';
import { MobileActionBar } from './components/MobileActionBar';
import { ContextMenu } from './components/ContextMenu';
import type { Placement } from './components/ContextMenu';
import { LabelPicker } from './components/LabelPicker';
import { TabBar } from './components/TabBar';
import { Editor } from './editor/Editor';
import { ExamplesModal } from './components/ExamplesModal';
import { HelpModal } from './components/HelpModal';
import {
  appendNode,
  appendEdge,
  nextNodeId,
  updateNodeLabelInPlace,
  updateNodeAttrInPlace,
  removeNodeAttrInPlace,
  removeNodeFromSource,
} from './source/edit';
import type { Shape } from './parser/types';
import { buildShareUrl } from './share/url';
import { exportSvg } from './export/export';

const GRID = 20;
const DRAG_THRESHOLD = 6;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type Menu = 'none' | 'style' | 'labels';

export function MobileApp() {
  const source = useDocStore((s) => s.source);
  const setSource = useDocStore((s) => s.setSource);
  const manualPositions = useDocStore((s) => s.manualPositions);
  const setManualPosition = useDocStore((s) => s.setManualPosition);
  const setManualPositionsBulk = useDocStore((s) => s.setManualPositionsBulk);
  const manualSizes = useDocStore((s) => s.manualSizes);
  const clearManualSize = useDocStore((s) => s.clearManualSize);
  const clearManualPositions = useDocStore((s) => s.clearManualPositions);
  const pushSnapshot = useDocStore((s) => s.pushSnapshot);
  const undo = useDocStore((s) => s.undo);
  const redo = useDocStore((s) => s.redo);
  const canUndo = useDocStore((s) => s.history.past.length > 0);
  const canRedo = useDocStore((s) => s.history.future.length > 0);
  const theme = useDocStore((s) => s.theme);
  const toggleTheme = useDocStore((s) => s.toggleTheme);
  const tabs = useDocStore((s) => s.tabs);
  const activeId = useDocStore((s) => s.activeId);
  const addTab = useDocStore((s) => s.addTab);
  const switchTab = useDocStore((s) => s.switchTab);
  const closeTab = useDocStore((s) => s.closeTab);
  const labelPrompts = useDocStore((s) => s.labelPrompts);
  const setLabelPrompt = useDocStore((s) => s.setLabelPrompt);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [tool, setTool] = useState<'select' | 'connect'>('select');
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu>('none');
  const [editorOpen, setEditorOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [transform, setTransform] = useState<Transform>({ tx: 0, ty: 0, scale: 1 });
  const [toast, setToast] = useState<string | null>(null);

  const panZoomRef = useRef<PanZoomHandle>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { ast } = useMemo(() => parse(source), [source]);
  const layoutResult = useMemo(() => {
    try {
      const overrides = editingId ? { [editingId]: editingValue } : undefined;
      return layout(ast, manualPositions, manualSizes, overrides);
    } catch {
      return null;
    }
  }, [ast, manualPositions, manualSizes, editingId, editingValue]);

  const isFlowchart = layoutResult?.kind === 'flowchart';
  const nodes = useMemo<LayoutNode[]>(
    () => (layoutResult?.kind === 'flowchart' ? layoutResult.nodes : []),
    [layoutResult],
  );
  const selectedNode = useMemo(
    () => (selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null),
    [selectedId, nodes],
  );
  const editingNode = useMemo(
    () => (editingId ? nodes.find((n) => n.id === editingId) ?? null : null),
    [editingId, nodes],
  );

  const showToast = (m: string) => setToast(m);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const usedColors = useMemo<string[]>(() => {
    if (ast.type !== 'flowchart') return [];
    const set = new Set<string>();
    for (const n of ast.nodes) if (n.color) set.add(n.color);
    return Array.from(set);
  }, [ast]);

  // Congela las posiciones actuales para que editar/mover un nodo no reacomode
  // el resto (Dagre re-fluiria si no estan pinneadas).
  const lockOthers = (exceptId?: string) => {
    if (!isFlowchart) return;
    const snap: ManualPositions = {};
    for (const n of nodes) {
      if (n.id === exceptId) continue;
      snap[n.id] = { x: n.x, y: n.y };
    }
    setManualPositionsBulk(snap);
  };

  // === selection + drag (un dedo sobre un nodo) ===
  const handleNodePointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    if (tool === 'connect') {
      if (!connectFromId) {
        setConnectFromId(id);
        showToast('Toca el segundo nodo');
      } else if (connectFromId !== id) {
        setSource(appendEdge(source, connectFromId, id));
        setConnectFromId(null);
        setTool('select');
        showToast(`Conectado: ${connectFromId} > ${id}`);
      } else {
        setConnectFromId(null);
      }
      return;
    }

    setSelectedId(id);
    setMenu('none');
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = node.x;
    const baseY = node.y;
    const scale = transform.scale || 1;
    let dragging = false;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (!dragging) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        pushSnapshot();
        lockOthers(id);
      }
      const nx = Math.round((baseX + dx) / GRID) * GRID;
      const ny = Math.round((baseY + dy) / GRID) * GRID;
      setManualPosition(id, { x: nx, y: ny });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleCanvasClick = () => {
    if (tool === 'connect') {
      setConnectFromId(null);
      return;
    }
    setSelectedId(null);
    setMenu('none');
  };

  // === crear nodos ===
  const handleAddConnected = (sourceId: string, direction: Direction) => {
    if (!isFlowchart || ast.type !== 'flowchart') return;
    const sn = nodes.find((n) => n.id === sourceId);
    if (!sn) return;
    const existing = new Set(ast.nodes.map((n) => n.id));
    const newId = nextNodeId(existing);
    const W = 120;
    const H = 48;
    const SP = 50;
    let nx = sn.x;
    let ny = sn.y;
    if (direction === 'right') nx = sn.x + sn.width / 2 + SP + W / 2;
    else if (direction === 'left') nx = sn.x - sn.width / 2 - SP - W / 2;
    else if (direction === 'down') ny = sn.y + sn.height / 2 + SP + H / 2;
    else if (direction === 'up') ny = sn.y - sn.height / 2 - SP - H / 2;
    nx = Math.round(nx / GRID) * GRID;
    ny = Math.round(ny / GRID) * GRID;
    lockOthers(sourceId);
    if (!manualPositions[sourceId]) setManualPosition(sourceId, { x: sn.x, y: sn.y });
    setManualPosition(newId, { x: nx, y: ny });
    let next = appendNode(source, newId, 'rectangle');
    next = appendEdge(next, sourceId, newId);
    setSource(next);
    setSelectedId(newId);
  };

  const handleAddNode = () => {
    if (ast.type !== 'flowchart') return;
    if (selectedId) {
      handleAddConnected(selectedId, 'down');
      return;
    }
    const newId = nextNodeId(new Set(ast.nodes.map((n) => n.id)));
    setSource(appendNode(source, newId, 'rectangle'));
    setSelectedId(newId);
  };

  // === editar label ===
  const startEdit = (id: string, clear: boolean) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    lockOthers(id);
    if (!manualPositions[id]) setManualPosition(id, { x: node.x, y: node.y });
    setEditingId(id);
    setEditingValue(clear ? '' : node.label);
    setMenu('none');
  };
  const commitEdit = () => {
    if (!editingId || ast.type !== 'flowchart') {
      setEditingId(null);
      return;
    }
    const node = ast.nodes.find((n) => n.id === editingId);
    if (node) {
      setSource(updateNodeLabelInPlace(source, editingId, node.sourceLine, editingValue));
    }
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  // === atributos del nodo seleccionado (estilo) ===
  const applyAttr = (key: string, value: string) => {
    if (!selectedId || ast.type !== 'flowchart') return;
    const node = ast.nodes.find((n) => n.id === selectedId);
    if (!node) return;
    lockOthers(selectedId);
    setSource(updateNodeAttrInPlace(source, selectedId, node.sourceLine, key, value));
  };
  const clearAttr = (key: string) => {
    if (!selectedId || ast.type !== 'flowchart') return;
    const node = ast.nodes.find((n) => n.id === selectedId);
    if (!node) return;
    setSource(removeNodeAttrInPlace(source, selectedId, node.sourceLine, key));
  };
  const pushRecentColor = (c: string) =>
    setRecentColors((prev) => [c, ...prev.filter((x) => x !== c)].slice(0, 8));

  const handleToggleLabel = (key: string) => {
    if (!selectedId || ast.type !== 'flowchart') return;
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === selectedId);
    if (!node) return;
    const cur = node.labels ?? [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    if (next.length === 0) {
      setSource(removeNodeAttrInPlace(prev, selectedId, node.sourceLine, 'labels'));
    } else {
      setSource(updateNodeAttrInPlace(prev, selectedId, node.sourceLine, 'labels', next.join('; ')));
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    setSource(removeNodeFromSource(source, selectedId));
    setSelectedId(null);
    setMenu('none');
  };

  const handleDuplicate = () => {
    if (!selectedId || ast.type !== 'flowchart') return;
    const node = ast.nodes.find((n) => n.id === selectedId);
    if (!node) return;
    const newId = nextNodeId(new Set(ast.nodes.map((n) => n.id)));
    const attrs: string[] = [];
    if (node.label && node.label !== node.id) attrs.push(`label: ${node.label}`);
    if (node.shape !== 'rectangle') attrs.push(`shape: ${node.shape}`);
    if (node.color) attrs.push(`color: ${node.color}`);
    if (node.textColor) attrs.push(`textColor: ${node.textColor}`);
    if (node.icon) attrs.push(`icon: ${node.icon}`);
    const decl = attrs.length ? `${newId} [${attrs.join(', ')}]` : newId;
    const sn = nodes.find((n) => n.id === selectedId);
    if (sn) setManualPosition(newId, { x: Math.round((sn.x + 30) / GRID) * GRID, y: Math.round((sn.y + 30) / GRID) * GRID });
    setSource(source.replace(/\s*$/, '\n') + decl + '\n');
    setSelectedId(newId);
    setMenu('none');
  };

  const autoContrast = () => {
    if (!selectedNode?.color) return;
    const hex = selectedNode.color.replace('#', '');
    if (hex.length < 6) return;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    applyAttr('textColor', lum > 0.55 ? '#111827' : '#ffffff');
  };

  // === posicion en pantalla de los menus anclados al nodo ===
  const menuPos = useMemo<{ x: number; y: number; placement: Placement } | null>(() => {
    if (!selectedNode || !panZoomRef.current) return null;
    const rect = panZoomRef.current.getContainerRect();
    if (!rect) return null;
    const cx = rect.left + selectedNode.x * transform.scale + transform.tx;
    const topY = rect.top + (selectedNode.y - selectedNode.height / 2) * transform.scale + transform.ty;
    const botY = rect.top + (selectedNode.y + selectedNode.height / 2) * transform.scale + transform.ty;
    const PW = 260;
    const PH = 300;
    const GAP = 12;
    const M = 8;
    const BAR = 96; // alto reservado para la action bar inferior
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = clamp(cx - PW / 2, M, vw - PW - M);
    let placement: Placement = 'bottom';
    let y = botY + GAP;
    if (y + PH > vh - BAR) {
      placement = 'top';
      y = topY - GAP - PH;
      if (y < M) y = M;
    }
    return { x, y, placement };
  }, [selectedNode, transform]);

  const handleShare = async () => {
    const url = buildShareUrl(source);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copiado');
    } catch {
      showToast('No se pudo copiar');
    }
    setMoreOpen(false);
  };

  const handleExportSvg = () => {
    if (svgRef.current) exportSvg(svgRef.current);
    setMoreOpen(false);
  };

  const goDesktop = () => {
    try {
      localStorage.setItem('diagrama:view', 'desktop');
    } catch {
      /* ignore */
    }
    const u = new URL(window.location.href);
    u.searchParams.set('view', 'desktop');
    window.location.href = u.toString();
  };

  return (
    <div className={`mobile-app ${tool === 'connect' ? 'is-connect' : ''}`}>
      <TabBar tabs={tabs} activeId={activeId} onSelect={switchTab} onClose={closeTab} onAdd={addTab} />

      <div className="mobile-canvas">
        {layoutResult ? (
          <PanZoom
            ref={panZoomRef}
            contentWidth={layoutResult.width}
            contentHeight={layoutResult.height}
            onCanvasClick={handleCanvasClick}
            onTransformChange={setTransform}
            cursor={tool === 'connect' ? 'crosshair' : undefined}
          >
            <Diagram
              ref={svgRef}
              layout={layoutResult}
              onNodePointerDown={handleNodePointerDown}
              onNodeDoubleClick={(id) => startEdit(id, false)}
              onAddConnected={tool === 'select' ? handleAddConnected : undefined}
              selectedNodeIds={selectedId ? new Set([selectedId]) : undefined}
              connectFromId={connectFromId}
              editingNode={editingNode}
              editingValue={editingValue}
              onEditingValueChange={setEditingValue}
              onEditingCommit={commitEdit}
              onEditingCancel={cancelEdit}
            />
          </PanZoom>
        ) : (
          <div className="empty">Sin nodos para renderizar</div>
        )}

        {tool === 'connect' && (
          <div className="mobile-tool-hint">
            {connectFromId ? 'Toca el segundo nodo (o el mismo para cancelar)' : 'Toca el primer nodo'}
          </div>
        )}
        {toast && <div className="toast mobile-toast">{toast}</div>}
      </div>

      {/* Menu de estilo (ContextMenu) */}
      {isFlowchart && selectedNode && menu === 'style' && menuPos && !editingNode && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          placement={menuPos.placement}
          currentColor={selectedNode.color}
          currentTextColor={selectedNode.textColor}
          currentStrokeColor={selectedNode.strokeColor}
          currentStrokeWidth={selectedNode.strokeWidth}
          currentShape={selectedNode.shape}
          currentIcon={selectedNode.icon}
          recentColors={recentColors}
          usedColors={usedColors}
          onColorChange={(c) => {
            applyAttr('color', c);
            pushRecentColor(c);
          }}
          onTextColorChange={(c) => applyAttr('textColor', c)}
          onStrokeColorChange={(c) => applyAttr('strokeColor', c)}
          onStrokeWidthChange={(w) => applyAttr('strokeWidth', String(w))}
          onShapeChange={(s: Shape) => applyAttr('shape', s)}
          onIconChange={(v) => applyAttr('icon', v)}
          onClearColor={() => clearAttr('color')}
          onClearTextColor={() => clearAttr('textColor')}
          onClearStroke={() => {
            clearAttr('strokeColor');
            clearAttr('strokeWidth');
          }}
          onClearIcon={() => clearAttr('icon')}
          onResetSize={() => clearManualSize(selectedId!)}
          onAutoContrast={autoContrast}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Menu de labels */}
      {isFlowchart && selectedNode && menu === 'labels' && menuPos && !editingNode && (
        <LabelPicker
          x={menuPos.x}
          y={menuPos.y}
          placement={menuPos.placement}
          currentLabels={ast.type === 'flowchart' ? ast.nodes.find((n) => n.id === selectedId)?.labels ?? [] : []}
          labelPrompts={labelPrompts}
          onEditPrompt={setLabelPrompt}
          onToggle={handleToggleLabel}
          onAddCustom={handleToggleLabel}
          onClose={() => setMenu('none')}
        />
      )}

      {/* Sheet del editor de codigo */}
      {editorOpen && (
        <div className="mobile-sheet mobile-editor-sheet">
          <div className="mobile-sheet-head">
            <span>DSL</span>
            <button type="button" className="btn" onClick={() => setEditorOpen(false)}>
              cerrar
            </button>
          </div>
          <div className="mobile-editor-wrap">
            <Editor value={source} onChange={setSource} errors={[]} theme={theme} />
          </div>
        </div>
      )}

      {/* Sheet "mas" */}
      {moreOpen && (
        <div className="mobile-sheet mobile-more-sheet" onClick={() => setMoreOpen(false)}>
          <div className="mobile-more-grid" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mobile-more-btn" onClick={() => { toggleTheme(); }}>
              tema {theme === 'dark' ? 'claro' : 'oscuro'}
            </button>
            <button type="button" className="mobile-more-btn" onClick={() => { setShowExamples(true); setMoreOpen(false); }}>
              ejemplos
            </button>
            <button type="button" className="mobile-more-btn" onClick={() => { setShowHelp(true); setMoreOpen(false); }}>
              ayuda
            </button>
            <button type="button" className="mobile-more-btn" onClick={handleShare}>
              compartir
            </button>
            <button type="button" className="mobile-more-btn" onClick={handleExportSvg}>
              export SVG
            </button>
            <button type="button" className="mobile-more-btn" onClick={() => { clearManualPositions(); setMoreOpen(false); showToast('Layout reseteado'); }}>
              reset layout
            </button>
            <button type="button" className="mobile-more-btn" onClick={goDesktop}>
              ver desktop
            </button>
            <button type="button" className="mobile-more-btn" onClick={() => setMoreOpen(false)}>
              cerrar
            </button>
          </div>
        </div>
      )}

      {showExamples && (
        <ExamplesModal
          onSelect={(s) => {
            setSource(s);
            clearManualPositions();
            setSelectedId(null);
          }}
          onClose={() => setShowExamples(false)}
        />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      <MobileActionBar
        hasSelection={!!selectedNode}
        connectActive={tool === 'connect'}
        codeActive={editorOpen}
        canUndo={canUndo}
        canRedo={canRedo}
        onAddNode={handleAddNode}
        onEditLabel={() => selectedId && startEdit(selectedId, false)}
        onStyle={() => setMenu((m) => (m === 'style' ? 'none' : 'style'))}
        onLabels={() => setMenu((m) => (m === 'labels' ? 'none' : 'labels'))}
        onToggleConnect={() => {
          setTool((t) => (t === 'connect' ? 'select' : 'connect'));
          setConnectFromId(null);
        }}
        onDelete={handleDelete}
        onUndo={undo}
        onRedo={redo}
        onFit={() => panZoomRef.current?.reset()}
        onToggleCode={() => setEditorOpen((v) => !v)}
        onMore={() => setMoreOpen(true)}
      />
    </div>
  );
}
