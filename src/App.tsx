import { useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from './editor/Editor';
import type { EditorHandle } from './editor/Editor';
import { Diagram } from './renderer/Diagram';
import type { Direction as ConnectDir, EdgeKey } from './renderer/Diagram';
import type { LayoutEdge } from './layout/layout';
import { PanZoom } from './renderer/PanZoom';
import type { PanZoomHandle, Transform } from './renderer/PanZoom';
import type { ResizeCorner } from './renderer/Node';
import { Resizer } from './components/Resizer';
import { Palette } from './components/Palette';
import { ShortcutBar } from './components/ShortcutBar';
import { TabBar } from './components/TabBar';
import { useNodeMenu } from './hooks/useNodeMenu';
import { useClipboard } from './hooks/useClipboard';
import type { Tool } from './components/Palette';
import { ExamplesModal } from './components/ExamplesModal';
import { HelpModal } from './components/HelpModal';
import { ImportModal } from './components/ImportModal';
import { fetchDiagramLibrary } from './diagrams/library';
import { LinterPanel } from './components/LinterPanel';
import { SnapshotPanel } from './components/SnapshotPanel';
import { FilesPanel } from './components/FilesPanel';
import { UploadNodeModal } from './components/UploadNodeModal';
import { encodeBuzon, computeBuzonStatus } from './buzon/buzon';
import type { BuzonData } from './parser/types';
import { RepoFilePicker } from './components/RepoFilePicker';
import { lintDiagram } from './lint/lintDiagram';
import { ContextMenu } from './components/ContextMenu';
import type { Placement } from './components/ContextMenu';
import { CustomBlockMenu } from './components/CustomBlockMenu';
import type { CustomBlockApply } from './components/CustomBlockMenu';
import { AttributePicker } from './components/AttributePicker';
import type { AttrKey } from './components/AttributePicker';
import { AttributeEditor } from './components/AttributeEditor';
import { LabelPicker } from './components/LabelPicker';
import { ConstraintMenu } from './components/ConstraintMenu';
import { ContentEditor } from './components/ContentEditor';
import { ContentView } from './components/ContentView';
import { NodeSearch } from './components/NodeSearch';
import { ZoomControls } from './components/ZoomControls';
import { EdgeMenu } from './components/EdgeMenu';
import type { ArrowType, EdgeStyle } from './parser/types';
import { SolverPanel } from './components/SolverPanel';
import { PromptGenPanel } from './components/PromptGenPanel';
import type { PromptScope } from './components/PromptGenPanel';
import { buildDevPrompt } from './promptgen/buildDevPrompt';
import { FileMenu } from './components/FileMenu';
import { useFileOps } from './hooks/useFileOps';
import { groupAst } from './solver/groupAst';
import { buildSystemPrompt, buildUserPrompt } from './solver/buildPrompt';
import type { TaskType } from './solver/buildPrompt';
import { callSolver } from './solver/client';
import type { SolverResponse } from './solver/client';
import { applyActions } from './solver/applyActions';
import { useDocStore } from './store/useDocStore';
import { parse } from './parser/parse';
import { layout } from './layout/layout';
import { exportPng, exportSvg } from './export/export';
import { buildShareUrl } from './share/url';
import type { Shape } from './parser/types';
import type { ManualPositions } from './layout/layout';
import {
  appendEdge,
  appendNode,
  nextNodeId,
  removeEdgeAttrInPlace,
  removeEdgeFromSource,
  updateEdgeArrowInPlace,
  reverseEdgeInPlace,
  updateEdgeAttrInPlace,
  removeNodeAttrInPlace,
  removeNodeFromSource,
  setNodeConstraints,
  updateNodeAttrInPlace,
  updateNodeLabelInPlace,
} from './source/edit';
import './App.css';

const GRID = 20;
const DRAG_THRESHOLD = 4;
const MIN_NODE_SIZE = 40;
const MAX_RECENT_COLORS = 8;
/** Pixels (screen space) within which alignment snap kicks in. */
const SNAP_THRESHOLD = 6;

function App() {
  const source = useDocStore((s) => s.source);
  const setSource = useDocStore((s) => s.setSource);
  const manualPositions = useDocStore((s) => s.manualPositions);
  const setManualPosition = useDocStore((s) => s.setManualPosition);
  const setManualPositionsBulk = useDocStore((s) => s.setManualPositionsBulk);
  const pushSnapshot = useDocStore((s) => s.pushSnapshot);
  const manualSizes = useDocStore((s) => s.manualSizes);
  const setManualSize = useDocStore((s) => s.setManualSize);
  const clearManualSize = useDocStore((s) => s.clearManualSize);
  const clearManualPositions = useDocStore((s) => s.clearManualPositions);
  const resetSource = useDocStore((s) => s.resetSource);
  const theme = useDocStore((s) => s.theme);
  const toggleTheme = useDocStore((s) => s.toggleTheme);
  const editorWidthPercent = useDocStore((s) => s.editorWidthPercent);
  const setEditorWidthPercent = useDocStore((s) => s.setEditorWidthPercent);
  const undo = useDocStore((s) => s.undo);
  const redo = useDocStore((s) => s.redo);
  const showEditor = useDocStore((s) => s.showEditor);
  const toggleEditor = useDocStore((s) => s.toggleEditor);
  const autoFocus = useDocStore((s) => s.autoFocus);
  const toggleAutoFocus = useDocStore((s) => s.toggleAutoFocus);
  const canvasOnly = useDocStore((s) => s.canvasOnly);
  const toggleCanvasOnly = useDocStore((s) => s.toggleCanvasOnly);
  const labelPrompts = useDocStore((s) => s.labelPrompts);
  const setLabelPrompt = useDocStore((s) => s.setLabelPrompt);
  const tabs = useDocStore((s) => s.tabs);
  const activeTabId = useDocStore((s) => s.activeId);
  const addTab = useDocStore((s) => s.addTab);
  const switchTab = useDocStore((s) => s.switchTab);
  const closeTab = useDocStore((s) => s.closeTab);

  const svgRef = useRef<SVGSVGElement>(null);
  const editorRef = useRef<EditorHandle>(null);
  const panZoomRef = useRef<PanZoomHandle>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragGuides, setDragGuides] = useState<{ x: readonly number[]; y: readonly number[] }>({ x: [], y: [] });
  const [cursorLine, setCursorLine] = useState<number>(1);
  const [toast, setToast] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExamples, setShowExamples] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [linterOpen, setLinterOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [filesPanelOpen, setFilesPanelOpen] = useState(false);
  // Nodo "buzon de progreso" cuya interfaz de subida esta abierta (shape: upload).
  const [uploadNodeId, setUploadNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState<Transform>({ tx: 0, ty: 0, scale: 1 });
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [menuFocused, setMenuFocused] = useState(false);
  // Menus anclados al nodo: un solo estado (mutuamente exclusivos). Los consts
  // derivados conservan los nombres usados en todo el render/handlers.
  const nodeMenu = useNodeMenu();
  const customBlockOpen = nodeMenu.active === 'custom-block';
  const attrPickerOpen = nodeMenu.active === 'attr-picker';
  const attrEditorOpen = nodeMenu.active === 'attr-editor';
  const contextMenuOpen = nodeMenu.active === 'context';
  const labelPickerOpen = nodeMenu.active === 'label';
  const constraintMenuOpen = nodeMenu.active === 'constraint';
  const contentEditorOpen = nodeMenu.active === 'content-edit';
  const contentViewOpen = nodeMenu.active === 'content-view';
  const [nodeSearchOpen, setNodeSearchOpen] = useState(false);
  // When set, the LabelPicker is in "create with label" mode (opened via
  // F+WASD). Enter on a label creates a connected node in that direction
  // instead of toggling the label on the current node.
  const [pendingCreateDir, setPendingCreateDir] = useState<ConnectDir | null>(null);
  // Connect condicional (Shift + / + WASD): cuando hay direccion seteada se abre
  // una barra para escribir la condicion. Enter materializa el connect (nodo
  // nuevo si no hay vecino en esa direccion, o solo el edge si ya existe uno).
  const [conditionalDir, setConditionalDir] = useState<ConnectDir | null>(null);
  const [conditionalText, setConditionalText] = useState('');
  // Shift+L abre la barra de archivos del nodo (textarea, una ruta por linea).
  // El boton "del repo" abre el picker de archivos reales del proyecto (con path).
  const [filesEditId, setFilesEditId] = useState<string | null>(null);
  const [filesText, setFilesText] = useState('');
  // Shift+J: gemelo de Shift+L pero para el attr `tests` (archivos de test).
  const [testsEditId, setTestsEditId] = useState<string | null>(null);
  const [testsText, setTestsText] = useState('');
  // El picker de archivos del repo sirve para ambos: escribe en file o tests.
  const [repoPickerTarget, setRepoPickerTarget] = useState<'file' | 'tests' | null>(null);
  // Remembers the last label the user picked (via LabelPicker). Used by
  // F+WASD to auto-tag freshly created connected nodes.
  const lastLabelRef = useRef<string>('feature');

  // Prompt generator state
  const [promptGenOpen, setPromptGenOpen] = useState(false);

  // Solver state
  const [solverOpen, setSolverOpen] = useState(false);
  const [solverRunning, setSolverRunning] = useState(false);
  const [solverResponse, setSolverResponse] = useState<SolverResponse | null>(null);
  const [solverError, setSolverError] = useState<string | null>(null);

  // Evita que Ctrl+wheel / pinch del trackpad zoomee toda la pagina del browser:
  // preventDefault en window capture phase. El handler de PanZoom igual corre
  // (preventDefault no corta la propagacion), asi el zoom queda solo en el canvas.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', onWheel, true);
  }, []);

  const [selectedEdgeKey, setSelectedEdgeKey] = useState<EdgeKey | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const pushRecentColor = (c: string) => {
    if (!c || !/^#[0-9a-f]{6}$/i.test(c)) return;
    setRecentColors((cur) => {
      const lower = c.toLowerCase();
      const filtered = cur.filter((x) => x.toLowerCase() !== lower);
      return [lower, ...filtered].slice(0, MAX_RECENT_COLORS);
    });
  };

  const parseResult = useMemo(() => parse(source), [source]);
  const { ast, errors, sourceMap } = parseResult;

  const layoutResult = useMemo(() => {
    try {
      // While editing, feed the live typed value into the size calc so the
      // node grows / shrinks in real time, not only after Enter.
      const labelOverrides = editingNodeId
        ? { [editingNodeId]: editingValue }
        : undefined;
      return layout(
        ast,
        manualPositions,
        manualSizes,
        labelOverrides,
        expandedNoteIds,
      );
    } catch (err) {
      console.error('layout error', err);
      return null;
    }
  }, [ast, manualPositions, manualSizes, editingNodeId, editingValue, expandedNoteIds]);

  const highlightedNodeIds = useMemo<ReadonlySet<string>>(() => {
    const ids = sourceMap.lineToNodes.get(cursorLine);
    return new Set(ids ?? []);
  }, [sourceMap, cursorLine]);

  const editingNode = useMemo(() => {
    if (!editingNodeId || !layoutResult) return null;
    if (layoutResult.kind !== 'flowchart') return null;
    return layoutResult.nodes.find((n) => n.id === editingNodeId) ?? null;
  }, [editingNodeId, layoutResult]);

  const singleSelectedNode = useMemo(() => {
    if (selectedIds.size !== 1 || !layoutResult) return null;
    if (layoutResult.kind !== 'flowchart') return null;
    const id = Array.from(selectedIds)[0];
    return layoutResult.nodes.find((n) => n.id === id) ?? null;
  }, [selectedIds, layoutResult]);

  const allNodeIds = useMemo(() => {
    if (!layoutResult) return new Set<string>();
    if (layoutResult.kind === 'flowchart')
      return new Set(layoutResult.nodes.map((n) => n.id));
    if (layoutResult.kind === 'er')
      return new Set(layoutResult.tables.map((t) => t.id));
    if (layoutResult.kind === 'sequence')
      return new Set(layoutResult.actors.map((a) => a.id));
    return new Set<string>();
  }, [layoutResult]);

  const usedColors = useMemo<string[]>(() => {
    if (ast.type !== 'flowchart') return [];
    const set = new Set<string>();
    for (const n of ast.nodes) {
      if (n.color) set.add(n.color.toLowerCase());
      if (n.textColor) set.add(n.textColor.toLowerCase());
      if (n.strokeColor) set.add(n.strokeColor.toLowerCase());
    }
    for (const e of ast.edges) if (e.color) set.add(e.color.toLowerCase());
    return Array.from(set);
  }, [ast]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setSelectedIds((cur) => {
      const next = new Set<string>();
      for (const id of cur) if (allNodeIds.has(id)) next.add(id);
      return next.size === cur.size ? cur : next;
    });
  }, [allNodeIds]);

  // Turn off keyboard menu mode automatically when its context menu disappears
  // (selection cleared, multi-select, editing label, etc.)
  useEffect(() => {
    if (menuFocused && (!singleSelectedNode || !!editingNodeId)) {
      setMenuFocused(false);
    }
  }, [menuFocused, singleSelectedNode, editingNodeId]);

  // Auto-cierre de los menus anclados al nodo cuando el target desaparece o se
  // entra a editar. 'content-view' tambien se cierra si el nodo se queda sin
  // contenido. Un solo efecto para todos (antes eran ~7 duplicados).
  useEffect(() => {
    const a = nodeMenu.active;
    if (!a) return;
    if (a === 'content-view') {
      if (!singleSelectedNode || !singleSelectedNode.content) nodeMenu.close();
    } else if (!singleSelectedNode || editingNodeId) {
      nodeMenu.close();
    }
  }, [nodeMenu, singleSelectedNode, editingNodeId]);

  // When entering keyboard menu mode, move focus to the first item inside the
  // context menu so WASD picks it up. Defer one frame so the menu is mounted.
  useEffect(() => {
    if (!menuFocused) return;
    const id = requestAnimationFrame(() => {
      const first = document.querySelector(
        '.context-menu button, .context-menu input',
      );
      if (first instanceof HTMLElement) first.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [menuFocused]);

  // Auto-select first node on initial mount so the user can start with the
  // keyboard immediately (Shift+E to rename, Shift+D to chain, etc.).
  const didInitialSelectRef = useRef(false);
  useEffect(() => {
    if (didInitialSelectRef.current) return;
    if (!layoutResult) return;
    let firstId: string | null = null;
    if (layoutResult.kind === 'flowchart' && layoutResult.nodes.length > 0) {
      firstId = layoutResult.nodes[0].id;
    } else if (layoutResult.kind === 'er' && layoutResult.tables.length > 0) {
      firstId = layoutResult.tables[0].id;
    } else if (layoutResult.kind === 'sequence' && layoutResult.actors.length > 0) {
      firstId = layoutResult.actors[0].id;
    }
    if (!firstId) return;
    didInitialSelectRef.current = true;
    setSelectedIds(new Set([firstId]));
  }, [layoutResult]);

  // Auto-focus: when enabled and exactly one node is selected, center the camera on it.
  // Tracks last-centered id to avoid re-centering on every drag/resize/source change.
  const lastCenteredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoFocus) {
      lastCenteredRef.current = null;
      return;
    }
    if (selectedIds.size !== 1 || !layoutResult) return;
    const id = Array.from(selectedIds)[0];
    if (id === lastCenteredRef.current) return;
    let target: { x: number; y: number } | null = null;
    if (layoutResult.kind === 'flowchart') {
      const n = layoutResult.nodes.find((n) => n.id === id);
      if (n) target = { x: n.x, y: n.y };
    } else if (layoutResult.kind === 'er') {
      const t = layoutResult.tables.find((t) => t.id === id);
      if (t) target = { x: t.x, y: t.y };
    }
    if (!target) return;
    lastCenteredRef.current = id;
    panZoomRef.current?.centerOn(target.x, target.y);
  }, [selectedIds, autoFocus, layoutResult]);

  // Al cambiar de pestania: guarda/restaura el archivo asociado por tab, resetea
  // la UI efimera (seleccion, paneles) y reencuadra la camara en el diagrama nuevo.
  const prevActiveTabRef = useRef(activeTabId);
  useEffect(() => {
    const prev = prevActiveTabRef.current;
    if (prev === activeTabId) return;
    // Selecciona el primer nodo del diagrama nuevo para que el workflow con
    // teclado (Shift+S crear, Shift+E editar, etc.) funcione sin click previo.
    let firstId: string | null = null;
    if (layoutResult?.kind === 'flowchart' && layoutResult.nodes.length > 0) {
      firstId = layoutResult.nodes[0].id;
    } else if (layoutResult?.kind === 'er' && layoutResult.tables.length > 0) {
      firstId = layoutResult.tables[0].id;
    } else if (layoutResult?.kind === 'sequence' && layoutResult.actors.length > 0) {
      firstId = layoutResult.actors[0].id;
    }
    setSelectedIds(firstId ? new Set([firstId]) : new Set());
    setSelectedEdgeKey(null);
    setExpandedNoteIds(new Set());
    setConnectFromId(null);
    setEditingNodeId(null);
    setTool('select');
    nodeMenu.close();
    setMenuFocused(false);
    lastCenteredRef.current = null;
    requestAnimationFrame(() => panZoomRef.current?.reset());
    prevActiveTabRef.current = activeTabId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const menuScreenPos = useMemo<{ x: number; y: number; placement: Placement } | null>(() => {
    if (!singleSelectedNode || !panZoomRef.current) return null;
    const rect = panZoomRef.current.getContainerRect();
    if (!rect) return null;

    const nodeCenterX =
      rect.left + singleSelectedNode.x * transform.scale + transform.tx;
    const nodeTopY =
      rect.top +
      (singleSelectedNode.y - singleSelectedNode.height / 2) * transform.scale +
      transform.ty;
    const nodeBottomY =
      rect.top +
      (singleSelectedNode.y + singleSelectedNode.height / 2) * transform.scale +
      transform.ty;

    const MENU_W = 260;
    const MENU_H_EST = 340; // rough estimate; content scrolls if larger
    const GAP = 14;
    const MARGIN = 12;
    const vw =
      typeof window !== 'undefined' ? window.innerWidth : MENU_W + MARGIN * 2;
    const vh =
      typeof window !== 'undefined' ? window.innerHeight : MENU_H_EST + MARGIN * 2;

    // X: centered above node, clamped to viewport
    let x = nodeCenterX - MENU_W / 2;
    x = Math.max(MARGIN, Math.min(vw - MENU_W - MARGIN, x));

    // Y: try above; if no room, place below; clamp to viewport
    let placement: Placement = 'top';
    let y = nodeTopY - GAP - MENU_H_EST;
    if (y < MARGIN) {
      placement = 'bottom';
      y = nodeBottomY + GAP;
      if (y + MENU_H_EST > vh - MARGIN) {
        y = Math.max(MARGIN, vh - MENU_H_EST - MARGIN);
      }
    }
    return { x, y, placement };
  }, [singleSelectedNode, transform]);

  const labelPickerScreenPos = useMemo<{ x: number; y: number; placement: Placement } | null>(() => {
    if (!singleSelectedNode || !panZoomRef.current) return null;
    const rect = panZoomRef.current.getContainerRect();
    if (!rect) return null;
    const nodeCenterX = rect.left + singleSelectedNode.x * transform.scale + transform.tx;
    const nodeTopY =
      rect.top + (singleSelectedNode.y - singleSelectedNode.height / 2) * transform.scale + transform.ty;
    const nodeBottomY =
      rect.top + (singleSelectedNode.y + singleSelectedNode.height / 2) * transform.scale + transform.ty;
    const PW = 280;
    const PH = 280;
    const GAP = 14;
    const MARGIN = 12;
    const vw = typeof window !== 'undefined' ? window.innerWidth : PW + MARGIN * 2;
    const vh = typeof window !== 'undefined' ? window.innerHeight : PH + MARGIN * 2;
    let x = nodeCenterX - PW / 2;
    x = Math.max(MARGIN, Math.min(vw - PW - MARGIN, x));
    let placement: Placement = 'bottom';
    let y = nodeBottomY + GAP;
    if (y + PH > vh - MARGIN) {
      placement = 'top';
      y = nodeTopY - GAP - PH;
      if (y < MARGIN) y = Math.max(MARGIN, vh - PH - MARGIN);
    }
    return { x, y, placement };
  }, [singleSelectedNode, transform]);

  const attrEditorScreenPos = useMemo<{ x: number; y: number; placement: Placement } | null>(() => {
    if (!singleSelectedNode || !panZoomRef.current) return null;
    const rect = panZoomRef.current.getContainerRect();
    if (!rect) return null;
    const nodeCenterX = rect.left + singleSelectedNode.x * transform.scale + transform.tx;
    const nodeTopY =
      rect.top + (singleSelectedNode.y - singleSelectedNode.height / 2) * transform.scale + transform.ty;
    const nodeBottomY =
      rect.top + (singleSelectedNode.y + singleSelectedNode.height / 2) * transform.scale + transform.ty;
    const PW = 280;
    const PH = 220;
    const GAP = 14;
    const MARGIN = 12;
    const vw = typeof window !== 'undefined' ? window.innerWidth : PW + MARGIN * 2;
    const vh = typeof window !== 'undefined' ? window.innerHeight : PH + MARGIN * 2;
    let x = nodeCenterX - PW / 2;
    x = Math.max(MARGIN, Math.min(vw - PW - MARGIN, x));
    let placement: Placement = 'bottom';
    let y = nodeBottomY + GAP;
    if (y + PH > vh - MARGIN) {
      placement = 'top';
      y = nodeTopY - GAP - PH;
      if (y < MARGIN) y = Math.max(MARGIN, vh - PH - MARGIN);
    }
    return { x, y, placement };
  }, [singleSelectedNode, transform]);

  const attrPickerScreenPos = useMemo<{ x: number; y: number; placement: Placement } | null>(() => {
    if (!singleSelectedNode || !panZoomRef.current) return null;
    const rect = panZoomRef.current.getContainerRect();
    if (!rect) return null;
    const nodeCenterX = rect.left + singleSelectedNode.x * transform.scale + transform.tx;
    const nodeTopY =
      rect.top + (singleSelectedNode.y - singleSelectedNode.height / 2) * transform.scale + transform.ty;
    const nodeBottomY =
      rect.top + (singleSelectedNode.y + singleSelectedNode.height / 2) * transform.scale + transform.ty;
    const PW = 230;
    const PH = 90;
    const GAP = 14;
    const MARGIN = 12;
    const vw = typeof window !== 'undefined' ? window.innerWidth : PW + MARGIN * 2;
    const vh = typeof window !== 'undefined' ? window.innerHeight : PH + MARGIN * 2;
    let x = nodeCenterX - PW / 2;
    x = Math.max(MARGIN, Math.min(vw - PW - MARGIN, x));
    // Prefer below the node so it doesn't clash with the ContextMenu (which prefers above)
    let placement: Placement = 'bottom';
    let y = nodeBottomY + GAP;
    if (y + PH > vh - MARGIN) {
      placement = 'top';
      y = nodeTopY - GAP - PH;
      if (y < MARGIN) y = Math.max(MARGIN, vh - PH - MARGIN);
    }
    return { x, y, placement };
  }, [singleSelectedNode, transform]);

  const showToast = (msg: string) => setToast(msg);

  const {
    currentFile,
    isDirty,
    recentFiles,
    handleFileNew,
    handleFileOpen,
    handleFileSave,
    handleFileSaveAs,
    handlePickRecent,
    handleForgetRecent,
  } = useFileOps({ activeTabId, showToast });

  const blurActiveElement = () => {
    if (typeof document === 'undefined') return;
    const a = document.activeElement;
    if (a && 'blur' in a) (a as HTMLElement).blur();
  };

  const handleNodePointerDown = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (!layoutResult) return;
    e.stopPropagation();
    e.preventDefault();

    let nodeX = 0;
    let nodeY = 0;
    let sourceLine = 1;
    let foundNode = false;
    if (layoutResult.kind === 'flowchart') {
      const n = layoutResult.nodes.find((n) => n.id === id);
      if (n) {
        nodeX = n.x;
        nodeY = n.y;
        sourceLine = n.sourceLine;
        foundNode = true;
      }
    } else if (layoutResult.kind === 'er') {
      const t = layoutResult.tables.find((t) => t.id === id);
      if (t) {
        nodeX = t.x;
        nodeY = t.y;
        sourceLine = t.sourceLine;
        foundNode = true;
      }
    } else if (layoutResult.kind === 'sequence') {
      const a = layoutResult.actors.find((a) => a.id === id);
      if (a) {
        sourceLine = a.sourceLine;
        foundNode = true;
      }
    }
    if (!foundNode) return;

    if (tool === 'connect' && layoutResult.kind === 'flowchart') {
      if (!connectFromId) {
        setConnectFromId(id);
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

    // Selecting a node clears any edge selection
    setSelectedEdgeKey(null);

    if (e.shiftKey) {
      setSelectedIds((cur) => {
        const next = new Set(cur);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      blurActiveElement();
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = nodeX;
    const baseY = nodeY;
    let dragStarted = false;
    const draggableKinds = layoutResult.kind === 'flowchart' || layoutResult.kind === 'er';

    // If the clicked node is part of a multi-selection (size > 1), drag the
    // whole group together preserving relative offsets. Otherwise single-drag.
    const groupBases =
      selectedIds.has(id) && selectedIds.size > 1 && layoutResult.kind === 'flowchart'
        ? (() => {
            const m = new Map<string, { x: number; y: number }>();
            for (const n of layoutResult.nodes) {
              if (selectedIds.has(n.id)) m.set(n.id, { x: n.x, y: n.y });
            }
            return m;
          })()
        : null;

    // Anchor node's size for snap math; the snap target is the anchor.
    const anchorNode = layoutResult.kind === 'flowchart'
      ? layoutResult.nodes.find((n) => n.id === id)
      : null;
    const anchorW = anchorNode?.width ?? 0;
    const anchorH = anchorNode?.height ?? 0;
    const otherNodes = anchorNode && layoutResult.kind === 'flowchart'
      ? layoutResult.nodes.filter((n) => !(groupBases ? groupBases.has(n.id) : n.id === id))
      : [];

    const onMove = (ev: PointerEvent) => {
      if (!draggableKinds) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragStarted) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        dragStarted = true;
        // Snapshot BEFORE the first position write so undo restores exactly
        // the layout you had pre-drag (one entry per drag, not per pointermove).
        pushSnapshot();
        setDraggingNodeId(id);
        if (!groupBases) {
          setSelectedIds((cur) => (cur.has(id) ? cur : new Set([id])));
        }
      }
      const scale = panZoomRef.current?.getScale() ?? 1;
      const rawDx = dx / scale;
      const rawDy = dy / scale;
      let snapDx = rawDx;
      let snapDy = rawDy;
      let guidesX: number[] = [];
      let guidesY: number[] = [];

      if (!ev.shiftKey) {
        // Soft snap to other nodes first (Figma-style), fall back to grid.
        const candX = baseX + rawDx;
        const candY = baseY + rawDy;
        const snap = computeSnapToOtherNodes(
          candX,
          candY,
          anchorW,
          anchorH,
          otherNodes,
          SNAP_THRESHOLD / scale,
        );
        if (snap.snappedX !== null) {
          snapDx = snap.snappedX - baseX;
          guidesX = snap.guidesX;
        } else {
          // Grid snap on X if no other-node snap
          const nx = Math.round(candX / GRID) * GRID;
          snapDx = nx - baseX;
        }
        if (snap.snappedY !== null) {
          snapDy = snap.snappedY - baseY;
          guidesY = snap.guidesY;
        } else {
          const ny = Math.round(candY / GRID) * GRID;
          snapDy = ny - baseY;
        }
      }
      setDragGuides({ x: guidesX, y: guidesY });
      if (groupBases) {
        const bulk: ManualPositions = {};
        for (const [gid, base] of groupBases) {
          bulk[gid] = { x: base.x + snapDx, y: base.y + snapDy };
        }
        setManualPositionsBulk(bulk);
      } else {
        setManualPosition(id, { x: baseX + snapDx, y: baseY + snapDy });
      }
    };
    const onUp = () => {
      if (!dragStarted) {
        editorRef.current?.revealLine(sourceLine);
        setSelectedIds(new Set([id]));
        // Make sure canvas owns focus so Ctrl+C/V/D fire here, not in Monaco
        blurActiveElement();
      }
      setDraggingNodeId(null);
      setDragGuides({ x: [], y: [] });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const lockOtherPositions = (exceptId: string) => {
    if (!layoutResult || layoutResult.kind !== 'flowchart') return;
    const additions: ManualPositions = {};
    for (const n of layoutResult.nodes) {
      if (n.id === exceptId) continue;
      if (manualPositions[n.id]) continue;
      additions[n.id] = { x: n.x, y: n.y };
    }
    if (Object.keys(additions).length > 0) setManualPositionsBulk(additions);
  };

  const handleNodeResizeStart = (
    id: string,
    corner: ResizeCorner,
    e: React.PointerEvent,
  ) => {
    if (!layoutResult || layoutResult.kind !== 'flowchart') return;
    const node = layoutResult.nodes.find((n) => n.id === id);
    if (!node) return;
    e.stopPropagation();
    e.preventDefault();

    // Snapshot before the resize so undo restores the prior size+positions.
    pushSnapshot();
    // Pin every other node at its current position so the resize doesn't
    // make the rest of the diagram rearrange.
    lockOtherPositions(id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = node.width;
    const startH = node.height;
    const startCx = node.x;
    const startCy = node.y;
    const xSign = corner === 'ne' || corner === 'se' ? 1 : -1;
    const ySign = corner === 'se' || corner === 'sw' ? 1 : -1;

    const onMove = (ev: PointerEvent) => {
      const scale = panZoomRef.current?.getScale() ?? 1;
      const dx = ((ev.clientX - startX) / scale) * xSign;
      const dy = ((ev.clientY - startY) / scale) * ySign;
      let newW = Math.max(MIN_NODE_SIZE, startW + dx);
      let newH = Math.max(MIN_NODE_SIZE, startH + dy);
      if (!ev.shiftKey) {
        newW = Math.round(newW / GRID) * GRID;
        newH = Math.round(newH / GRID) * GRID;
      }
      const deltaW = newW - startW;
      const deltaH = newH - startH;
      const newCx = startCx + (xSign * deltaW) / 2;
      const newCy = startCy + (ySign * deltaH) / 2;
      setManualSize(id, { width: newW, height: newH });
      setManualPosition(id, { x: newCx, y: newCy });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startLabelEdit = (id: string, clearText: boolean) => {
    if (!layoutResult || layoutResult.kind !== 'flowchart') return;
    const node = layoutResult.nodes.find((n) => n.id === id);
    if (!node) return;
    // Pin every node (including the edited one) so the layout does not reflow
    // while the user types — only the edited node's box grows / shrinks.
    lockOtherPositions(id);
    if (!manualPositions[id]) {
      setManualPosition(id, { x: node.x, y: node.y });
    }
    setEditingNodeId(id);
    setEditingValue(clearText ? '' : node.label);
  };

  const handleNodeDoubleClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Nodo "buzon de progreso": doble-click abre su interfaz de subida en vez de
    // editar el label.
    if (ast.type === 'flowchart' && ast.nodes.find((n) => n.id === id)?.shape === 'upload') {
      setUploadNodeId(id);
      return;
    }
    startLabelEdit(id, false);
  };

  const commitLabelEdit = () => {
    if (!editingNodeId) return;
    if (layoutResult?.kind !== 'flowchart') {
      setEditingNodeId(null);
      setEditingValue('');
      return;
    }
    const node = layoutResult.nodes.find((n) => n.id === editingNodeId);
    if (node && editingValue.trim() && editingValue !== node.label) {
      setSource(
        updateNodeLabelInPlace(
          source,
          editingNodeId,
          node.sourceLine,
          editingValue.trim(),
        ),
      );
    }
    setEditingNodeId(null);
    setEditingValue('');
  };

  const cancelLabelEdit = () => {
    setEditingNodeId(null);
    setEditingValue('');
  };

  const handleSelectAll = () => {
    if (!layoutResult || layoutResult.kind !== 'flowchart') return;
    if (layoutResult.nodes.length === 0) return;
    setSelectedIds(new Set(layoutResult.nodes.map((n) => n.id)));
    setSelectedEdgeKey(null);
    showToast(`${layoutResult.nodes.length} seleccionados`);
  };

  const handleDistributeSelected = (axis: 'H' | 'V') => {
    if (!layoutResult || layoutResult.kind !== 'flowchart') return;
    const sel = layoutResult.nodes.filter((n) => selectedIds.has(n.id));
    if (sel.length < 3) return;
    pushSnapshot();
    const sorted = [...sel].sort((a, b) =>
      axis === 'H' ? a.x - b.x : a.y - b.y,
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan =
      axis === 'H' ? last.x - first.x : last.y - first.y;
    if (totalSpan === 0) return;
    const step = totalSpan / (sorted.length - 1);

    // Pin non-selected so layout doesn't reflow
    const additions: ManualPositions = {};
    for (const n of layoutResult.nodes) {
      if (selectedIds.has(n.id)) continue;
      if (manualPositions[n.id]) continue;
      additions[n.id] = { x: n.x, y: n.y };
    }
    if (Object.keys(additions).length > 0) setManualPositionsBulk(additions);

    const bulk: ManualPositions = {};
    sorted.forEach((n, i) => {
      if (i === 0 || i === sorted.length - 1) {
        bulk[n.id] = { x: n.x, y: n.y };
        return;
      }
      if (axis === 'H') {
        bulk[n.id] = { x: first.x + step * i, y: n.y };
      } else {
        bulk[n.id] = { x: n.x, y: first.y + step * i };
      }
    });
    setManualPositionsBulk(bulk);
    showToast(`Distribuidos: ${sel.length}`);
  };

  const handleAlignSelected = (kind: 'L' | 'R' | 'T' | 'B' | 'C' | 'M') => {
    if (!layoutResult || layoutResult.kind !== 'flowchart') return;
    const sel = layoutResult.nodes.filter((n) => selectedIds.has(n.id));
    if (sel.length < 2) return;
    pushSnapshot();
    // Pin everything first so nothing else reflows.
    const additions: ManualPositions = {};
    for (const n of layoutResult.nodes) {
      if (selectedIds.has(n.id)) continue;
      if (manualPositions[n.id]) continue;
      additions[n.id] = { x: n.x, y: n.y };
    }
    if (Object.keys(additions).length > 0) setManualPositionsBulk(additions);

    const bulk: ManualPositions = {};
    if (kind === 'L') {
      const target = Math.min(...sel.map((n) => n.x - n.width / 2));
      for (const n of sel) bulk[n.id] = { x: target + n.width / 2, y: n.y };
    } else if (kind === 'R') {
      const target = Math.max(...sel.map((n) => n.x + n.width / 2));
      for (const n of sel) bulk[n.id] = { x: target - n.width / 2, y: n.y };
    } else if (kind === 'T') {
      const target = Math.min(...sel.map((n) => n.y - n.height / 2));
      for (const n of sel) bulk[n.id] = { x: n.x, y: target + n.height / 2 };
    } else if (kind === 'B') {
      const target = Math.max(...sel.map((n) => n.y + n.height / 2));
      for (const n of sel) bulk[n.id] = { x: n.x, y: target - n.height / 2 };
    } else if (kind === 'C') {
      const target = sel.reduce((acc, n) => acc + n.x, 0) / sel.length;
      for (const n of sel) bulk[n.id] = { x: target, y: n.y };
    } else if (kind === 'M') {
      const target = sel.reduce((acc, n) => acc + n.y, 0) / sel.length;
      for (const n of sel) bulk[n.id] = { x: n.x, y: target };
    }
    setManualPositionsBulk(bulk);
    showToast(`Alineados: ${sel.length}`);
  };

  const handleMarquee = (
    rect: { x: number; y: number; w: number; h: number },
    additive: boolean,
  ) => {
    if (!layoutResult || layoutResult.kind !== 'flowchart') return;
    const x1 = rect.x;
    const y1 = rect.y;
    const x2 = rect.x + rect.w;
    const y2 = rect.y + rect.h;
    const hit = layoutResult.nodes
      .filter((n) => n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2)
      .map((n) => n.id);
    setSelectedIds((cur) => {
      if (additive) {
        const next = new Set(cur);
        for (const id of hit) next.add(id);
        return next;
      }
      return new Set(hit);
    });
    setSelectedEdgeKey(null);
  };

  const handleCanvasClick = (worldX: number, worldY: number) => {
    if (tool === 'select') {
      setSelectedIds(new Set());
      setSelectedEdgeKey(null);
      return;
    }
    if (tool === 'connect') return;
    if (layoutResult?.kind !== 'flowchart') {
      showToast('Solo flowchart soporta agregar nodos por click');
      setTool('select');
      return;
    }
    const flowchartAst = ast.type === 'flowchart' ? ast : null;
    if (!flowchartAst) return;
    const existingIds = new Set(flowchartAst.nodes.map((n) => n.id));
    const id = nextNodeId(existingIds);
    const snappedX = Math.round(worldX / GRID) * GRID;
    const snappedY = Math.round(worldY / GRID) * GRID;
    setManualPosition(id, { x: snappedX, y: snappedY });
    setSource(appendNode(source, id, tool));
    setTool('select');
    showToast(`Nodo "${id}" agregado`);
  };

  const handleAddConnectedWithLabel = (
    sourceId: string,
    direction: ConnectDir,
    labelKey: string,
  ) => {
    if (ast.type !== 'flowchart' || layoutResult?.kind !== 'flowchart') return;
    handleAddConnected(sourceId, direction);
    // handleAddConnected writes the source synchronously (Zustand). Re-derive
    // the new id (it always matches the pre-write nextNodeId).
    const existing = new Set(ast.nodes.map((n) => n.id));
    const newId = nextNodeId(existing);
    const after = useDocStore.getState().source;
    const parsedAfter = parse(after);
    if (parsedAfter.ast.type !== 'flowchart') return;
    const newNode = parsedAfter.ast.nodes.find((n) => n.id === newId);
    if (!newNode) return;
    setSource(
      updateNodeAttrInPlace(after, newId, newNode.sourceLine, 'labels', labelKey),
    );
  };

  const handleAddConnected = (sourceId: string, direction: ConnectDir) => {
    if (ast.type !== 'flowchart' || layoutResult?.kind !== 'flowchart') return;
    const sourceNode = layoutResult.nodes.find((n) => n.id === sourceId);
    if (!sourceNode) return;

    const existing = new Set(ast.nodes.map((n) => n.id));
    const newId = nextNodeId(existing);

    const NEW_W = 120;
    const NEW_H = 48;
    const SPACING = 50;
    let nx = sourceNode.x;
    let ny = sourceNode.y;
    switch (direction) {
      case 'right':
        nx = sourceNode.x + sourceNode.width / 2 + SPACING + NEW_W / 2;
        break;
      case 'left':
        nx = sourceNode.x - sourceNode.width / 2 - SPACING - NEW_W / 2;
        break;
      case 'down':
        ny = sourceNode.y + sourceNode.height / 2 + SPACING + NEW_H / 2;
        break;
      case 'up':
        ny = sourceNode.y - sourceNode.height / 2 - SPACING - NEW_H / 2;
        break;
    }
    nx = Math.round(nx / GRID) * GRID;
    ny = Math.round(ny / GRID) * GRID;

    // Pin every existing node so adding doesn't reflow the layout
    lockOtherPositions(sourceId);
    if (!manualPositions[sourceId]) {
      setManualPosition(sourceId, { x: sourceNode.x, y: sourceNode.y });
    }
    setManualPosition(newId, { x: nx, y: ny });

    // El nodo nuevo siempre es child del seleccionado: el edge va del
    // seleccionado al nuevo, sin importar la direccion (incluido izquierda/arriba).
    const fromId = sourceId;
    const toId = newId;
    let nextSource = appendNode(source, newId, 'rectangle');
    nextSource = appendEdge(nextSource, fromId, toId);
    setSource(nextSource);
    setSelectedIds(new Set([newId]));
    showToast(`Conectado: ${fromId} > ${toId}`);
  };

  // Materializa un connect condicional desde sourceId en la direccion dada.
  // Si hay un vecino en esa direccion (cono ±45), solo crea el edge condicional
  // (no toca los nodos). Si no, crea un nodo nuevo conectado con edge condicional.
  // En ambos casos `condition` es el label/accion del connect.
  const handleCreateConditional = (
    sourceId: string,
    direction: ConnectDir,
    condition: string,
  ) => {
    if (ast.type !== 'flowchart' || layoutResult?.kind !== 'flowchart') return;
    const sourceNode = layoutResult.nodes.find((n) => n.id === sourceId);
    if (!sourceNode) return;
    const cond = condition.trim();

    const neighbor = pickNeighbor(
      { x: sourceNode.x, y: sourceNode.y },
      layoutResult.nodes.filter((n) => n.id !== sourceId),
      direction,
    );

    if (neighbor) {
      // Dos nodos ya creados: solo se "edita" el connect (condicional).
      lockOtherPositions(sourceId);
      setSource(
        appendEdge(source, sourceId, neighbor.id, { label: cond, conditional: true }),
      );
      setSelectedIds(new Set([neighbor.id]));
      showToast(`Connect condicional: ${sourceId} ?> ${neighbor.id}`);
      return;
    }

    // No hay vecino: crear nodo nuevo + connect condicional.
    const existing = new Set(ast.nodes.map((n) => n.id));
    const newId = nextNodeId(existing);
    const NEW_W = 120;
    const NEW_H = 48;
    const SPACING = 50;
    let nx = sourceNode.x;
    let ny = sourceNode.y;
    switch (direction) {
      case 'right':
        nx = sourceNode.x + sourceNode.width / 2 + SPACING + NEW_W / 2;
        break;
      case 'left':
        nx = sourceNode.x - sourceNode.width / 2 - SPACING - NEW_W / 2;
        break;
      case 'down':
        ny = sourceNode.y + sourceNode.height / 2 + SPACING + NEW_H / 2;
        break;
      case 'up':
        ny = sourceNode.y - sourceNode.height / 2 - SPACING - NEW_H / 2;
        break;
    }
    nx = Math.round(nx / GRID) * GRID;
    ny = Math.round(ny / GRID) * GRID;

    lockOtherPositions(sourceId);
    if (!manualPositions[sourceId]) {
      setManualPosition(sourceId, { x: sourceNode.x, y: sourceNode.y });
    }
    setManualPosition(newId, { x: nx, y: ny });

    let nextSource = appendNode(source, newId, 'rectangle');
    nextSource = appendEdge(nextSource, sourceId, newId, {
      label: cond,
      conditional: true,
    });
    setSource(nextSource);
    setSelectedIds(new Set([newId]));
    showToast(`Connect condicional: ${sourceId} ?> ${newId}`);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    let next = source;
    for (const id of selectedIds) next = removeNodeFromSource(next, id);
    setSource(next);
    const count = selectedIds.size;
    setSelectedIds(new Set());
    showToast(`Eliminados: ${count}`);
  };

  const { handleCopy, handlePaste, handleDuplicateSelected } = useClipboard({
    ast,
    layoutResult,
    selectedIds,
    setSelectedIds,
    showToast,
  });

  const applyAttrToSelected = (key: string, value: string) => {
    if (ast.type !== 'flowchart') return;
    if (selectedIds.size === 0) return;
    let next = source;
    for (const id of selectedIds) {
      const node = ast.nodes.find((n) => n.id === id);
      if (!node) continue;
      next = updateNodeAttrInPlace(next, id, node.sourceLine, key, value);
    }
    setSource(next);
  };

  const clearAttrFromSelected = (key: string) => {
    if (ast.type !== 'flowchart') return;
    if (selectedIds.size === 0) return;
    let next = source;
    for (const id of selectedIds) {
      const node = ast.nodes.find((n) => n.id === id);
      if (!node) continue;
      next = removeNodeAttrInPlace(next, id, node.sourceLine, key);
    }
    setSource(next);
  };

  const applyColorToSelected = (color: string) => {
    pushRecentColor(color);
    applyAttrToSelected('color', color);
  };
  const applyTextColorToSelected = (color: string) => {
    pushRecentColor(color);
    applyAttrToSelected('textColor', color);
  };
  const applyStrokeColorToSelected = (color: string) => {
    pushRecentColor(color);
    applyAttrToSelected('strokeColor', color);
  };
  const applyStrokeWidthToSelected = (w: number) => {
    applyAttrToSelected('strokeWidth', String(w));
  };
  const applyShapeToSelected = (s: Shape) => {
    applyAttrToSelected('shape', s);
  };
  const handleResetSize = () => {
    for (const id of selectedIds) clearManualSize(id);
  };

  const handleEdgePointerDown = (edge: LayoutEdge, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedEdgeKey({
      from: edge.from,
      to: edge.to,
      sourceLine: edge.sourceLine,
    });
    setSelectedIds(new Set());
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  // The currently-selected edge as a LayoutEdge (for endpoints + attrs).
  const selectedEdgeLayout = useMemo<LayoutEdge | null>(() => {
    if (!selectedEdgeKey || layoutResult?.kind !== 'flowchart') return null;
    return (
      layoutResult.edges.find(
        (e) =>
          e.from === selectedEdgeKey.from &&
          e.to === selectedEdgeKey.to &&
          e.sourceLine === selectedEdgeKey.sourceLine,
      ) ?? null
    );
  }, [selectedEdgeKey, layoutResult]);

  // Screen position for the EdgeMenu — middle of the polyline.
  const edgeMenuScreenPos = useMemo<{ x: number; y: number; placement: Placement } | null>(() => {
    if (!selectedEdgeLayout || !panZoomRef.current) return null;
    const rect = panZoomRef.current.getContainerRect();
    if (!rect) return null;
    const pts = selectedEdgeLayout.points;
    if (pts.length === 0) return null;
    const mid = pts[Math.floor(pts.length / 2)];
    const screenX = rect.left + mid.x * transform.scale + transform.tx;
    const screenY = rect.top + mid.y * transform.scale + transform.ty;
    const PW = 200;
    const PH = 130;
    const GAP = 10;
    const MARGIN = 12;
    const vw = typeof window !== 'undefined' ? window.innerWidth : PW + MARGIN * 2;
    const vh = typeof window !== 'undefined' ? window.innerHeight : PH + MARGIN * 2;
    let x = screenX - PW / 2;
    x = Math.max(MARGIN, Math.min(vw - PW - MARGIN, x));
    let placement: Placement = 'bottom';
    let y = screenY + GAP;
    if (y + PH > vh - MARGIN) {
      placement = 'top';
      y = screenY - GAP - PH;
      if (y < MARGIN) y = Math.max(MARGIN, vh - PH - MARGIN);
    }
    return { x, y, placement };
  }, [selectedEdgeLayout, transform]);

  const handleSetEdgeArrow = (arrow: ArrowType) => {
    if (!selectedEdgeKey) return;
    const cur = useDocStore.getState().source;
    setSource(
      updateEdgeArrowInPlace(
        cur,
        selectedEdgeKey.from,
        selectedEdgeKey.to,
        selectedEdgeKey.sourceLine,
        arrow,
      ),
    );
  };

  const handleReverseEdge = () => {
    if (!selectedEdgeKey) return;
    const cur = useDocStore.getState().source;
    setSource(
      reverseEdgeInPlace(cur, selectedEdgeKey.from, selectedEdgeKey.to, selectedEdgeKey.sourceLine),
    );
    // La conexion invertida queda como to>from en la misma linea: re-seleccionarla.
    setSelectedEdgeKey({
      from: selectedEdgeKey.to,
      to: selectedEdgeKey.from,
      sourceLine: selectedEdgeKey.sourceLine,
    });
  };

  const handleSetEdgeStyle = (style: EdgeStyle) => {
    if (!selectedEdgeKey) return;
    const cur = useDocStore.getState().source;
    setSource(
      updateEdgeAttrInPlace(
        cur,
        selectedEdgeKey.from,
        selectedEdgeKey.to,
        selectedEdgeKey.sourceLine,
        'style',
        style,
      ),
    );
  };

  const handleSetEdgeColor = (color: string) => {
    if (!selectedEdgeKey) return;
    pushRecentColor(color);
    const cur = useDocStore.getState().source;
    setSource(
      updateEdgeAttrInPlace(
        cur,
        selectedEdgeKey.from,
        selectedEdgeKey.to,
        selectedEdgeKey.sourceLine,
        'color',
        color,
      ),
    );
  };

  const handleClearEdgeAttr = (key: string) => {
    if (!selectedEdgeKey) return;
    const cur = useDocStore.getState().source;
    setSource(
      removeEdgeAttrInPlace(
        cur,
        selectedEdgeKey.from,
        selectedEdgeKey.to,
        selectedEdgeKey.sourceLine,
        key,
      ),
    );
  };

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeKey) return;
    setSource(
      removeEdgeFromSource(
        source,
        selectedEdgeKey.from,
        selectedEdgeKey.to,
        selectedEdgeKey.sourceLine,
      ),
    );
    setSelectedEdgeKey(null);
    showToast('Conexion eliminada');
  };

  const handleToggleAttr = (key: AttrKey) => {
    if (!singleSelectedNode || ast.type !== 'flowchart') return;
    const node = ast.nodes.find((n) => n.id === singleSelectedNode.id);
    if (!node) return;
    const lockNode = singleSelectedNode;
    lockOtherPositions(node.id);
    if (!manualPositions[node.id]) {
      setManualPosition(node.id, { x: lockNode.x, y: lockNode.y });
    }
    if (key === 'progress') {
      if (node.progress !== undefined) {
        setSource(removeNodeAttrInPlace(source, node.id, node.sourceLine, 'progress'));
      } else {
        setSource(updateNodeAttrInPlace(source, node.id, node.sourceLine, 'progress', 'false'));
      }
      return;
    }
    if (key === 'quantity') {
      if (node.quantity !== undefined) {
        setSource(removeNodeAttrInPlace(source, node.id, node.sourceLine, 'quantity'));
      } else {
        setSource(updateNodeAttrInPlace(source, node.id, node.sourceLine, 'quantity', '1'));
      }
      return;
    }
    if (key === 'icon') {
      if (node.icon !== undefined && node.icon !== '') {
        setSource(removeNodeAttrInPlace(source, node.id, node.sourceLine, 'icon'));
      } else {
        setSource(updateNodeAttrInPlace(source, node.id, node.sourceLine, 'icon', 'user'));
      }
      return;
    }
  };

  const handleToggleLabel = (key: string) => {
    if (!singleSelectedNode) return;
    const targetId = singleSelectedNode.id;
    lastLabelRef.current = key;
    lockOtherPositions(targetId);
    if (!manualPositions[targetId]) {
      setManualPosition(targetId, { x: singleSelectedNode.x, y: singleSelectedNode.y });
    }
    // Read freshest source from the store so rapid toggles compose correctly
    // (React batches state, so the closure-captured `source` / `ast` is stale).
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === targetId);
    if (!node) return;
    const cur = node.labels ?? [];
    const next = cur.includes(key)
      ? cur.filter((k) => k !== key)
      : [...cur, key];
    let nextSource: string;
    if (next.length === 0) {
      nextSource = removeNodeAttrInPlace(prev, targetId, node.sourceLine, 'labels');
    } else {
      nextSource = updateNodeAttrInPlace(
        prev,
        targetId,
        node.sourceLine,
        'labels',
        next.join('; '),
      );
    }
    setSource(nextSource);
  };

  const handleAddCustomLabel = (key: string) => {
    if (!key.trim()) return;
    handleToggleLabel(key.trim());
  };

  // Aplica / quita un constraint (id de nodo) al nodo seleccionado. Se guarda
  // en el attr `constraints` y el prompt generator lo incluye.
  const handleToggleConstraintApply = (constraintId: string) => {
    if (!singleSelectedNode) return;
    const targetId = singleSelectedNode.id;
    lockOtherPositions(targetId);
    if (!manualPositions[targetId]) {
      setManualPosition(targetId, { x: singleSelectedNode.x, y: singleSelectedNode.y });
    }
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === targetId);
    if (!node) return;
    const cur = node.constraints ?? [];
    const next = cur.includes(constraintId)
      ? cur.filter((c) => c !== constraintId)
      : [...cur, constraintId];
    setSource(setNodeConstraints(prev, targetId, node.sourceLine, next));
  };

  // Guarda el contenido interno (oculto) del nodo seleccionado. Vacio = quita.
  const handleSaveContent = (text: string) => {
    if (!singleSelectedNode) return;
    const targetId = singleSelectedNode.id;
    lockOtherPositions(targetId);
    if (!manualPositions[targetId]) {
      setManualPosition(targetId, { x: singleSelectedNode.x, y: singleSelectedNode.y });
    }
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === targetId);
    if (!node) return;
    let nextSource: string;
    if (!text.trim()) {
      nextSource = removeNodeAttrInPlace(prev, targetId, node.sourceLine, 'content');
    } else {
      const encoded = btoa(unescape(encodeURIComponent(text)));
      nextSource = updateNodeAttrInPlace(prev, targetId, node.sourceLine, 'content', encoded);
    }
    setSource(nextSource);
    nodeMenu.close();
  };

  const handleSolverSubmit = async (
    apiKey: string,
    taskType: TaskType,
    instruction: string,
  ) => {
    if (ast.type !== 'flowchart') return;
    setSolverRunning(true);
    setSolverError(null);
    setSolverResponse(null);
    try {
      const grouped = groupAst(ast);
      const existingIds = ast.nodes.map((n) => n.id);
      const system = buildSystemPrompt(labelPrompts);
      const user = buildUserPrompt(grouped, taskType, instruction, existingIds);
      const resp = await callSolver({ apiKey, system, user });
      setSolverResponse(resp);
    } catch (e) {
      setSolverError(e instanceof Error ? e.message : String(e));
    } finally {
      setSolverRunning(false);
    }
  };

  const handleSolverApply = () => {
    if (!solverResponse) return;
    const cur = useDocStore.getState().source;
    const result = applyActions(cur, solverResponse.actions);
    setSource(result.source);
    if (result.newIds.length > 0) {
      setSelectedIds(new Set(result.newIds));
    }
    const skipped = result.skipped.length;
    showToast(
      `Solver: ${result.applied} aplicadas${skipped > 0 ? `, ${skipped} omitidas` : ''}`,
    );
    setSolverResponse(null);
    setSolverOpen(false);
  };

  // Genera el dev-prompt segun el scope (incremental). 'selected' usa la
  // seleccion; 'request' los nodos pedidos; 'pending' los que no estan done.
  const buildScopedPrompt = (scope: PromptScope): string => {
    if (ast.type !== 'flowchart') return '';
    let ids: ReadonlySet<string> | undefined;
    if (scope === 'selected') ids = selectedIds;
    else if (scope === 'request')
      ids = new Set(ast.nodes.filter((n) => n.request).map((n) => n.id));
    else if (scope === 'pending')
      ids = new Set(ast.nodes.filter((n) => n.status !== 'done').map((n) => n.id));
    return buildDevPrompt(ast, source, labelPrompts, ids);
  };

  const handleCopyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Prompt copiado');
    } catch {
      showToast('No se pudo copiar al portapapeles');
    }
  };

  // Copia el dev-prompt SOLO de los nodos nuevos respecto a un snapshot (diff).
  const handleDiffPrompt = async (addedNodeIds: string[]) => {
    if (ast.type !== 'flowchart' || addedNodeIds.length === 0) return;
    const text = buildDevPrompt(ast, source, labelPrompts, new Set(addedNodeIds));
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Prompt de ${addedNodeIds.length} nodo(s) nuevo(s) copiado`);
    } catch {
      showToast('No se pudo copiar');
    }
  };

  const handleSolverReject = () => {
    setSolverResponse(null);
    setSolverError(null);
  };

  const handleSetAttrValue = (key: AttrKey, value: string) => {
    if (!singleSelectedNode || ast.type !== 'flowchart') return;
    const node = ast.nodes.find((n) => n.id === singleSelectedNode.id);
    if (!node) return;
    lockOtherPositions(node.id);
    if (!manualPositions[node.id]) {
      setManualPosition(node.id, { x: singleSelectedNode.x, y: singleSelectedNode.y });
    }
    setSource(updateNodeAttrInPlace(source, node.id, node.sourceLine, key, value));
  };

  const handleToggleProgress = (id: string) => {
    if (ast.type !== 'flowchart') return;
    const node = ast.nodes.find((n) => n.id === id);
    if (!node) return;
    const nextVal = node.progress ? 'false' : 'true';
    setSource(
      updateNodeAttrInPlace(source, id, node.sourceLine, 'progress', nextVal),
    );
  };

  // Toggle del flag noPrompt: excluye / incluye el nodo en el prompt generator.
  // Lee el source fresco del store para no depender del closure (lo invoca un atajo).
  const handleTogglePromptHidden = (id: string) => {
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === id);
    if (!node) return;
    const next = node.promptHidden
      ? removeNodeAttrInPlace(prev, id, node.sourceLine, 'noPrompt')
      : updateNodeAttrInPlace(prev, id, node.sourceLine, 'noPrompt', 'true');
    setSource(next);
  };

  // Cicla el estado de implementacion: none -> todo -> wip -> done -> blocked -> none.
  const handleCycleStatus = (id: string) => {
    const cycle: (string | null)[] = ['todo', 'wip', 'done', 'blocked', null];
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === id);
    if (!node) return;
    const cur = node.status ?? null;
    const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
    setSource(
      next === null
        ? removeNodeAttrInPlace(prev, id, node.sourceLine, 'status')
        : updateNodeAttrInPlace(prev, id, node.sourceLine, 'status', next),
    );
    showToast(next ? `estado: ${next}` : 'estado: (sin)');
  };

  // Toggle "pedido" (request): marca el nodo como algo nuevo a implementar.
  const handleToggleRequest = (id: string) => {
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === id);
    if (!node) return;
    setSource(
      node.request
        ? removeNodeAttrInPlace(prev, id, node.sourceLine, 'request')
        : updateNodeAttrInPlace(prev, id, node.sourceLine, 'request', 'true'),
    );
  };

  // Setea (o limpia) los archivos vinculados al nodo (attr `file`, ; separados).
  const handleSetFiles = (id: string, value: string) => {
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === id);
    if (!node) return;
    const v = value.trim();
    setSource(
      v
        ? updateNodeAttrInPlace(prev, id, node.sourceLine, 'file', v)
        : removeNodeAttrInPlace(prev, id, node.sourceLine, 'file'),
    );
  };

  // Guarda la barra de archivos: una ruta por linea (o ; ), se juntan con "; ".
  const commitFilesEdit = () => {
    if (!filesEditId) return;
    const files = filesText
      .split(/[\n;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    handleSetFiles(filesEditId, files.join('; '));
    setFilesEditId(null);
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  // Gemelo de handleSetFiles para el attr `tests` (archivos de test del nodo).
  const handleSetTests = (id: string, value: string) => {
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === id);
    if (!node) return;
    const v = value.trim();
    setSource(
      v
        ? updateNodeAttrInPlace(prev, id, node.sourceLine, 'tests', v)
        : removeNodeAttrInPlace(prev, id, node.sourceLine, 'tests'),
    );
  };
  const commitTestsEdit = () => {
    if (!testsEditId) return;
    const tests = testsText
      .split(/[\n;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    handleSetTests(testsEditId, tests.join('; '));
    setTestsEditId(null);
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  // Guarda el checklist del buzon (attr `buzon` base64-JSON) y recalcula el
  // `status` del nodo en cascada (done si todas las listas completas, wip si hay
  // algo, todo si vacio). Lo usa UploadNodeModal.
  const handleSetBuzon = (id: string, data: BuzonData) => {
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === id);
    if (!node) return;
    let next = updateNodeAttrInPlace(prev, id, node.sourceLine, 'buzon', encodeBuzon(data));
    next = updateNodeAttrInPlace(next, id, node.sourceLine, 'status', computeBuzonStatus(data));
    setSource(next);
  };

  // Setea (o limpia) la evidencia/avance del nodo (attr `assets`, ; separados).
  // Lo usa el panel de Archivos / Progreso al subir o desvincular un archivo.
  const handleSetAssets = (id: string, paths: string[]) => {
    const prev = useDocStore.getState().source;
    const parsed = parse(prev);
    if (parsed.ast.type !== 'flowchart') return;
    const node = parsed.ast.nodes.find((n) => n.id === id);
    if (!node) return;
    const v = paths.map((p) => p.trim()).filter(Boolean).join('; ');
    setSource(
      v
        ? updateNodeAttrInPlace(prev, id, node.sourceLine, 'assets', v)
        : removeNodeAttrInPlace(prev, id, node.sourceLine, 'assets'),
    );
  };

  const toggleNoteExpand = (id: string) => {
    setExpandedNoteIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplyCustomBlock = (cfg: CustomBlockApply) => {
    if (!singleSelectedNode || ast.type !== 'flowchart') return;
    const node = ast.nodes.find((n) => n.id === singleSelectedNode.id);
    if (!node) return;
    let next = source;
    if (cfg.kind === 'list') {
      next = updateNodeAttrInPlace(next, node.id, node.sourceLine, 'shape', 'list');
      if (cfg.items.length > 0) {
        next = updateNodeAttrInPlace(
          next,
          node.id,
          node.sourceLine,
          'items',
          cfg.items.join('; '),
        );
      } else {
        next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'items');
      }
      next = updateNodeAttrInPlace(
        next,
        node.id,
        node.sourceLine,
        'listStyle',
        cfg.listStyle,
      );
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'content');
      clearManualSize(node.id);
    } else if (cfg.kind === 'note') {
      next = updateNodeAttrInPlace(next, node.id, node.sourceLine, 'shape', 'note');
      if (cfg.content) {
        const encoded = btoa(unescape(encodeURIComponent(cfg.content)));
        next = updateNodeAttrInPlace(next, node.id, node.sourceLine, 'content', encoded);
      } else {
        next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'content');
      }
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'items');
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'listStyle');
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'src');
      clearManualSize(node.id);
    } else if (cfg.kind === 'image') {
      next = updateNodeAttrInPlace(next, node.id, node.sourceLine, 'shape', 'image');
      if (cfg.src) {
        const encoded = btoa(unescape(encodeURIComponent(cfg.src)));
        next = updateNodeAttrInPlace(next, node.id, node.sourceLine, 'src', encoded);
      } else {
        next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'src');
      }
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'content');
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'items');
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'listStyle');
      clearManualSize(node.id);
    } else if (cfg.kind === 'upload') {
      // Buzon de progreso: shape=upload + items = pedidos del modelo. assets se
      // maneja en la interfaz del nodo (no se toca aca).
      next = updateNodeAttrInPlace(next, node.id, node.sourceLine, 'shape', 'upload');
      if (cfg.items.length > 0) {
        next = updateNodeAttrInPlace(next, node.id, node.sourceLine, 'items', cfg.items.join('; '));
      } else {
        next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'items');
      }
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'content');
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'src');
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'listStyle');
      clearManualSize(node.id);
    } else {
      next = updateNodeAttrInPlace(
        next,
        node.id,
        node.sourceLine,
        'shape',
        'rectangle',
      );
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'items');
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'listStyle');
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'content');
      next = removeNodeAttrInPlace(next, node.id, node.sourceLine, 'src');
      clearManualSize(node.id);
    }
    setSource(next);
    nodeMenu.close();
  };
  const handleAutoContrast = () => {
    if (!singleSelectedNode) return;
    const fill = singleSelectedNode.color;
    if (!fill || !/^#[0-9a-f]{6}$/i.test(fill)) {
      showToast('Aplica primero un fill custom');
      return;
    }
    const c = contrastTextColor(fill);
    applyTextColorToSelected(c);
  };

  const handleResize = (clientX: number, totalWidth: number) => {
    setEditorWidthPercent((clientX / totalWidth) * 100);
  };

  const handleExportSvg = () => {
    if (svgRef.current) exportSvg(svgRef.current);
  };
  const handleExportPng = () => {
    if (svgRef.current) void exportPng(svgRef.current);
  };
  const handleResetSource = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Reset al ejemplo por defecto? Se perdera tu DSL actual.')
    ) {
      return;
    }
    resetSource();
  };
  const handleShare = async () => {
    const url = buildShareUrl(source);
    try {
      await navigator.clipboard.writeText(url);
      showToast('URL copiada al portapapeles');
    } catch {
      if (typeof window !== 'undefined') {
        window.location.hash = url.split('#')[1] ?? '';
        showToast('URL actualizada en la barra de direcciones');
      }
    }
  };

  // === Import (prompt -> diagrama) ===
  const guideUrl = `${import.meta.env.BASE_URL}prompt-to-diagram.txt`;
  const handleImportGenerate = (text: string) => {
    const parsed = parse(text);
    const count =
      parsed.ast.type === 'flowchart'
        ? parsed.ast.nodes.length
        : parsed.ast.type === 'er'
          ? parsed.ast.tables.length
          : parsed.ast.actors.length;
    // Crea una pestania nueva con el DSL importado (no pisa el documento actual).
    addTab(text);
    setImportOpen(false);
    showToast(`Importado: ${count} nodo(s) en pestania nueva`);
  };
  const handleCopyGuide = async () => {
    try {
      const res = await fetch(guideUrl);
      const txt = await res.text();
      await navigator.clipboard.writeText(txt);
      showToast('Guia copiada — pegasela a Claude');
    } catch {
      showToast('No se pudo copiar la guia');
    }
  };
  const handleDownloadGuide = () => {
    if (typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = guideUrl;
    a.download = 'prompt-to-diagram.txt';
    a.click();
  };
  // Guia del LOOP: para pegar en otro proyecto de Claude Code (HTTP localhost).
  const handleCopyLoopGuide = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}loop-claude-code.md`);
      const txt = await res.text();
      await navigator.clipboard.writeText(txt);
      showToast('Guia del loop copiada — pegala en el otro proyecto');
    } catch {
      showToast('No se pudo copiar la guia del loop');
    }
  };
  // Pestania "dedicada" para abrir diagramas de la biblioteca: se reutiliza en
  // cada recarga asi iterar sobre un archivo no acumula pestanias.
  const libraryTabIdRef = useRef<string | null>(null);
  // Archivo (name) que cargo la pestania de biblioteca: para el auto-reload en vivo.
  const libraryFileRef = useRef<string | null>(null);
  const openLibraryDiagram = (
    d: { name: string; title: string | null; source: string },
    opts?: { silent?: boolean },
  ) => {
    const st = useDocStore.getState();
    const reuse = libraryTabIdRef.current && st.tabs.some((t) => t.id === libraryTabIdRef.current);
    if (reuse) {
      switchTab(libraryTabIdRef.current!);
      setSource(d.source, { skipHistory: true });
      clearManualPositions();
    } else {
      addTab(d.source);
      libraryTabIdRef.current = useDocStore.getState().activeId;
    }
    libraryFileRef.current = d.name;
    if (!opts?.silent) setSelectedIds(new Set());
    showToast(`Cargado: ${d.title ?? d.name}`);
  };
  // Boton "biblioteca": abre el menu para elegir. Si hay 1 diagrama lo abre directo;
  // si hay varios abre el import; si esta vacia, toast.
  const handleReloadLibrary = async () => {
    const lib = await fetchDiagramLibrary();
    if (lib.length === 0) {
      showToast('Biblioteca vacia: agrega .txt en /diagrams');
      return;
    }
    if (lib.length === 1) {
      openLibraryDiagram(lib[0]);
      return;
    }
    setImportOpen(true);
    showToast(`Biblioteca: ${lib.length} diagramas — elegi uno`);
  };

  // Boton "↻ refrescar": recarga el diagrama de la pestania actual desde su archivo
  // de /diagrams, SIN abrir ningun menu. Si la pestania no estaba vinculada, intenta
  // matchear por title (y la vincula); si no hay archivo, solo avisa con un toast.
  const handleRefreshCurrent = async () => {
    const lib = await fetchDiagramLibrary();
    let fileName = libraryTabIdRef.current === activeTabId ? libraryFileRef.current : null;
    if (!fileName) {
      const m = source.match(/^\s*title:\s*(.+)$/m);
      const curTitle = m ? m[1].trim() : null;
      const found = (curTitle && lib.find((d) => (d.title ?? d.name) === curTitle)) || null;
      if (found) {
        fileName = found.name;
        libraryTabIdRef.current = activeTabId; // vincula para futuros refresh/auto-save
        libraryFileRef.current = found.name;
      }
    }
    const match = fileName ? lib.find((d) => d.name === fileName) : null;
    if (!match) {
      showToast('Este diagrama no viene de /diagrams');
      return;
    }
    setSource(match.source, { skipHistory: true });
    clearManualPositions();
    showToast(`Refrescado: ${match.title ?? match.name}`);
  };

  // Senial para refrescar la lista del ImportModal abierto cuando cambia /diagrams.
  const [libraryVersion, setLibraryVersion] = useState(0);
  // Estado de sincronizacion del diagrama con su archivo de /diagrams.
  type SyncState = 'off' | 'unlinked' | 'saving' | 'saved' | 'error';
  const [syncStatus, setSyncStatus] = useState<{ state: SyncState; file?: string }>({ state: 'off' });

  // Auto-reload: el dev server avisa por WS ('diagrams:changed') cuando Claude
  // Code edita un .txt de /diagrams. Si la pestania de biblioteca esta activa,
  // recargamos su diagrama en vivo (sin tocar ningun boton).
  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const onChanged = async () => {
      setLibraryVersion((v) => v + 1);
      // Matchea el diagrama actual con su archivo por `title:` (robusto: no depende
      // de refs en memoria, que se pierden al recargar la pagina).
      const cur = useDocStore.getState().source;
      const m = cur.match(/^\s*title:\s*(.+)$/m);
      const title = m ? m[1].trim() : null;
      if (!title) return;
      const lib = await fetchDiagramLibrary();
      const match = lib.find((d) => (d.title ?? d.name) === title);
      // Solo recarga si el archivo difiere (evita el loop con el auto-guardado).
      if (match && match.source !== useDocStore.getState().source) {
        setSource(match.source, { skipHistory: true });
        clearManualPositions();
        showToast(`Actualizado: ${match.title ?? match.name}`);
      }
    };
    hot.on('diagrams:changed', onChanged);
    return () => hot.off('diagrams:changed', onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-guardado (dev): si el diagrama actual matchea un archivo de /diagrams por
  // `title:`, escribe sus cambios a ese .txt con debounce. Asi tus ediciones en la
  // app llegan al archivo que Claude Code lee (GET /__diagrams), sin exportar nada.
  // Matchea por title (no por refs) para sobrevivir a recargas de la pagina.
  useEffect(() => {
    if (!import.meta.hot) {
      setSyncStatus({ state: 'off' });
      return;
    }
    const m = source.match(/^\s*title:\s*(.+)$/m);
    const title = m ? m[1].trim() : null;
    if (!title) {
      setSyncStatus({ state: 'unlinked' });
      return;
    }
    // Muestra "guardando" solo si ya estaba vinculado (evita parpadeo).
    setSyncStatus((prev) => (prev.file ? { state: 'saving', file: prev.file } : prev));
    const id = setTimeout(async () => {
      try {
        const lib = await fetchDiagramLibrary();
        const match = lib.find((d) => (d.title ?? d.name) === title);
        if (!match) {
          setSyncStatus({ state: 'unlinked' });
          return;
        }
        if (match.source !== source) {
          await fetch('/__diagrams/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: match.name, source }),
          });
        }
        setSyncStatus({ state: 'saved', file: `${match.name}.txt` });
      } catch {
        setSyncStatus({ state: 'error' });
      }
    }, 700);
    return () => clearTimeout(id);
  }, [source]);

  // Export de la "spec viva": escribe el dev-prompt a design.md del repo (via el
  // endpoint dev) para que Claude Code lea siempre el diseno actualizado.
  const handleExportSpec = async () => {
    if (ast.type !== 'flowchart') {
      showToast('La spec se exporta desde un flowchart');
      return;
    }
    try {
      const content = buildDevPrompt(ast, source, labelPrompts);
      const res = await fetch('/__design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, file: 'design.md' }),
      });
      if (!res.ok) throw new Error('fail');
      showToast('Spec exportada a design.md');
    } catch {
      showToast('No se pudo exportar (¿dev server?)');
    }
  };

  // Auto-export de la spec: re-escribe design.md (debounce) cuando cambia el DSL.
  const [autoSpec, setAutoSpec] = useState(false);
  useEffect(() => {
    if (!autoSpec || ast.type !== 'flowchart') return;
    const id = setTimeout(() => {
      void fetch('/__design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: buildDevPrompt(ast, source, labelPrompts), file: 'design.md' }),
      });
    }, 800);
    return () => clearTimeout(id);
  }, [autoSpec, ast, source, labelPrompts]);

  // Track currently held keys for chord shortcuts like "/" + WASD = nudge.
  const heldKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      // Normalize "/" and "?" (Shift+/) to a single key so the chord works
      // regardless of whether the user is pressing Shift.
      const k = e.key === '?' ? '/' : e.key;
      heldKeysRef.current.add(k);
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key === '?' ? '/' : e.key;
      heldKeysRef.current.delete(k);
    };
    const onBlur = () => heldKeysRef.current.clear();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // "Shift alone" detection: closing any open menu by pressing Shift without
  // a chord. We mark on Shift-down and clear on any other key. On Shift-up,
  // if still set, close the topmost open menu.
  const shiftAloneRef = useRef(false);
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return;
      if (!shiftAloneRef.current) return;
      shiftAloneRef.current = false;
      // Topmost first: cualquier menu anclado al nodo, luego paneles.
      if (nodeMenu.active) {
        nodeMenu.close();
        setMenuFocused(false);
        setPendingCreateDir(null);
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }
      if (solverOpen) {
        setSolverOpen(false);
        return;
      }
      if (promptGenOpen) {
        setPromptGenOpen(false);
        return;
      }
      if (menuFocused) {
        setMenuFocused(false);
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }
      if (showExamples) {
        setShowExamples(false);
        return;
      }
      if (showHelp) {
        setShowHelp(false);
        return;
      }
    };
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [nodeMenu, solverOpen, promptGenOpen, menuFocused, showExamples, showHelp]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Track shift-alone gesture
      if (e.key === 'Shift' && !e.repeat) {
        shiftAloneRef.current = true;
      } else if (e.key !== 'Shift') {
        shiftAloneRef.current = false;
      }

      if (e.key === 'Escape') {
        if (showExamples) {
          setShowExamples(false);
          return;
        }
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        if (nodeMenu.active) {
          nodeMenu.close();
          setMenuFocused(false);
          setPendingCreateDir(null);
          (document.activeElement as HTMLElement | null)?.blur?.();
          return;
        }
        if (solverOpen) {
          setSolverOpen(false);
          return;
        }
        if (menuFocused) {
          setMenuFocused(false);
          (document.activeElement as HTMLElement | null)?.blur?.();
          return;
        }
        if (editingNodeId) {
          cancelLabelEdit();
          return;
        }
        if (tool !== 'select') {
          setTool('select');
          setConnectFromId(null);
          return;
        }
        if (selectedIds.size > 0) {
          setSelectedIds(new Set());
          return;
        }
      }

      const editorFocused = isEditorFocused();

      if (
        (e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey)))
        && !editorFocused
      ) {
        if (selectedEdgeKey) {
          e.preventDefault();
          handleDeleteSelectedEdge();
          return;
        }
        if (selectedIds.size > 0) {
          e.preventDefault();
          handleDeleteSelected();
          return;
        }
      }

      // Plain Enter on a selected NOTE toggles expand/collapse
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !editorFocused &&
        !menuFocused &&
        !customBlockOpen &&
        !attrEditorOpen &&
        !editingNodeId &&
        selectedIds.size === 1 &&
        ast.type === 'flowchart'
      ) {
        const id = Array.from(selectedIds)[0];
        const node = ast.nodes.find((n) => n.id === id);
        if (node?.shape === 'note') {
          e.preventDefault();
          toggleNoteExpand(id);
          return;
        }
      }

      // Shift + 2: open/close the personalization menu and focus it for keyboard nav
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Digit2') {
        if (contextMenuOpen) {
          e.preventDefault();
          nodeMenu.close();
          setMenuFocused(false);
          (document.activeElement as HTMLElement | null)?.blur?.();
          return;
        }
        if (isShortcutBlocked()) return;
        e.preventDefault();
        if (singleSelectedNode && !editingNodeId) {
          nodeMenu.open('context');
          setMenuFocused(true);
        }
        return;
      }

      // Shift + 3: open / close the custom-block configurator
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Digit3') {
        if (isShortcutBlocked() && !customBlockOpen) return;
        e.preventDefault();
        nodeMenu.toggle('custom-block', !!singleSelectedNode && !editingNodeId);
        return;
      }

      // Shift + 5: open / close the attribute VALUE editor (edits existing attrs)
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.code === 'Digit5'
      ) {
        if (isShortcutBlocked() && !attrEditorOpen) return;
        e.preventDefault();
        if (attrEditorOpen) {
          nodeMenu.close();
          (document.activeElement as HTMLElement | null)?.blur?.();
        } else if (singleSelectedNode && !editingNodeId) {
          nodeMenu.open('attr-editor');
        }
        return;
      }

      // Shift + P: open / close the prompt solver panel
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyP') {
        if (isShortcutBlocked() && !solverOpen) return;
        e.preventDefault();
        setSolverOpen((prev) => !prev);
        return;
      }

      // Shift + G: open / close the prompt generator panel
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyG') {
        if (isShortcutBlocked() && !promptGenOpen) return;
        e.preventDefault();
        setPromptGenOpen((prev) => !prev);
        return;
      }

      // Shift + F: open / close the label picker (Features, Constraints, etc.)
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyF') {
        if (isShortcutBlocked() && !labelPickerOpen) return;
        e.preventDefault();
        if (labelPickerOpen) {
          nodeMenu.close();
          (document.activeElement as HTMLElement | null)?.blur?.();
        } else if (singleSelectedNode && !editingNodeId) {
          nodeMenu.open('label');
        }
        return;
      }

      // Shift + R: open / close the constraints menu (sistema de constraints)
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyR') {
        if (isShortcutBlocked() && !constraintMenuOpen) return;
        e.preventDefault();
        if (constraintMenuOpen) {
          nodeMenu.close();
          (document.activeElement as HTMLElement | null)?.blur?.();
        } else if (singleSelectedNode && !editingNodeId) {
          nodeMenu.open('constraint');
        }
        return;
      }

      // Shift + T: edit the hidden internal content of the selected node
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyT') {
        if (isShortcutBlocked() && !contentEditorOpen) return;
        e.preventDefault();
        if (contentEditorOpen) {
          nodeMenu.close();
          (document.activeElement as HTMLElement | null)?.blur?.();
        } else if (singleSelectedNode && !editingNodeId) {
          nodeMenu.open('content-edit');
        }
        return;
      }

      // F (tap, sin modificadores): ver / ocultar el contenido interno del nodo.
      // No rompe "hold F + WASD" (ese se dispara en el keydown del WASD).
      if (
        !isShortcutBlocked() &&
        !e.repeat &&
        e.code === 'KeyF' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !editingNodeId &&
        !!singleSelectedNode?.content
      ) {
        e.preventDefault();
        nodeMenu.toggle('content-view', !!singleSelectedNode?.content);
        return;
      }

      // N (tap, sin modificadores): excluir / incluir el nodo del prompt generator.
      if (
        !isShortcutBlocked() &&
        !e.repeat &&
        e.code === 'KeyN' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !editingNodeId &&
        !!singleSelectedNode &&
        ast.type === 'flowchart'
      ) {
        e.preventDefault();
        handleTogglePromptHidden(singleSelectedNode.id);
        return;
      }

      // M (tap): cicla el estado de implementacion del nodo (todo/wip/done/blocked).
      if (
        !isShortcutBlocked() &&
        !e.repeat &&
        e.code === 'KeyM' &&
        !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !editingNodeId &&
        !!singleSelectedNode &&
        ast.type === 'flowchart'
      ) {
        e.preventDefault();
        handleCycleStatus(singleSelectedNode.id);
        return;
      }

      // R (tap): toggle "pedido" (request) del nodo.
      if (
        !isShortcutBlocked() &&
        !e.repeat &&
        e.code === 'KeyR' &&
        !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !editingNodeId &&
        !!singleSelectedNode &&
        ast.type === 'flowchart'
      ) {
        e.preventDefault();
        handleToggleRequest(singleSelectedNode.id);
        return;
      }

      // Shift + L: abre la barra de archivos del nodo (textarea pre-cargado).
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyL') {
        if (isShortcutBlocked() && filesEditId === null) return;
        e.preventDefault();
        if (filesEditId !== null) {
          setFilesEditId(null);
        } else if (singleSelectedNode && !editingNodeId && ast.type === 'flowchart') {
          const node = ast.nodes.find((n) => n.id === singleSelectedNode.id);
          setFilesEditId(singleSelectedNode.id);
          setFilesText((node?.files ?? []).join('\n'));
        }
        return;
      }

      // Shift + J: abre la barra de archivos de TEST del nodo (gemelo de Shift+L).
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyJ') {
        if (isShortcutBlocked() && testsEditId === null) return;
        e.preventDefault();
        if (testsEditId !== null) {
          setTestsEditId(null);
        } else if (singleSelectedNode && !editingNodeId && ast.type === 'flowchart') {
          const node = ast.nodes.find((n) => n.id === singleSelectedNode.id);
          setTestsEditId(singleSelectedNode.id);
          setTestsText((node?.tests ?? []).join('\n'));
        }
        return;
      }

      // Shift + 4: open / close the attribute picker (progress, quantity, icon)
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Digit4') {
        if (isShortcutBlocked() && !attrPickerOpen) return;
        e.preventDefault();
        if (attrPickerOpen) {
          nodeMenu.close();
          (document.activeElement as HTMLElement | null)?.blur?.();
        } else if (singleSelectedNode && !editingNodeId) {
          nodeMenu.open('attr-picker');
        }
        return;
      }

      // While the attribute picker is open, WASD navigates chips and Enter toggles.
      if (attrPickerOpen) {
        const k = e.key.toLowerCase();
        const dir =
          k === 'w' ? 'up' : k === 'a' ? 'left' : k === 's' ? 'down' : k === 'd' ? 'right' : null;
        if (dir) {
          e.preventDefault();
          const items = Array.from(
            document.querySelectorAll<HTMLElement>('.attr-picker .attr-chip'),
          ).filter((el) => el.offsetParent !== null);
          const next = pickFocusableInDirection(
            document.activeElement as HTMLElement | null,
            items,
            dir as 'up' | 'down' | 'left' | 'right',
          );
          if (next) next.focus();
          else if (items.length > 0) items[0].focus();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const a = document.activeElement;
          if (a instanceof HTMLElement) a.click();
          return;
        }
      }

      // While the menu has keyboard focus, WASD navigates spatially between
      // its buttons / inputs and Enter activates the focused item.
      if (menuFocused) {
        const k = e.key.toLowerCase();
        const dir =
          k === 'w' ? 'up' : k === 'a' ? 'left' : k === 's' ? 'down' : k === 'd' ? 'right' : null;
        if (dir) {
          e.preventDefault();
          const items = Array.from(
            document.querySelectorAll<HTMLElement>(
              '.context-menu button, .context-menu input',
            ),
          ).filter((el) => el.offsetParent !== null);
          const next = pickFocusableInDirection(
            document.activeElement as HTMLElement | null,
            items,
            dir as 'up' | 'down' | 'left' | 'right',
          );
          if (next) next.focus();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const a = document.activeElement;
          if (a instanceof HTMLElement) a.click();
          return;
        }
      }

      // Shift + 1 toggles auto-focus
      if (
        !isShortcutBlocked() &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.code === 'Digit1'
      ) {
        e.preventDefault();
        toggleAutoFocus();
        return;
      }

      // While the custom block modal is open, WASD navigates between its
      // focusable controls (tabs, buttons, etc.) — but only when no input or
      // textarea is focused, so the user can still type into the contents area.
      if (
        customBlockOpen &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const a = document.activeElement;
        const inTypingField =
          a instanceof HTMLTextAreaElement ||
          (a instanceof HTMLInputElement &&
            (a.type === 'text' || a.type === 'number' || a.type === 'search' || a.type === 'url'));
        if (!inTypingField) {
          const k = e.key.toLowerCase();
          const dir =
            k === 'w' ? 'up' : k === 'a' ? 'left' : k === 's' ? 'down' : k === 'd' ? 'right' : null;
          if (dir) {
            e.preventDefault();
            const items = Array.from(
              document.querySelectorAll<HTMLElement>(
                '.custom-block-modal button, .custom-block-modal input, .custom-block-modal textarea',
              ),
            ).filter((el) => el.offsetParent !== null);
            const next = pickFocusableInDirection(
              document.activeElement as HTMLElement | null,
              items,
              dir as 'up' | 'down' | 'left' | 'right',
            );
            if (next) next.focus();
            else if (items.length > 0) items[0].focus();
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            const focused = document.activeElement;
            if (focused instanceof HTMLElement) focused.click();
            return;
          }
        }
      }

      // Hold F + WASD: open the LabelPicker in "create" mode for that
      // direction. The user picks the label via WASD+Enter inside the picker,
      // then the connected node is created with that label.
      if (
        !isShortcutBlocked() &&
        !attrEditorOpen &&
        !labelPickerOpen &&
        !attrPickerOpen &&
        !customBlockOpen &&
        heldKeysRef.current.has('f') &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        layoutResult?.kind === 'flowchart' &&
        selectedIds.size === 1
      ) {
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
          e.preventDefault();
          const dir: ConnectDir =
            k === 'w' ? 'up' : k === 'a' ? 'left' : k === 's' ? 'down' : 'right';
          setPendingCreateDir(dir);
          nodeMenu.open('label');
          return;
        }
      }

      // Shift + hold "/" + WASD: connect condicional. Abre una barra para
      // escribir la condicion/accion; Enter materializa el connect (nodo nuevo
      // en esa direccion, o solo el edge si ya hay un vecino ahi).
      if (
        !isShortcutBlocked() &&
        !attrEditorOpen &&
        !labelPickerOpen &&
        !attrPickerOpen &&
        !customBlockOpen &&
        conditionalDir === null &&
        heldKeysRef.current.has('/') &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        layoutResult?.kind === 'flowchart' &&
        selectedIds.size === 1
      ) {
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
          e.preventDefault();
          const dir: ConnectDir =
            k === 'w' ? 'up' : k === 'a' ? 'left' : k === 's' ? 'down' : 'right';
          setConditionalDir(dir);
          setConditionalText('');
          return;
        }
      }

      // Hold "/" + WASD (sin Shift): nudge the selected node by one grid step.
      // (Shift+/ produce "?" — normalizado a "/" en heldKeysRef.)
      if (
        !isShortcutBlocked() &&
        !attrEditorOpen &&
        !e.shiftKey &&
        heldKeysRef.current.has('/') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        layoutResult?.kind === 'flowchart' &&
        selectedIds.size === 1
      ) {
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
          e.preventDefault();
          const id = Array.from(selectedIds)[0];
          const node = layoutResult.nodes.find((n) => n.id === id);
          if (!node) return;
          let nx = node.x;
          let ny = node.y;
          if (k === 'w') ny -= GRID;
          else if (k === 's') ny += GRID;
          else if (k === 'a') nx -= GRID;
          else if (k === 'd') nx += GRID;
          pushSnapshot();
          // Pin every other node so the layout doesn't reflow when we nudge.
          lockOtherPositions(id);
          setManualPosition(id, { x: nx, y: ny });
          return;
        }
      }

      // Plain WASD navigates between nodes (no modifier).
      // Skip when an editor / picker that owns WASD is open.
      if (
        !isShortcutBlocked() &&
        !attrEditorOpen &&
        !labelPickerOpen &&
        !constraintMenuOpen &&
        !attrPickerOpen &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        layoutResult?.kind === 'flowchart'
      ) {
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
          e.preventDefault();
          const dir =
            k === 'w' ? 'up' : k === 'a' ? 'left' : k === 's' ? 'down' : 'right';
          const all = layoutResult.nodes;
          if (all.length === 0) return;
          if (selectedIds.size !== 1) {
            setSelectedIds(new Set([all[0].id]));
            return;
          }
          const curId = Array.from(selectedIds)[0];
          const cur = all.find((n) => n.id === curId);
          if (!cur) return;
          const next = pickNeighbor(
            { x: cur.x, y: cur.y },
            all.filter((n) => n.id !== curId),
            dir,
          );
          if (next) setSelectedIds(new Set([next.id]));
          return;
        }
      }

      // Add connected node with Shift + WASD when exactly one node is selected
      if (
        !isShortcutBlocked() &&
        selectedIds.size === 1 &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const selId = Array.from(selectedIds)[0];
        const k = e.key.toLowerCase();
        if (k === 'w') {
          e.preventDefault();
          handleAddConnected(selId, 'up');
          return;
        }
        if (k === 'a') {
          e.preventDefault();
          handleAddConnected(selId, 'left');
          return;
        }
        if (k === 's') {
          e.preventDefault();
          handleAddConnected(selId, 'down');
          return;
        }
        if (k === 'd') {
          e.preventDefault();
          handleAddConnected(selId, 'right');
          return;
        }
        if (k === 'q') {
          e.preventDefault();
          startLabelEdit(selId, false);
          return;
        }
        if (k === 'e') {
          e.preventDefault();
          startLabelEdit(selId, true);
          return;
        }
      }

      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const key = e.key.toLowerCase();

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (key === 'a' && !editorFocused && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleSelectAll();
        return;
      }
      // Ctrl+Alt + L/R/T/B/C/M align selection
      if (e.altKey && !editorFocused && selectedIds.size >= 2) {
        const ak: 'L' | 'R' | 'T' | 'B' | 'C' | 'M' | null =
          key === 'l' ? 'L'
            : key === 'r' ? 'R'
            : key === 't' ? 'T'
            : key === 'b' ? 'B'
            : key === 'c' ? 'C'
            : key === 'm' ? 'M'
            : null;
        if (ak) {
          e.preventDefault();
          handleAlignSelected(ak);
          return;
        }
      }
      // Ctrl+Alt + H/V distribute selection (needs ≥3)
      if (e.altKey && !editorFocused && selectedIds.size >= 3) {
        if (key === 'h') {
          e.preventDefault();
          handleDistributeSelected('H');
          return;
        }
        if (key === 'v') {
          e.preventDefault();
          handleDistributeSelected('V');
          return;
        }
      }
      if (key === 'c' && !editorFocused && selectedIds.size > 0) {
        e.preventDefault();
        void handleCopy();
        return;
      }
      if (key === 'v' && !editorFocused) {
        e.preventDefault();
        void handlePaste();
        return;
      }
      if (key === 'd' && !editorFocused && selectedIds.size > 0) {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if (key === 's' && !e.shiftKey) {
        e.preventDefault();
        void handleFileSave();
      } else if (key === 's' && e.shiftKey) {
        e.preventDefault();
        void handleFileSaveAs();
      } else if (key === 'o' && !e.shiftKey) {
        e.preventDefault();
        void handleFileOpen();
      } else if (key === 'i' && !e.shiftKey) {
        e.preventDefault();
        setImportOpen(true);
      } else if (key === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleFileNew();
      } else if (key === 'e' && !e.shiftKey) {
        e.preventDefault();
        handleExportSvg();
      } else if (key === 'e' && e.shiftKey) {
        e.preventDefault();
        handleExportPng();
      } else if (key === 'k') {
        e.preventDefault();
        setNodeSearchOpen((v) => !v);
      } else if (key === '0') {
        e.preventDefault();
        panZoomRef.current?.reset();
      } else if (key === '=' || key === '+') {
        e.preventDefault();
        panZoomRef.current?.zoomBy(1.2);
      } else if (key === '-') {
        e.preventDefault();
        panZoomRef.current?.zoomBy(1 / 1.2);
      } else if (key === '/') {
        e.preventDefault();
        setShowHelp(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, editingNodeId, selectedIds, showExamples, showHelp, source, ast, manualPositions, manualSizes, menuFocused, nodeMenu, solverOpen, promptGenOpen, singleSelectedNode, selectedEdgeKey, expandedNoteIds, conditionalDir, filesEditId, testsEditId]);

  const hasManual = Object.keys(manualPositions).length > 0 || Object.keys(manualSizes).length > 0;
  const canvasCursor =
    tool === 'select' ? undefined : tool === 'connect' ? 'pointer' : 'crosshair';
  const isFlowchart = layoutResult?.kind === 'flowchart';
  const showPalette = isFlowchart;

  const handleToolSelect = (t: Tool) => {
    setTool(t);
    setConnectFromId(null);
  };

  const diagramTypeLabel =
    ast.type === 'sequence' ? 'sequence' : ast.type === 'er' ? 'ER' : 'flowchart';

  const effectiveShowEditor = showEditor && !canvasOnly;

  return (
    <div className={`app ${canvasOnly ? 'canvas-only' : ''}`}>
      {syncStatus.state !== 'off' && (
        <div className={`sync-badge sync-${syncStatus.state}`} title="Sync con el archivo de /diagrams">
          {syncStatus.state === 'saving' && '⟳ guardando…'}
          {syncStatus.state === 'saved' && `✓ ${syncStatus.file}`}
          {syncStatus.state === 'unlinked' && '● sin vincular — agregá title:'}
          {syncStatus.state === 'error' && '⚠ sin dev server'}
        </div>
      )}
      {canvasOnly && (
        <div className="floating-controls">
          <FileMenu
            currentName={currentFile?.name ?? null}
            isDirty={isDirty}
            recents={recentFiles}
            onNew={handleFileNew}
            onOpen={handleFileOpen}
            onImport={() => setImportOpen(true)}
            onExportSpec={handleExportSpec}
            autoSpec={autoSpec}
            onToggleAutoSpec={() => setAutoSpec((v) => !v)}
            onSave={handleFileSave}
            onSaveAs={handleFileSaveAs}
            onPickRecent={handlePickRecent}
            onForgetRecent={handleForgetRecent}
          />
          <button
            type="button"
            className="floating-btn"
            onClick={handleRefreshCurrent}
            title="Refrescar el diagrama actual desde su archivo (/diagrams)"
          >
            ↻ refrescar
          </button>
          <button
            type="button"
            className="floating-btn"
            onClick={handleReloadLibrary}
            title="Abrir un diagrama de la biblioteca (/diagrams)"
          >
            biblioteca
          </button>
          <button
            type="button"
            className={`floating-btn ${autoFocus ? 'is-active' : ''}`}
            onClick={toggleAutoFocus}
            title="Auto-focus (Shift+1)"
          >
            auto-focus
          </button>
          <button
            type="button"
            className="floating-btn"
            onClick={toggleCanvasOnly}
            title="Salir de modo solo canvas"
          >
            menu
          </button>
        </div>
      )}
      {!canvasOnly && <header className="header">
        <h1>diagrama</h1>
        <span className="header-sub">{diagramTypeLabel}</span>
        <div className="spacer" />
        <div className="actions">
          <FileMenu
            currentName={currentFile?.name ?? null}
            isDirty={isDirty}
            recents={recentFiles}
            onNew={handleFileNew}
            onOpen={handleFileOpen}
            onImport={() => setImportOpen(true)}
            onExportSpec={handleExportSpec}
            autoSpec={autoSpec}
            onToggleAutoSpec={() => setAutoSpec((v) => !v)}
            onSave={handleFileSave}
            onSaveAs={handleFileSaveAs}
            onPickRecent={handlePickRecent}
            onForgetRecent={handleForgetRecent}
          />
          {hasManual && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={clearManualPositions}
              title="Reset posiciones y tamaños manuales"
            >
              reset layout
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleRefreshCurrent}
            title="Refrescar el diagrama actual desde su archivo (/diagrams)"
          >
            ↻ refrescar
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleReloadLibrary}
            title="Abrir un diagrama de la biblioteca (/diagrams)"
          >
            biblioteca
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowExamples(true)}
            title="Ver ejemplos"
          >
            examples
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowHelp(true)}
            title="Ayuda y atajos (Ctrl+/)"
          >
            help
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleResetSource}
            title="Reset DSL al ejemplo por defecto"
          >
            reset
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleShare}
            title="Compartir via URL"
          >
            share
          </button>
          <button
            type="button"
            className={`btn ${showEditor ? 'is-active' : ''}`}
            onClick={toggleEditor}
            title="Mostrar / ocultar editor de codigo"
          >
            code
          </button>
          <button
            type="button"
            className="btn"
            onClick={toggleCanvasOnly}
            title="Solo canvas: oculta header y editor (boton flotante para volver)"
          >
            minimal
          </button>
          <button
            type="button"
            className={`btn ${autoFocus ? 'is-active' : ''}`}
            onClick={toggleAutoFocus}
            title="Auto-focus: la camara sigue al nodo seleccionado"
          >
            auto-focus
          </button>
          <button
            type="button"
            className="btn"
            onClick={toggleTheme}
            title={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
          >
            {theme === 'dark' ? 'light' : 'dark'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => panZoomRef.current?.reset()}
            title="Ajustar zoom (Ctrl+0)"
          >
            fit
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleExportSvg}
            title="Exportar SVG (Ctrl+S)"
          >
            SVG
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportPng}
            title="Exportar PNG (Ctrl+Shift+S)"
          >
            PNG
          </button>
        </div>
      </header>}
      <TabBar
        tabs={tabs}
        activeId={activeTabId}
        onSelect={switchTab}
        onClose={closeTab}
        onAdd={addTab}
      />
      <main className="main">
        {effectiveShowEditor && (
          <>
            <section
              className="pane editor-pane"
              style={{ flexBasis: `${editorWidthPercent}%` }}
            >
              <Editor
                ref={editorRef}
                value={source}
                onChange={setSource}
                errors={errors}
                theme={theme}
                onCursorLineChange={setCursorLine}
              />
            </section>
            <Resizer onResize={handleResize} />
          </>
        )}
        <section className="pane preview-pane">
          {showPalette && (
            <div className="palette-dock">
              <Palette
                tool={tool}
                onSelect={handleToolSelect}
                connectFromId={connectFromId}
              />
              <ShortcutBar
                onSearch={() => setNodeSearchOpen((v) => !v)}
                onSolver={() => setSolverOpen((p) => !p)}
                onPrompt={() => setPromptGenOpen((p) => !p)}
                onExamples={() => setShowExamples(true)}
                onLint={() => setLinterOpen((p) => !p)}
                onSnapshots={() => setSnapshotsOpen((p) => !p)}
                onFiles={() => setFilesPanelOpen((p) => !p)}
              />
            </div>
          )}
          {selectedIds.size > 1 && (
            <div className="selection-info">
              {selectedIds.size} seleccionados — Delete, Ctrl+C, Ctrl+D
            </div>
          )}
          {tool !== 'select' && (
            <div className="tool-hint">
              {tool === 'connect'
                ? connectFromId
                  ? `Click en un segundo nodo para conectar desde ${connectFromId} (Esc para cancelar)`
                  : 'Click en el primer nodo (Esc para cancelar)'
                : `Click en el canvas para agregar ${tool} (Esc para cancelar)`}
            </div>
          )}
          {layoutResult ? (
            <PanZoom
              ref={panZoomRef}
              contentWidth={layoutResult.width}
              contentHeight={layoutResult.height}
              onCanvasClick={handleCanvasClick}
              onTransformChange={setTransform}
              onMarquee={handleMarquee}
              cursor={canvasCursor}
            >
              <Diagram
                ref={svgRef}
                layout={layoutResult}
                guidesX={dragGuides.x}
                guidesY={dragGuides.y}
                onNodePointerDown={handleNodePointerDown}
                onNodeDoubleClick={handleNodeDoubleClick}
                onNodeResizeStart={handleNodeResizeStart}
                onAddConnected={handleAddConnected}
                onToggleProgress={handleToggleProgress}
                onEdgePointerDown={handleEdgePointerDown}
                draggingNodeId={draggingNodeId}
                highlightedNodeIds={highlightedNodeIds}
                selectedNodeIds={selectedIds}
                selectedEdgeKey={selectedEdgeKey}
                connectFromId={connectFromId}
                editingNode={editingNode}
                editingValue={editingValue}
                onEditingValueChange={setEditingValue}
                onEditingCommit={commitLabelEdit}
                onEditingCancel={cancelLabelEdit}
              />
            </PanZoom>
          ) : (
            <div className="empty">Sin nodos para renderizar</div>
          )}
          {singleSelectedNode && menuScreenPos && !editingNode && contextMenuOpen && (
            <ContextMenu
              x={menuScreenPos.x}
              y={menuScreenPos.y}
              placement={menuScreenPos.placement}
              currentColor={singleSelectedNode.color}
              currentTextColor={singleSelectedNode.textColor}
              currentStrokeColor={singleSelectedNode.strokeColor}
              currentStrokeWidth={singleSelectedNode.strokeWidth}
              currentShape={singleSelectedNode.shape}
              currentIcon={singleSelectedNode.icon}
              recentColors={recentColors}
              usedColors={usedColors}
              onColorChange={applyColorToSelected}
              onTextColorChange={applyTextColorToSelected}
              onStrokeColorChange={applyStrokeColorToSelected}
              onStrokeWidthChange={applyStrokeWidthToSelected}
              onShapeChange={applyShapeToSelected}
              onIconChange={(v) => applyAttrToSelected('icon', v)}
              onClearColor={() => clearAttrFromSelected('color')}
              onClearTextColor={() => clearAttrFromSelected('textColor')}
              onClearStroke={() => {
                clearAttrFromSelected('strokeColor');
                clearAttrFromSelected('strokeWidth');
              }}
              onClearIcon={() => clearAttrFromSelected('icon')}
              onResetSize={handleResetSize}
              onAutoContrast={handleAutoContrast}
              onDelete={handleDeleteSelected}
              onDuplicate={handleDuplicateSelected}
            />
          )}
          {errors.length > 0 && (
            <div className="errors">
              {errors.length} error{errors.length === 1 ? '' : 'es'} de parseo
            </div>
          )}
          {toast && <div className="toast">{toast}</div>}
        </section>
      </main>
      {showExamples && (
        <ExamplesModal
          onSelect={(s) => {
            setSource(s);
            clearManualPositions();
          }}
          onClose={() => setShowExamples(false)}
        />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {importOpen && (
        <ImportModal
          reloadSignal={libraryVersion}
          onImport={handleImportGenerate}
          onPickLibrary={(d) => {
            openLibraryDiagram(d);
            setImportOpen(false);
          }}
          onClose={() => setImportOpen(false)}
          onCopyGuide={handleCopyGuide}
          onDownloadGuide={handleDownloadGuide}
          onCopyLoopGuide={handleCopyLoopGuide}
        />
      )}
      <ZoomControls
        scale={transform.scale}
        onZoomIn={() => panZoomRef.current?.zoomBy(1.2)}
        onZoomOut={() => panZoomRef.current?.zoomBy(1 / 1.2)}
        onFit={() => panZoomRef.current?.reset()}
      />
      {customBlockOpen && singleSelectedNode && (
        <CustomBlockMenu
          node={singleSelectedNode}
          onApply={handleApplyCustomBlock}
          onClose={() => nodeMenu.close()}
        />
      )}
      {selectedEdgeLayout && edgeMenuScreenPos && (
        <EdgeMenu
          x={edgeMenuScreenPos.x}
          y={edgeMenuScreenPos.y}
          placement={edgeMenuScreenPos.placement}
          arrow={selectedEdgeLayout.arrow}
          style={selectedEdgeLayout.style}
          color={selectedEdgeLayout.color}
          onSetArrow={handleSetEdgeArrow}
          onReverse={handleReverseEdge}
          onSetStyle={handleSetEdgeStyle}
          onSetColor={handleSetEdgeColor}
          onClearStyle={() => handleClearEdgeAttr('style')}
          onClearColor={() => handleClearEdgeAttr('color')}
          onClose={() => setSelectedEdgeKey(null)}
        />
      )}
      {nodeSearchOpen && layoutResult?.kind === 'flowchart' && (
        <NodeSearch
          nodes={layoutResult.nodes}
          onPick={(id) => {
            setSelectedIds(new Set([id]));
            setSelectedEdgeKey(null);
            const node = layoutResult.nodes.find((n) => n.id === id);
            if (node) panZoomRef.current?.centerOn(node.x, node.y);
          }}
          onClose={() => setNodeSearchOpen(false)}
        />
      )}
      {solverOpen && (
        <SolverPanel
          isFlowchart={ast.type === 'flowchart'}
          isRunning={solverRunning}
          response={solverResponse}
          error={solverError}
          onSubmit={handleSolverSubmit}
          onApply={handleSolverApply}
          onReject={handleSolverReject}
          onClose={() => {
            setSolverOpen(false);
            setSolverResponse(null);
            setSolverError(null);
          }}
        />
      )}
      {promptGenOpen && (
        <PromptGenPanel
          isFlowchart={ast.type === 'flowchart'}
          buildPrompt={buildScopedPrompt}
          onCopy={handleCopyPrompt}
          onClose={() => setPromptGenOpen(false)}
        />
      )}
      {linterOpen && (
        <LinterPanel
          issues={ast.type === 'flowchart' ? lintDiagram(ast) : []}
          onSelectNode={(id) => {
            setSelectedIds(new Set([id]));
            setSelectedEdgeKey(null);
          }}
          onClose={() => setLinterOpen(false)}
        />
      )}
      {snapshotsOpen && (
        <SnapshotPanel
          currentSource={source}
          onLoad={(s) => {
            setSource(s);
            clearManualPositions();
            setSnapshotsOpen(false);
          }}
          onDiffPrompt={handleDiffPrompt}
          onClose={() => setSnapshotsOpen(false)}
        />
      )}
      {filesPanelOpen && (
        <FilesPanel
          nodes={ast.type === 'flowchart' ? ast.nodes : []}
          onSetAssets={handleSetAssets}
          onSelectNode={(id) => {
            setSelectedIds(new Set([id]));
            setSelectedEdgeKey(null);
          }}
          onClose={() => setFilesPanelOpen(false)}
        />
      )}
      {uploadNodeId &&
        ast.type === 'flowchart' &&
        (() => {
          const upNode = ast.nodes.find((n) => n.id === uploadNodeId);
          if (!upNode) return null;
          return (
            <UploadNodeModal
              key={upNode.id}
              node={upNode}
              onSetBuzon={handleSetBuzon}
              onClose={() => setUploadNodeId(null)}
            />
          );
        })()}
      {filesEditId && singleSelectedNode && labelPickerScreenPos && (
        <div
          className="conditional-input"
          style={{ left: labelPickerScreenPos.x, top: labelPickerScreenPos.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="conditional-input-title">archivos — una ruta por linea</span>
          <textarea
            className="conditional-input-field files-edit-area"
            autoFocus
            rows={Math.min(8, Math.max(2, filesText.split('\n').length))}
            placeholder={'src/api.ts\nsrc/lib/helper.ts'}
            value={filesText}
            onChange={(e) => setFilesText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                commitFilesEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setFilesEditId(null);
                (document.activeElement as HTMLElement | null)?.blur?.();
              }
            }}
          />
          <div className="files-edit-actions">
            <button type="button" className="btn" onClick={() => setRepoPickerTarget('file')} tabIndex={-1}>
              del repo…
            </button>
            <div className="spacer" />
            <button type="button" className="btn" onClick={() => setFilesEditId(null)} tabIndex={-1}>
              cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={commitFilesEdit} tabIndex={-1}>
              guardar
            </button>
          </div>
          <div className="conditional-input-hint">Ctrl+Enter guarda · Esc cancela</div>
        </div>
      )}
      {testsEditId && singleSelectedNode && labelPickerScreenPos && (
        <div
          className="conditional-input"
          style={{ left: labelPickerScreenPos.x, top: labelPickerScreenPos.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="conditional-input-title">archivos de test — una ruta por linea</span>
          <textarea
            className="conditional-input-field files-edit-area"
            autoFocus
            rows={Math.min(8, Math.max(2, testsText.split('\n').length))}
            placeholder={'src/api.test.ts\nsrc/lib/helper.test.ts'}
            value={testsText}
            onChange={(e) => setTestsText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                commitTestsEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setTestsEditId(null);
                (document.activeElement as HTMLElement | null)?.blur?.();
              }
            }}
          />
          <div className="files-edit-actions">
            <button type="button" className="btn" onClick={() => setRepoPickerTarget('tests')} tabIndex={-1}>
              del repo…
            </button>
            <div className="spacer" />
            <button type="button" className="btn" onClick={() => setTestsEditId(null)} tabIndex={-1}>
              cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={commitTestsEdit} tabIndex={-1}>
              guardar
            </button>
          </div>
          <div className="conditional-input-hint">Ctrl+Enter guarda · Esc cancela</div>
        </div>
      )}
      {repoPickerTarget && (
        <RepoFilePicker
          initialSelected={(repoPickerTarget === 'file' ? filesText : testsText)
            .split(/[\n;]/)
            .map((s) => s.trim())
            .filter(Boolean)}
          onPick={(paths) => {
            if (repoPickerTarget === 'file') setFilesText(paths.join('\n'));
            else setTestsText(paths.join('\n'));
            setRepoPickerTarget(null);
          }}
          onClose={() => setRepoPickerTarget(null)}
        />
      )}
      {conditionalDir && singleSelectedNode && labelPickerScreenPos && (
        <div
          className="conditional-input"
          style={{ left: labelPickerScreenPos.x, top: labelPickerScreenPos.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="conditional-input-title">
            connect condicional · {conditionalDir}
          </span>
          <input
            className="conditional-input-field"
            autoFocus
            placeholder="condicion / accion... (Enter)"
            value={conditionalText}
            onChange={(e) => setConditionalText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateConditional(
                  singleSelectedNode.id,
                  conditionalDir,
                  conditionalText,
                );
                setConditionalDir(null);
                setConditionalText('');
                (document.activeElement as HTMLElement | null)?.blur?.();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setConditionalDir(null);
                setConditionalText('');
                (document.activeElement as HTMLElement | null)?.blur?.();
              }
            }}
            onBlur={() => {
              setConditionalDir(null);
              setConditionalText('');
            }}
          />
        </div>
      )}
      {labelPickerOpen && singleSelectedNode && labelPickerScreenPos && (
        <LabelPicker
          x={labelPickerScreenPos.x}
          y={labelPickerScreenPos.y}
          placement={labelPickerScreenPos.placement}
          mode={
            pendingCreateDir
              ? { kind: 'create', directionHint: pendingCreateDir }
              : { kind: 'tag' }
          }
          currentLabels={
            pendingCreateDir
              ? []
              : ast.type === 'flowchart'
                ? ast.nodes.find((n) => n.id === singleSelectedNode.id)?.labels ?? []
                : []
          }
          labelPrompts={labelPrompts}
          onEditPrompt={setLabelPrompt}
          onToggle={(key) => {
            if (pendingCreateDir) {
              handleAddConnectedWithLabel(
                singleSelectedNode.id,
                pendingCreateDir,
                key,
              );
              lastLabelRef.current = key;
              setPendingCreateDir(null);
              nodeMenu.close();
              (document.activeElement as HTMLElement | null)?.blur?.();
            } else {
              handleToggleLabel(key);
            }
          }}
          onAddCustom={(key) => {
            if (pendingCreateDir) {
              handleAddConnectedWithLabel(
                singleSelectedNode.id,
                pendingCreateDir,
                key,
              );
              lastLabelRef.current = key;
              setPendingCreateDir(null);
              nodeMenu.close();
            } else {
              handleAddCustomLabel(key);
            }
          }}
          onClose={() => {
            nodeMenu.close();
            setPendingCreateDir(null);
            (document.activeElement as HTMLElement | null)?.blur?.();
          }}
        />
      )}
      {constraintMenuOpen && singleSelectedNode && labelPickerScreenPos && ast.type === 'flowchart' && (
        <ConstraintMenu
          x={labelPickerScreenPos.x}
          y={labelPickerScreenPos.y}
          placement={labelPickerScreenPos.placement}
          nodeLabel={
            ast.nodes.find((n) => n.id === singleSelectedNode.id)?.label ?? singleSelectedNode.id
          }
          isConstraint={
            (ast.nodes.find((n) => n.id === singleSelectedNode.id)?.labels ?? []).includes('constraint')
          }
          constraints={ast.nodes
            .filter(
              (n) => (n.labels ?? []).includes('constraint') && n.id !== singleSelectedNode.id,
            )
            .map((n) => ({ id: n.id, label: n.label || n.id }))}
          appliedIds={ast.nodes.find((n) => n.id === singleSelectedNode.id)?.constraints ?? []}
          onToggleSelf={() => handleToggleLabel('constraint')}
          onToggleApply={handleToggleConstraintApply}
          onClose={() => {
            nodeMenu.close();
            (document.activeElement as HTMLElement | null)?.blur?.();
          }}
        />
      )}
      {contentEditorOpen && singleSelectedNode && labelPickerScreenPos && (
        <ContentEditor
          x={labelPickerScreenPos.x}
          y={labelPickerScreenPos.y}
          placement={labelPickerScreenPos.placement}
          initialValue={singleSelectedNode.content ?? ''}
          onSave={handleSaveContent}
          onClose={() => {
            nodeMenu.close();
            (document.activeElement as HTMLElement | null)?.blur?.();
          }}
        />
      )}
      {contentViewOpen && singleSelectedNode && singleSelectedNode.content && labelPickerScreenPos && (
        <ContentView
          x={labelPickerScreenPos.x}
          y={labelPickerScreenPos.y}
          placement={labelPickerScreenPos.placement}
          label={singleSelectedNode.label}
          content={singleSelectedNode.content}
          onClose={() => nodeMenu.close()}
        />
      )}
      {attrEditorOpen && singleSelectedNode && attrEditorScreenPos && (
        <AttributeEditor
          x={attrEditorScreenPos.x}
          y={attrEditorScreenPos.y}
          placement={attrEditorScreenPos.placement}
          values={{
            progress: singleSelectedNode.progress,
            quantity: singleSelectedNode.quantity,
            icon: singleSelectedNode.icon,
          }}
          onSetProgress={(v) => handleSetAttrValue('progress', v ? 'true' : 'false')}
          onSetQuantity={(v) => handleSetAttrValue('quantity', String(v))}
          onSetIcon={(v) => handleSetAttrValue('icon', v)}
          onClose={() => {
            nodeMenu.close();
            (document.activeElement as HTMLElement | null)?.blur?.();
          }}
        />
      )}
      {attrPickerOpen && singleSelectedNode && attrPickerScreenPos && (
        <AttributePicker
          x={attrPickerScreenPos.x}
          y={attrPickerScreenPos.y}
          placement={attrPickerScreenPos.placement}
          state={{
            progress: singleSelectedNode.progress,
            quantity: singleSelectedNode.quantity,
            icon: singleSelectedNode.icon,
          }}
          onToggle={handleToggleAttr}
          onClose={() => {
            nodeMenu.close();
            (document.activeElement as HTMLElement | null)?.blur?.();
          }}
        />
      )}
    </div>
  );
}

function isEditorFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  // Only count Monaco and the inline label-edit input.
  // The hex input does NOT block Ctrl+C/V (the user expects those on canvas).
  if (active.classList.contains('label-input')) return true;
  return !!active.closest('.monaco-editor');
}

function isShortcutBlocked(): boolean {
  // Stricter than isEditorFocused: ALSO blocks when any text input has focus
  // (e.g. the hex color input). Used for letter-only shortcuts like Shift+W
  // so the user can still type letters into form inputs.
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  if (active.closest('.monaco-editor')) return true;
  if (active.classList.contains('label-input')) return true;
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true;
  return false;
}

function pickFocusableInDirection(
  current: HTMLElement | null,
  items: HTMLElement[],
  direction: 'up' | 'down' | 'left' | 'right',
): HTMLElement | null {
  if (items.length === 0) return null;
  if (!current || !items.includes(current)) return items[0];
  const curRect = current.getBoundingClientRect();
  const cx = curRect.left + curRect.width / 2;
  const cy = curRect.top + curRect.height / 2;
  const PI = Math.PI;
  const inRange = (a: number) => {
    switch (direction) {
      case 'right':
        return a >= -PI / 4 && a <= PI / 4;
      case 'down':
        return a > PI / 4 && a < (3 * PI) / 4;
      case 'left':
        return a >= (3 * PI) / 4 || a <= -(3 * PI) / 4;
      case 'up':
        return a < -PI / 4 && a > -(3 * PI) / 4;
    }
  };
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (item === current) continue;
    const r = item.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    if (dx === 0 && dy === 0) continue;
    const angle = Math.atan2(dy, dx);
    if (!inRange(angle)) continue;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  }
  return best;
}

