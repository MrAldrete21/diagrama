import * as dagre from 'dagre';
import type {
  DiagramAST,
  DiagramNode,
  Shape,
  ArrowType,
  EdgeStyle,
  ListStyle,
  NodeStatus,
  BuzonData,
  FlowchartAST,
  SequenceAST,
  ErAST,
  ErTable,
} from '../parser/types';

// ============================================================================
// Common types
// ============================================================================

export type LayoutNode = {
  id: string;
  label: string;
  labelLines?: string[];
  shape: Shape;
  color?: string;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  icon?: string;
  items?: string[];
  listStyle?: ListStyle;
  content?: string;
  src?: string;
  labels?: string[];
  progress?: boolean;
  quantity?: number;
  promptHidden?: boolean;
  status?: NodeStatus;
  request?: boolean;
  files?: string[];
  tests?: string[];
  assets?: string[];
  buzon?: BuzonData;
  expanded?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  groupId?: string;
  sourceLine: number;
};

export type LayoutEdge = {
  from: string;
  to: string;
  label?: string;
  arrow: ArrowType;
  style?: EdgeStyle;
  color?: string;
  conditional?: boolean;
  points: { x: number; y: number }[];
  sourceLine: number;
};

export type LayoutGroup = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceLine: number;
};

export type FlowchartLayout = {
  kind: 'flowchart';
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
  width: number;
  height: number;
  title?: string;
};

// Sequence layout
export type SeqActorBox = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lifelineHeight: number;
  sourceLine: number;
};

export type SeqMessage = {
  from: string;
  to: string;
  fromX: number;
  toX: number;
  y: number;
  label?: string;
  arrow: ArrowType;
  style?: EdgeStyle;
  color?: string;
  sourceLine: number;
};

export type SeqNote = {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  sourceLine: number;
};

export type SequenceLayout = {
  kind: 'sequence';
  actors: SeqActorBox[];
  messages: SeqMessage[];
  notes: SeqNote[];
  width: number;
  height: number;
  title?: string;
};

// ER layout
export type ErTableBox = {
  id: string;
  label: string;
  color?: string;
  icon?: string;
  columns: {
    name: string;
    type: string;
    isPk: boolean;
    isFk: boolean;
    yOffset: number;
  }[];
  x: number;
  y: number;
  width: number;
  height: number;
  headerHeight: number;
  rowHeight: number;
  sourceLine: number;
};

export type ErRelationLayout = {
  fromTable: string;
  toTable: string;
  fromColumn?: string;
  toColumn?: string;
  cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-many';
  points: { x: number; y: number }[];
  sourceLine: number;
};

export type ErLayout = {
  kind: 'er';
  tables: ErTableBox[];
  relations: ErRelationLayout[];
  width: number;
  height: number;
  title?: string;
};

export type LayoutResult = FlowchartLayout | SequenceLayout | ErLayout;

export type ManualPositions = Record<string, { x: number; y: number }>;
export type ManualSizes = Record<string, { width: number; height: number }>;

const NODE_HEIGHT = 48;
const NODE_PADDING_X = 24;
const CHAR_WIDTH = 8;
const MIN_NODE_WIDTH = 80;
const ICON_PREFIX_WIDTH = 28;
// Cap width so very long labels wrap to multiple lines instead of stretching.
const MAX_NODE_WIDTH = 240;
const LINE_HEIGHT = 18;

/**
 * Greedy word-wrap. Breaks on whitespace; force-splits words longer than
 * maxChars. Returns at least one line even for empty input.
 */
export function wrapLabel(label: string, maxChars: number): string[] {
  if (maxChars <= 0) return [label];
  if (label.length <= maxChars) return [label || ''];
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [label];
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length <= maxChars) {
      cur = candidate;
      continue;
    }
    if (cur) lines.push(cur);
    if (word.length > maxChars) {
      let rem = word;
      while (rem.length > maxChars) {
        lines.push(rem.slice(0, maxChars));
        rem = rem.slice(maxChars);
      }
      cur = rem;
    } else {
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [label];
}

const LIST_HEADER_H = 30;
const LIST_ROW_H = 22;
const LIST_PADDING = 12;

const NOTE_COLLAPSED_W = 120;
const NOTE_COLLAPSED_H = 40;
const NOTE_HEADER_H = 28;
const NOTE_LINE_H = 18;
const NOTE_BODY_PADDING = 12;

