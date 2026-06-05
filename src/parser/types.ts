export type Direction = 'TB' | 'LR' | 'BT' | 'RL';

export type Shape =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'cylinder'
  | 'hexagon'
  | 'circle'
  | 'list'
  | 'note'
  | 'image';

export const SHAPES: readonly Shape[] = [
  'rectangle',
  'ellipse',
  'diamond',
  'cylinder',
  'hexagon',
  'circle',
  'list',
  'note',
  'image',
];

export type ListStyle = 'bullets' | 'numbered';
export const LIST_STYLES: readonly ListStyle[] = ['bullets', 'numbered'];

// Estado de implementacion de un nodo (para el loop con Claude Code).
export type NodeStatus = 'todo' | 'wip' | 'done' | 'blocked';
export const NODE_STATUSES: readonly NodeStatus[] = ['todo', 'wip', 'done', 'blocked'];

export type ArrowType = 'directed' | 'bidirectional' | 'undirected';

export type EdgeStyle = 'solid' | 'dashed' | 'dotted';

export const EDGE_STYLES: readonly EdgeStyle[] = ['solid', 'dashed', 'dotted'];

export type DiagramType = 'flowchart' | 'sequence' | 'er';

export const DIAGRAM_TYPES: readonly DiagramType[] = ['flowchart', 'sequence', 'er'];

// === Flowchart / Cloud ===

export type DiagramNode = {
  id: string;
  label: string;
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
  /** Ids de nodos-constraint aplicados a este nodo (se reflejan en el prompt). */
  constraints?: string[];
  progress?: boolean;
  quantity?: number;
  width?: number;
  height?: number;
  /** Si true, el nodo se excluye del prompt generator (attr DSL `noPrompt`). */
  promptHidden?: boolean;
  /** Estado de implementacion (attr DSL `status`). */
  status?: NodeStatus;
  /** "Pedido": marca que este nodo es algo nuevo a implementar (attr DSL `request`). */
  request?: boolean;
  /** Archivos del repo vinculados a este nodo (attr DSL `file`, separados por ;). */
  files?: string[];
  /** Archivos de test que cubren este nodo (attr DSL `tests`, separados por ;). */
  tests?: string[];
  groupId?: string;
  sourceLine: number;
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
  arrow: ArrowType;
  style?: EdgeStyle;
  color?: string;
  /** Connect condicional: solo transiciona al hacer una accion (el label es la condicion). */
  conditional?: boolean;
  sourceLine: number;
};

export type DiagramGroup = {
  id: string;
  label: string;
  parentId?: string;
  sourceLine: number;
};

export type FlowchartAST = {
  type: 'flowchart';
  direction: Direction;
  title?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
};

// === Sequence ===

export type Actor = {
  id: string;
  label: string;
  sourceLine: number;
};

export type Message = {
  from: string;
  to: string;
  label?: string;
  arrow: ArrowType;
  style?: EdgeStyle;
  color?: string;
  sourceLine: number;
  order: number;
};

export type SequenceNote = {
  text: string;
  actorIds: string[];
  order: number;
  sourceLine: number;
};

export type SequenceItem =
  | { kind: 'message'; data: Message }
  | { kind: 'note'; data: SequenceNote };

export type SequenceAST = {
  type: 'sequence';
  title?: string;
  actors: Actor[];
  messages: Message[];
  notes: SequenceNote[];
  items: SequenceItem[];
};

// === ER ===

export type ErColumn = {
  name: string;
  type: string;
  isPk: boolean;
  isFk: boolean;
};

export type ErTable = {
  id: string;
  label: string;
  columns: ErColumn[];
  color?: string;
  icon?: string;
  sourceLine: number;
};

export type ErRelation = {
  fromTable: string;
  fromColumn?: string;
  toTable: string;
  toColumn?: string;
  cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-many';
  sourceLine: number;
};

export type ErAST = {
  type: 'er';
  direction: Direction;
  title?: string;
  tables: ErTable[];
  relations: ErRelation[];
};

// === Combined ===

export type DiagramAST = FlowchartAST | SequenceAST | ErAST;

export type ParseError = {
  line: number;
  message: string;
};

export type SourceMap = {
  lineToNodes: Map<number, string[]>;
};

export type ParseResult = {
  ast: DiagramAST;
  errors: ParseError[];
  sourceMap: SourceMap;
};