function pickNeighbor(
  current: { x: number; y: number },
  others: { x: number; y: number; id: string }[],
  direction: 'up' | 'down' | 'left' | 'right',
): { id: string; x: number; y: number } | null {
  const PI = Math.PI;
  const inRange = (a: number) => {
    switch (direction) {
      case 'right':
        return a >= -PI / 4 && a <= PI / 4;
      case 'down':
        return a > PI / 4 && a < (3 * PI) / 4;
      case 'left':
        return a >= (3 * PI) / 4 || a <= -(3 * PI) / 4;
      case 'up':
        return a < -PI / 4 && a > -(3 * PI) / 4;
    }
  };
  let best: { id: string; x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const n of others) {
    const dx = n.x - current.x;
    const dy = n.y - current.y;
    if (dx === 0 && dy === 0) continue;
    const angle = Math.atan2(dy, dx);
    if (!inRange(angle)) continue;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = { id: n.id, x: n.x, y: n.y };
    }
  }
  return best;
}

/**
 * Find the closest "snap" alignment between the dragging anchor's edges
 * (left, center, right; top, center, bottom) and the same edges of every
 * other node within `threshold` world units. Returns adjusted center
 * coords + the world-space guide lines to render.
 */
function computeSnapToOtherNodes(
  cx: number,
  cy: number,
  w: number,
  h: number,
  others: ReadonlyArray<{ x: number; y: number; width: number; height: number }>,
  threshold: number,
): {
  snappedX: number | null;
  snappedY: number | null;
  guidesX: number[];
  guidesY: number[];
} {
  const ownXs = [cx - w / 2, cx, cx + w / 2]; // L / C / R
  const ownYs = [cy - h / 2, cy, cy + h / 2]; // T / C / B
  let bestX: { dist: number; deltaCenter: number; guideX: number } | null = null;
  let bestY: { dist: number; deltaCenter: number; guideY: number } | null = null;

  for (const o of others) {
    const otherXs = [o.x - o.width / 2, o.x, o.x + o.width / 2];
    const otherYs = [o.y - o.height / 2, o.y, o.y + o.height / 2];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const dx = otherXs[j] - ownXs[i];
        const ax = Math.abs(dx);
        if (ax <= threshold && (!bestX || ax < bestX.dist)) {
          bestX = { dist: ax, deltaCenter: dx, guideX: otherXs[j] };
        }
        const dy = otherYs[j] - ownYs[i];
        const ay = Math.abs(dy);
        if (ay <= threshold && (!bestY || ay < bestY.dist)) {
          bestY = { dist: ay, deltaCenter: dy, guideY: otherYs[j] };
        }
      }
    }
  }
  return {
    snappedX: bestX ? cx + bestX.deltaCenter : null,
    snappedY: bestY ? cy + bestY.deltaCenter : null,
    guidesX: bestX ? [bestX.guideX] : [],
    guidesY: bestY ? [bestY.guideY] : [],
  };
}

function contrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // Relative luminance (linear approximation)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 0.6 ? '#0f172a' : '#ffffff';
}

export default App;