export type NoteSizing = { expanded: boolean };

function flowchartNodeSize(
  node: DiagramNode,
  noteExpanded = false,
): { width: number; height: number; labelLines?: string[] } {
  const iconExtra = node.icon ? ICON_PREFIX_WIDTH : 0;
  const maxCharsPerLine = Math.max(
    8,
    Math.floor((MAX_NODE_WIDTH - NODE_PADDING_X * 2 - iconExtra) / CHAR_WIDTH),
  );
  const lines = wrapLabel(node.label, maxCharsPerLine);
  const longestLineLen = lines.reduce(
    (acc, l) => Math.max(acc, l.length),
    0,
  );
  const baseWidth = Math.max(
    MIN_NODE_WIDTH,
    longestLineLen * CHAR_WIDTH + NODE_PADDING_X * 2 + iconExtra,
  );
  const extraLines = lines.length - 1;
  const baseHeight = NODE_HEIGHT + extraLines * LINE_HEIGHT;
  switch (node.shape) {
    case 'circle': {
      const d = Math.max(baseWidth, baseHeight, 80);
      return { width: d, height: d, labelLines: lines };
    }
    case 'diamond':
      return {
        width: baseWidth + 30,
        height: baseHeight + 16,
        labelLines: lines,
      };
    case 'cylinder':
      return {
        width: baseWidth,
        height: baseHeight + 14,
        labelLines: lines,
      };
    case 'hexagon':
      return { width: baseWidth + 24, height: baseHeight, labelLines: lines };
    case 'ellipse':
      return { width: baseWidth + 12, height: baseHeight, labelLines: lines };
    case 'list': {
      const items = node.items ?? [];
      const longestItem = items.reduce((a, b) => (a.length > b.length ? a : b), '');
      const itemW = longestItem.length * CHAR_WIDTH + LIST_PADDING * 2;
      const titleW = node.label.length * CHAR_WIDTH + NODE_PADDING_X * 2;
      const width = Math.max(MIN_NODE_WIDTH + 20, itemW, titleW);
      const height = LIST_HEADER_H + items.length * LIST_ROW_H + LIST_PADDING;
      return { width, height: Math.max(NODE_HEIGHT, height) };
    }
    case 'image':
      return { width: 200, height: 150 };
    case 'upload':
    case 'form': {
      // Nodos "buzon" (archivos / texto): icono + label + contador. Ancho segun label.
      const titleW = node.label.length * CHAR_WIDTH + NODE_PADDING_X * 2;
      return { width: Math.max(200, titleW), height: 96 };
    }
    case 'note': {
      if (!noteExpanded) {
        const titleW = Math.max(
          NOTE_COLLAPSED_W,
          node.label.length * CHAR_WIDTH + NODE_PADDING_X,
        );
        return { width: titleW, height: NOTE_COLLAPSED_H };
      }
      const content = node.content ?? '';
      const lines = content.split('\n');
      const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
      const lineW = Math.max(longest.length, node.label.length) * CHAR_WIDTH + NOTE_BODY_PADDING * 2;
      const width = Math.max(260, Math.min(560, lineW));
      const height =
        NOTE_HEADER_H + Math.max(1, lines.length) * NOTE_LINE_H + NOTE_BODY_PADDING * 2;
      return { width, height };
    }
    default:
      return { width: baseWidth, height: baseHeight, labelLines: lines };
  }
}

export function layout(
  ast: DiagramAST,
  manualPositions: ManualPositions = {},
  manualSizes: ManualSizes = {},
  labelOverrides: Record<string, string> = {},
  expandedNoteIds: ReadonlySet<string> = new Set(),
): LayoutResult | null {
  if (ast.type === 'flowchart')
    return layoutFlowchart(
      ast,
      manualPositions,
      manualSizes,
      labelOverrides,
      expandedNoteIds,
    );
  if (ast.type === 'sequence') return layoutSequence(ast);
  if (ast.type === 'er') return layoutEr(ast, manualPositions);
  return null;
}

// ============================================================================
// Flowchart layout (Dagre)
// ============================================================================

function layoutFlowchart(
  ast: FlowchartAST,
  manualPositions: ManualPositions,
  manualSizes: ManualSizes,
  labelOverrides: Record<string, string>,
  expandedNoteIds: ReadonlySet<string>,
): FlowchartLayout {
  if (ast.nodes.length === 0) {
    return { kind: 'flowchart', nodes: [], edges: [], groups: [], width: 0, height: 0, ...(ast.title ? { title: ast.title } : {}) };
  }
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  g.setGraph({
    rankdir: ast.direction,
    nodesep: 50,
    ranksep: 60,
    marginx: 24,
    marginy: 24,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const group of ast.groups) g.setNode(group.id, { label: group.label });
  for (const group of ast.groups)
    if (group.parentId) g.setParent(group.id, group.parentId);

  const autoSizes = new Map<string, { width: number; height: number; labelLines?: string[] }>();
  for (const node of ast.nodes) {
    // While editing, the node's effective label is the live editingValue
    // (passed via labelOverrides) so the box grows / shrinks in real time.
    const overrideLabel = labelOverrides[node.id];
    const sizingNode =
      overrideLabel !== undefined ? { ...node, label: overrideLabel } : node;
    const noteExpanded = node.shape === 'note' && expandedNoteIds.has(node.id);
    const auto = flowchartNodeSize(sizingNode, noteExpanded);
    autoSizes.set(node.id, auto);
    const manual = manualSizes[node.id];
    // Notes ignore manual size: when expanded they need to grow to fit content,
    // when collapsed they should stay tiny regardless of prior manual resize.
    const useManual = node.shape !== 'note';
    const width = (useManual ? manual?.width : undefined) ?? node.width ?? auto.width;
    const height = (useManual ? manual?.height : undefined) ?? node.height ?? auto.height;
    g.setNode(node.id, { label: node.label, width, height });
    if (node.groupId) g.setParent(node.id, node.groupId);
  }

  let edgeIdx = 0;
  for (const edge of ast.edges) {
    g.setEdge(edge.from, edge.to, { label: edge.label, edgeIdx }, `e${edgeIdx}`);
    edgeIdx++;
  }

  dagre.layout(g);

  const nodeIds = new Set(ast.nodes.map((n) => n.id));
  const groupIds = new Set(ast.groups.map((gr) => gr.id));
  const nodeById = new Map(ast.nodes.map((n) => [n.id, n]));
  const groupById = new Map(ast.groups.map((gr) => [gr.id, gr]));

  const layoutNodes: LayoutNode[] = [];
  for (const id of g.nodes()) {
    if (!nodeIds.has(id)) continue;
    const n = g.node(id);
    const astNode = nodeById.get(id)!;
    const manual = manualPositions[id];
    const node: LayoutNode = {
      id,
      label: n.label as string,
      shape: astNode.shape,
      x: manual?.x ?? n.x,
      y: manual?.y ?? n.y,
      width: n.width,
      height: n.height,
      sourceLine: astNode.sourceLine,
    };
    const auto = autoSizes.get(id);
    if (auto?.labelLines && auto.labelLines.length > 1)
      node.labelLines = auto.labelLines;
    if (astNode.color) node.color = astNode.color;
    if (astNode.textColor) node.textColor = astNode.textColor;
    if (astNode.strokeColor) node.strokeColor = astNode.strokeColor;
    if (astNode.strokeWidth !== undefined) node.strokeWidth = astNode.strokeWidth;
    if (astNode.icon) node.icon = astNode.icon;
    if (astNode.items) node.items = astNode.items;
    if (astNode.listStyle) node.listStyle = astNode.listStyle;
    if (astNode.content !== undefined) node.content = astNode.content;
    if (astNode.src !== undefined) node.src = astNode.src;
    if (astNode.labels !== undefined && astNode.labels.length > 0)
      node.labels = astNode.labels;
    if (astNode.progress !== undefined) node.progress = astNode.progress;
    if (astNode.quantity !== undefined) node.quantity = astNode.quantity;
    if (astNode.promptHidden) node.promptHidden = true;
    if (astNode.status) node.status = astNode.status;
    if (astNode.request) node.request = true;
    if (astNode.files && astNode.files.length > 0) node.files = astNode.files;
    if (astNode.tests && astNode.tests.length > 0) node.tests = astNode.tests;
    if (astNode.assets && astNode.assets.length > 0) node.assets = astNode.assets;
    if (astNode.buzon) node.buzon = astNode.buzon;
    if (astNode.shape === 'note' && expandedNoteIds.has(astNode.id))
      node.expanded = true;
    if (astNode.groupId) node.groupId = astNode.groupId;
    layoutNodes.push(node);
  }

  const layoutGroups: LayoutGroup[] = [];
  for (const id of g.nodes()) {
    if (!groupIds.has(id)) continue;
    const n = g.node(id);
    const astGroup = groupById.get(id)!;
    layoutGroups.push({
      id,
      label: astGroup.label,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      sourceLine: astGroup.sourceLine,
    });
  }

  // Recompute each group's bbox from its FINAL (potentially manual) children
  // positions. Without this, when a sibling node outside the group changes size,
  // Dagre may reposition the group rectangle even though every node inside has a
  // pinned manual position.
  const childrenOf = new Map<string, LayoutNode[]>();
  for (const n of layoutNodes) {
    if (!n.groupId) continue;
    let arr = childrenOf.get(n.groupId);
    if (!arr) {
      arr = [];
      childrenOf.set(n.groupId, arr);
    }
    arr.push(n);
  }
  const GROUP_PAD = 20;
  const GROUP_LABEL_PAD = 14;
  // Multiple passes so nested groups settle (child group bbox contributes to
  // parent group bbox).
  for (let pass = 0; pass < 3; pass++) {
    for (const grp of layoutGroups) {
      const children = childrenOf.get(grp.id) ?? [];
      const childGroups = layoutGroups.filter((g2) => {
        const ag = ast.groups.find((a) => a.id === g2.id);
        return ag?.parentId === grp.id;
      });
      if (children.length === 0 && childGroups.length === 0) continue;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const c of children) {
        minX = Math.min(minX, c.x - c.width / 2);
        minY = Math.min(minY, c.y - c.height / 2);
        maxX = Math.max(maxX, c.x + c.width / 2);
        maxY = Math.max(maxY, c.y + c.height / 2);
      }
      for (const cg of childGroups) {
        minX = Math.min(minX, cg.x - cg.width / 2);
        minY = Math.min(minY, cg.y - cg.height / 2);
        maxX = Math.max(maxX, cg.x + cg.width / 2);
        maxY = Math.max(maxY, cg.y + cg.height / 2);
      }
      minX -= GROUP_PAD;
      minY -= GROUP_PAD + GROUP_LABEL_PAD;
      maxX += GROUP_PAD;
      maxY += GROUP_PAD;
      grp.x = (minX + maxX) / 2;
      grp.y = (minY + maxY) / 2;
      grp.width = maxX - minX;
      grp.height = maxY - minY;
    }
  }

  const layoutNodeById = new Map(layoutNodes.map((n) => [n.id, n]));

  const layoutEdges: LayoutEdge[] = ast.edges.map((astEdge, i) => {
    const eRef = { v: astEdge.from, w: astEdge.to, name: `e${i}` };
    const data = g.edge(eRef);
    const fromManual = manualPositions[astEdge.from];
    const toManual = manualPositions[astEdge.to];
    let points = data?.points
      ? data.points.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }))
      : [];
    if (fromManual || toManual) {
      const fromN = layoutNodeById.get(astEdge.from);
      const toN = layoutNodeById.get(astEdge.to);
      if (fromN && toN) points = straightLinePoints(fromN, toN);
    }
    const out: LayoutEdge = {
      from: astEdge.from,
      to: astEdge.to,
      arrow: astEdge.arrow,
      points,
      sourceLine: astEdge.sourceLine,
    };
    if (astEdge.label) out.label = astEdge.label;
    if (astEdge.style) out.style = astEdge.style;
    if (astEdge.color) out.color = astEdge.color;
    if (astEdge.conditional) out.conditional = true;
    return out;
  });

  const graph = g.graph();
  let width = graph.width ?? 0;
  let height = graph.height ?? 0;
  for (const n of layoutNodes) {
    width = Math.max(width, n.x + n.width / 2 + 24);
    height = Math.max(height, n.y + n.height / 2 + 24);
  }

  const result: FlowchartLayout = {
    kind: 'flowchart',
    nodes: layoutNodes,
    edges: layoutEdges,
    groups: layoutGroups,
    width,
    height,
  };
  if (ast.title) result.title = ast.title;
  return result;
}

function straightLinePoints(
  from: LayoutNode,
  to: LayoutNode,
): { x: number; y: number }[] {
  const start = clipToBox(from, to.x, to.y);
  const end = clipToBox(to, from.x, from.y);
  return [start, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, end];
}

function clipToBox(
  box: { x: number; y: number; width: number; height: number },
  tx: number,
  ty: number,
): { x: number; y: number } {
  const dx = tx - box.x;
  const dy = ty - box.y;
  if (dx === 0 && dy === 0) return { x: box.x, y: box.y };
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  const sx = dx === 0 ? Infinity : Math.abs(halfW / dx);
  const sy = dy === 0 ? Infinity : Math.abs(halfH / dy);
  const s = Math.min(sx, sy);
  return { x: box.x + dx * s, y: box.y + dy * s };
}

// ============================================================================
// Sequence layout
// ============================================================================

const ACTOR_WIDTH = 120;
const ACTOR_HEIGHT = 48;
const ACTOR_GAP = 60;
const MSG_GAP = 50;
const TOP_MARGIN = 30;
const SIDE_MARGIN = 30;
const NOTE_PADDING = 16;

function layoutSequence(ast: SequenceAST): SequenceLayout {
  // Position actors evenly across the top
  const actorX = new Map<string, number>();
  ast.actors.forEach((a, i) => {
    const x = SIDE_MARGIN + ACTOR_WIDTH / 2 + i * (ACTOR_WIDTH + ACTOR_GAP);
    actorX.set(a.id, x);
  });

  // Order items by their order field
  const items = [...ast.items].sort((a, b) => a.data.order - b.data.order);

  const messages: SeqMessage[] = [];
  const notes: SeqNote[] = [];
  let curY = TOP_MARGIN + ACTOR_HEIGHT + 30;
  for (const item of items) {
    if (item.kind === 'message') {
      const m = item.data;
      const fromX = actorX.get(m.from) ?? 0;
      const toX = actorX.get(m.to) ?? 0;
      const msg: SeqMessage = {
        from: m.from,
        to: m.to,
        fromX,
        toX,
        y: curY,
        arrow: m.arrow,
        sourceLine: m.sourceLine,
      };
      if (m.label) msg.label = m.label;
      if (m.style) msg.style = m.style;
      if (m.color) msg.color = m.color;
      messages.push(msg);
      curY += MSG_GAP;
    } else {
      const n = item.data;
      const xs = n.actorIds.map((id) => actorX.get(id) ?? 0);
      const minX = Math.min(...xs) - ACTOR_WIDTH / 2;
      const maxX = Math.max(...xs) + ACTOR_WIDTH / 2;
      notes.push({
        x: minX,
        y: curY,
        width: maxX - minX,
        height: 36,
        text: n.text,
        sourceLine: n.sourceLine,
      });
      curY += 36 + 16;
    }
  }

  const lifelineHeight = Math.max(120, curY - TOP_MARGIN - ACTOR_HEIGHT);
  const totalHeight = TOP_MARGIN + ACTOR_HEIGHT + lifelineHeight + 50;

  const actorBoxes: SeqActorBox[] = ast.actors.map((a) => ({
    id: a.id,
    label: a.label,
    x: actorX.get(a.id) ?? 0,
    y: TOP_MARGIN + ACTOR_HEIGHT / 2,
    width: ACTOR_WIDTH,
    height: ACTOR_HEIGHT,
    lifelineHeight,
    sourceLine: a.sourceLine,
  }));

  const totalWidth =
    ast.actors.length === 0
      ? 200
      : SIDE_MARGIN * 2 + ast.actors.length * ACTOR_WIDTH + (ast.actors.length - 1) * ACTOR_GAP;

  const result: SequenceLayout = {
    kind: 'sequence',
    actors: actorBoxes,
    messages,
    notes,
    width: totalWidth,
    height: totalHeight,
  };
  if (ast.title) result.title = ast.title;
  return result;
  // For unused tracker
  void NOTE_PADDING;
}

// ============================================================================
// ER layout (Dagre with custom table sizing)
// ============================================================================

const ER_ROW_HEIGHT = 24;
const ER_HEADER_HEIGHT = 32;
const ER_TABLE_MIN_WIDTH = 180;
const ER_COL_PADDING = 14;

function erTableSize(table: ErTable): { width: number; height: number } {
  const longestRow = Math.max(
    table.label.length + 4,
    ...table.columns.map((c) => c.name.length + c.type.length + 5),
  );
  const width = Math.max(
    ER_TABLE_MIN_WIDTH,
    longestRow * CHAR_WIDTH + ER_COL_PADDING * 2,
  );
  const height = ER_HEADER_HEIGHT + Math.max(1, table.columns.length) * ER_ROW_HEIGHT;
  return { width, height };
}

function layoutEr(ast: ErAST, manualPositions: ManualPositions): ErLayout {
  if (ast.tables.length === 0) {
    return { kind: 'er', tables: [], relations: [], width: 0, height: 0, ...(ast.title ? { title: ast.title } : {}) };
  }

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({
    rankdir: ast.direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 24,
    marginy: 24,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const sizes = new Map<string, { width: number; height: number }>();
  for (const t of ast.tables) {
    const sz = erTableSize(t);
    sizes.set(t.id, sz);
    g.setNode(t.id, { label: t.label, width: sz.width, height: sz.height });
  }

  let edgeIdx = 0;
  for (const r of ast.relations) {
    if (sizes.has(r.fromTable) && sizes.has(r.toTable)) {
      g.setEdge(r.fromTable, r.toTable, {}, `er${edgeIdx}`);
    }
    edgeIdx++;
  }

  dagre.layout(g);

  const tables: ErTableBox[] = ast.tables.map((t) => {
    const n = g.node(t.id);
    const manual = manualPositions[t.id];
    const sz = sizes.get(t.id)!;
    const x = manual?.x ?? n.x;
    const y = manual?.y ?? n.y;
    const columns = t.columns.map((c, i) => ({
      name: c.name,
      type: c.type,
      isPk: c.isPk,
      isFk: c.isFk,
      yOffset: ER_HEADER_HEIGHT + i * ER_ROW_HEIGHT + ER_ROW_HEIGHT / 2,
    }));
    const box: ErTableBox = {
      id: t.id,
      label: t.label,
      columns,
      x,
      y,
      width: sz.width,
      height: sz.height,
      headerHeight: ER_HEADER_HEIGHT,
      rowHeight: ER_ROW_HEIGHT,
      sourceLine: t.sourceLine,
    };
    if (t.color) box.color = t.color;
    if (t.icon) box.icon = t.icon;
    return box;
  });

  const tableById = new Map(tables.map((t) => [t.id, t]));

  const relations: ErRelationLayout[] = [];
  for (const r of ast.relations) {
    const ft = tableById.get(r.fromTable);
    const tt = tableById.get(r.toTable);
    if (!ft || !tt) continue;
    const fromCol = r.fromColumn ? ft.columns.find((c) => c.name === r.fromColumn) : undefined;
    const toCol = r.toColumn ? tt.columns.find((c) => c.name === r.toColumn) : undefined;

    const fromY = ft.y - ft.height / 2 + (fromCol?.yOffset ?? ft.height / 2);
    const toY = tt.y - tt.height / 2 + (toCol?.yOffset ?? tt.height / 2);

    const fromSide = ft.x < tt.x ? ft.x + ft.width / 2 : ft.x - ft.width / 2;
    const toSide = ft.x < tt.x ? tt.x - tt.width / 2 : tt.x + tt.width / 2;

    const midX = (fromSide + toSide) / 2;
    const out: ErRelationLayout = {
      fromTable: r.fromTable,
      toTable: r.toTable,
      points: [
        { x: fromSide, y: fromY },
        { x: midX, y: fromY },
        { x: midX, y: toY },
        { x: toSide, y: toY },
      ],
      sourceLine: r.sourceLine,
    };
    if (r.fromColumn) out.fromColumn = r.fromColumn;
    if (r.toColumn) out.toColumn = r.toColumn;
    if (r.cardinality) out.cardinality = r.cardinality;
    relations.push(out);
  }

  const graph = g.graph();
  let width = graph.width ?? 0;
  let height = graph.height ?? 0;
  for (const t of tables) {
    width = Math.max(width, t.x + t.width / 2 + 24);
    height = Math.max(height, t.y + t.height / 2 + 24);
  }

  const result: ErLayout = {
    kind: 'er',
    tables,
    relations,
    width,
    height,
  };
  if (ast.title) result.title = ast.title;
  return result;
}
