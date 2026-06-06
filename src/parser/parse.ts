import type {
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  Direction,
  Shape,
  EdgeStyle,
  ListStyle,
  ParseError,
  ParseResult,
  FlowchartAST,
  SequenceAST,
  ErAST,
  Actor,
  Message,
  SequenceNote,
  SequenceItem,
  ErTable,
  ErColumn,
  ErRelation,
  NodeStatus,
} from './types';
import { SHAPES, EDGE_STYLES, LIST_STYLES, NODE_STATUSES } from './types';
import {
  stripComment,
  indexOfOutsideBrackets,
  splitOutsideBrackets,
  findArrowOperator,
  parseAttrs,
  detectDiagramType,
} from './common';
import type { ArrowMatch } from './common';

const DIRECTIONS: ReadonlySet<Direction> = new Set(['TB', 'LR', 'BT', 'RL']);
const SHAPE_SET: ReadonlySet<Shape> = new Set(SHAPES);
const STYLE_SET: ReadonlySet<EdgeStyle> = new Set(EDGE_STYLES);
const LIST_STYLE_SET: ReadonlySet<ListStyle> = new Set(LIST_STYLES);

function decodeContent(s: string): string {
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    return s;
  }
}

export function parse(source: string): ParseResult {
  const type = detectDiagramType(source);
  if (type === 'sequence') return parseSequence(source);
  if (type === 'er') return parseEr(source);
  return parseFlowchart(source);
}

// ============================================================================
// FLOWCHART (also serves as cloud-architecture via icon attr)
// ============================================================================

type NodeDecl = {
  id: string;
  label?: string;
  shape?: Shape;
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
  constraints?: string[];
  progress?: boolean;
  quantity?: number;
  width?: number;
  height?: number;
  promptHidden?: boolean;
  status?: NodeStatus;
  request?: boolean;
  files?: string[];
  tests?: string[];
  assets?: string[];
};

function parseFlowchart(source: string): ParseResult {
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];
  const groups: DiagramGroup[] = [];
  const errors: ParseError[] = [];
  const groupStack: string[] = [];
  const lineToNodes = new Map<number, string[]>();
  let direction: Direction = 'TB';
  let title: string | undefined;
  let groupCounter = 0;

  const recordLine = (lineNum: number, ids: string[]) => {
    if (ids.length === 0) return;
    const existing = lineToNodes.get(lineNum) ?? [];
    for (const id of ids) if (!existing.includes(id)) existing.push(id);
    lineToNodes.set(lineNum, existing);
  };

  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = stripComment(lines[i]).trim();
    if (!line) continue;

    if (/^type\s*:/i.test(line)) continue;
    const titleMatch = line.match(/^title\s*:?\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/^["']|["']$/g, '').trim();
      continue;
    }

    if (line === '}') {
      if (groupStack.length === 0) {
        errors.push({ line: lineNum, message: 'Cierre } sin grupo abierto' });
      } else {
        groupStack.pop();
      }
      continue;
    }

    const groupMatch = line.match(/^group\s+"([^"]+)"\s*\{$/);
    if (groupMatch) {
      const id = `group_${groupCounter++}`;
      const label = groupMatch[1];
      const parentId = groupStack[groupStack.length - 1];
      const grp: DiagramGroup = parentId
        ? { id, label, parentId, sourceLine: lineNum }
        : { id, label, sourceLine: lineNum };
      groups.push(grp);
      groupStack.push(id);
      continue;
    }

    const dirMatch = line.match(/^direction\s+(\w+)$/);
    if (dirMatch) {
      const dir = dirMatch[1].toUpperCase();
      if (DIRECTIONS.has(dir as Direction)) direction = dir as Direction;
      else
        errors.push({
          line: lineNum,
          message: `Direccion invalida: ${dir}. Usa TB, LR, BT o RL.`,
        });
      continue;
    }

    const arrow = findArrowOperator(line);
    if (arrow) {
      const refIds = parseEdgeLine(
        line,
        lineNum,
        arrow,
        nodes,
        edges,
        groupStack,
        errors,
      );
      recordLine(lineNum, refIds);
      continue;
    }

    const id = parseNodeLineFlowchart(line, lineNum, nodes, groupStack, errors);
    if (id) recordLine(lineNum, [id]);
  }

  if (groupStack.length > 0) {
    errors.push({
      line: lines.length,
      message: `${groupStack.length} grupo(s) sin cerrar`,
    });
  }

  const ast: FlowchartAST = {
    type: 'flowchart',
    direction,
    nodes: Array.from(nodes.values()),
    edges,
    groups,
  };
  if (title) ast.title = title;
  return { ast, errors, sourceMap: { lineToNodes } };
}

function parseEdgeLine(
  line: string,
  lineNum: number,
  arrow: ArrowMatch,
  nodes: Map<string, DiagramNode>,
  edges: DiagramEdge[],
  groupStack: string[],
  errors: ParseError[],
): string[] {
  const colonIdx = indexOfOutsideBrackets(line, ':');
  const edgePart = colonIdx === -1 ? line : line.slice(0, colonIdx);
  const labelRaw = colonIdx === -1 ? '' : line.slice(colonIdx + 1);

  let label: string | undefined;
  let edgeAttrs: Record<string, string> = {};
  if (labelRaw.trim()) {
    const trim = labelRaw.trim();
    const m = trim.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
    if (m) {
      const lbl = m[1].trim();
      if (lbl) label = lbl;
      edgeAttrs = parseAttrs(m[2], lineNum, errors);
    } else {
      label = trim;
    }
  }

  const arrowInEdge = findArrowOperator(edgePart);
  if (!arrowInEdge) {
    errors.push({ line: lineNum, message: 'Edge requiere operador (>, <>, --)' });
    return [];
  }
  const sourcesStr = edgePart.slice(0, arrowInEdge.idx);
  const targetsStr = edgePart.slice(arrowInEdge.idx + arrowInEdge.len);

  if (findArrowOperator(targetsStr)) {
    errors.push({ line: lineNum, message: 'Edge debe tener un solo operador' });
    return [];
  }

  const sourceEntries = splitOutsideBrackets(sourcesStr, ',')
    .map((s) => s.trim())
    .filter(Boolean);
  const targetEntries = splitOutsideBrackets(targetsStr, ',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (sourceEntries.length === 0 || targetEntries.length === 0) {
    errors.push({
      line: lineNum,
      message: 'Edge requiere al menos un origen y un destino',
    });
    return [];
  }

  const groupId = currentGroup(groupStack);
  const sourceIds: string[] = [];
  const targetIds: string[] = [];

  for (const entry of sourceEntries) {
    const decl = parseNodeDecl(entry, lineNum, errors);
    if (decl) {
      upsertNode(decl, nodes, groupId, lineNum);
      sourceIds.push(decl.id);
    }
  }
  for (const entry of targetEntries) {
    const decl = parseNodeDecl(entry, lineNum, errors);
    if (decl) {
      upsertNode(decl, nodes, groupId, lineNum);
      targetIds.push(decl.id);
    }
  }

  let style: EdgeStyle | undefined;
  let color: string | undefined;
  if (edgeAttrs.style) {
    if (STYLE_SET.has(edgeAttrs.style as EdgeStyle)) {
      style = edgeAttrs.style as EdgeStyle;
    } else {
      errors.push({
        line: lineNum,
        message: `Estilo invalido: ${edgeAttrs.style}. Validos: ${EDGE_STYLES.join(', ')}`,
      });
    }
  }
  if (edgeAttrs.color) color = edgeAttrs.color;
  let conditional = false;
  if (edgeAttrs.conditional !== undefined) {
    const v = edgeAttrs.conditional.toLowerCase();
    conditional = v === 'true' || v === '1';
  }

  for (const s of sourceIds) {
    for (const t of targetIds) {
      const edge: DiagramEdge = {
        from: s,
        to: t,
        arrow: arrow.type,
        sourceLine: lineNum,
      };
      if (label) edge.label = label;
      if (style) edge.style = style;
      if (color) edge.color = color;
      if (conditional) edge.conditional = true;
      edges.push(edge);
    }
  }

  return [...sourceIds, ...targetIds];
}

function parseNodeLineFlowchart(
  line: string,
  lineNum: number,
  nodes: Map<string, DiagramNode>,
  groupStack: string[],
  errors: ParseError[],
): string | null {
  const decl = parseNodeDecl(line, lineNum, errors);
  if (!decl) return null;
  upsertNode(decl, nodes, currentGroup(groupStack), lineNum);
  return decl.id;
}

function parseNodeDecl(
  entry: string,
  lineNum: number,
  errors: ParseError[],
): NodeDecl | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  const idMatch = trimmed.match(/^([^\s[]+)/);
  if (!idMatch) {
    errors.push({ line: lineNum, message: `No se puede parsear: ${entry}` });
    return null;
  }
  const id = idMatch[1];
  const decl: NodeDecl = { id };
  const rest = trimmed.slice(id.length).trim();
  if (!rest) return decl;

  // El bloque de atributos es [ ... ]. Matcheamos el ] que balancea al primer [
  // por profundidad (soporta brackets anidados como rutas .../[id].tsx); debe
  // cerrar al final del entry o el resto es basura.
  if (rest[0] !== '[') {
    errors.push({ line: lineNum, message: `No se puede parsear: ${entry}` });
    return null;
  }
  let bracketDepth = 0;
  let closeIdx = -1;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '[') bracketDepth++;
    else if (rest[i] === ']') {
      bracketDepth--;
      if (bracketDepth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx !== rest.length - 1) {
    errors.push({ line: lineNum, message: `No se puede parsear: ${entry}` });
    return null;
  }
  const attrPart = rest.slice(1, closeIdx);
  if (!attrPart.trim()) return decl;

  if (!attrPart.includes(':')) {
    decl.label = attrPart.trim();
    return decl;
  }

  const attrs = parseAttrs(attrPart, lineNum, errors);
  if (attrs.label) decl.label = attrs.label;
  if (attrs.color) decl.color = attrs.color;
  if (attrs.textColor) decl.textColor = attrs.textColor;
  if (attrs.strokeColor) decl.strokeColor = attrs.strokeColor;
  if (attrs.strokeWidth) {
    const sw = parseFloat(attrs.strokeWidth);
    if (Number.isFinite(sw) && sw >= 0) decl.strokeWidth = sw;
  }
  if (attrs.icon) decl.icon = attrs.icon;
  if (attrs.items) {
    decl.items = attrs.items
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (attrs.listStyle) {
    if (LIST_STYLE_SET.has(attrs.listStyle as ListStyle)) {
      decl.listStyle = attrs.listStyle as ListStyle;
    }
  }
  if (attrs.content) {
    decl.content = decodeContent(attrs.content);
  }
  if (attrs.src) {
    decl.src = decodeContent(attrs.src);
  }
  if (attrs.labels) {
    decl.labels = attrs.labels
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (attrs.constraints) {
    decl.constraints = attrs.constraints
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (attrs.progress !== undefined) {
    const v = attrs.progress.toLowerCase();
    decl.progress = v === 'true' || v === 'done' || v === '1';
  }
  if (attrs.quantity !== undefined) {
    const n = parseFloat(attrs.quantity);
    if (Number.isFinite(n)) decl.quantity = n;
  }
  if (attrs.noPrompt !== undefined) {
    const v = attrs.noPrompt.toLowerCase();
    decl.promptHidden = v === 'true' || v === '1';
  }
  if (attrs.status !== undefined) {
    const v = attrs.status.toLowerCase();
    if (NODE_STATUSES.includes(v as NodeStatus)) decl.status = v as NodeStatus;
    else if (v === 'pending') decl.status = 'todo';
    else if (v === 'progress' || v === 'in-progress') decl.status = 'wip';
  }
  if (attrs.request !== undefined) {
    const v = attrs.request.toLowerCase();
    decl.request = v === 'true' || v === '1';
  }
  if (attrs.file !== undefined) {
    decl.files = attrs.file
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (attrs.tests !== undefined) {
    decl.tests = attrs.tests
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (attrs.assets !== undefined) {
    decl.assets = attrs.assets
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (attrs.width) {
    const w = parseFloat(attrs.width);
    if (Number.isFinite(w) && w > 0) decl.width = w;
  }
  if (attrs.height) {
    const h = parseFloat(attrs.height);
    if (Number.isFinite(h) && h > 0) decl.height = h;
  }
  if (attrs.shape) {
    if (SHAPE_SET.has(attrs.shape as Shape)) decl.shape = attrs.shape as Shape;
    else {
      errors.push({
        line: lineNum,
        message: `Shape invalida: ${attrs.shape}. Validas: ${SHAPES.join(', ')}`,
      });
    }
  }
  return decl;
}

function upsertNode(
  decl: NodeDecl,
  nodes: Map<string, DiagramNode>,
  groupId: string | undefined,
  lineNum: number,
): void {
  const existing = nodes.get(decl.id);
  if (existing) {
    if (decl.label !== undefined) existing.label = decl.label;
    if (decl.shape !== undefined) existing.shape = decl.shape;
    if (decl.color !== undefined) existing.color = decl.color;
    if (decl.textColor !== undefined) existing.textColor = decl.textColor;
    if (decl.strokeColor !== undefined) existing.strokeColor = decl.strokeColor;
    if (decl.strokeWidth !== undefined) existing.strokeWidth = decl.strokeWidth;
    if (decl.icon !== undefined) existing.icon = decl.icon;
    if (decl.items !== undefined) existing.items = decl.items;
    if (decl.listStyle !== undefined) existing.listStyle = decl.listStyle;
    if (decl.content !== undefined) existing.content = decl.content;
    if (decl.src !== undefined) existing.src = decl.src;
    if (decl.labels !== undefined) existing.labels = decl.labels;
    if (decl.constraints !== undefined) existing.constraints = decl.constraints;
    if (decl.progress !== undefined) existing.progress = decl.progress;
    if (decl.quantity !== undefined) existing.quantity = decl.quantity;
    if (decl.promptHidden !== undefined) existing.promptHidden = decl.promptHidden;
    if (decl.status !== undefined) existing.status = decl.status;
    if (decl.request !== undefined) existing.request = decl.request;
    if (decl.files !== undefined) existing.files = decl.files;
    if (decl.tests !== undefined) existing.tests = decl.tests;
    if (decl.assets !== undefined) existing.assets = decl.assets;
    if (decl.width !== undefined) existing.width = decl.width;
    if (decl.height !== undefined) existing.height = decl.height;
    if (groupId && !existing.groupId) existing.groupId = groupId;
  } else {
    const node: DiagramNode = {
      id: decl.id,
      label: decl.label ?? decl.id,
      shape: decl.shape ?? 'rectangle',
      sourceLine: lineNum,
    };
    if (decl.color) node.color = decl.color;
    if (decl.textColor) node.textColor = decl.textColor;
    if (decl.strokeColor) node.strokeColor = decl.strokeColor;
    if (decl.strokeWidth !== undefined) node.strokeWidth = decl.strokeWidth;
    if (decl.icon) node.icon = decl.icon;
    if (decl.items) node.items = decl.items;
    if (decl.listStyle) node.listStyle = decl.listStyle;
    if (decl.content !== undefined) node.content = decl.content;
    if (decl.src !== undefined) node.src = decl.src;
    if (decl.labels !== undefined) node.labels = decl.labels;
    if (decl.constraints !== undefined) node.constraints = decl.constraints;
    if (decl.progress !== undefined) node.progress = decl.progress;
    if (decl.quantity !== undefined) node.quantity = decl.quantity;
    if (decl.promptHidden !== undefined) node.promptHidden = decl.promptHidden;
    if (decl.status !== undefined) node.status = decl.status;
    if (decl.request !== undefined) node.request = decl.request;
    if (decl.files !== undefined) node.files = decl.files;
    if (decl.tests !== undefined) node.tests = decl.tests;
    if (decl.assets !== undefined) node.assets = decl.assets;
    if (decl.width) node.width = decl.width;
    if (decl.height) node.height = decl.height;
    if (groupId) node.groupId = groupId;
    nodes.set(decl.id, node);
  }
}

function currentGroup(stack: string[]): string | undefined {
  return stack[stack.length - 1];
}

// ============================================================================
// SEQUENCE
// ============================================================================

function parseSequence(source: string): ParseResult {
  const actorMap = new Map<string, Actor>();
  const messages: Message[] = [];
  const notes: SequenceNote[] = [];
  const items: SequenceItem[] = [];
  const errors: ParseError[] = [];
  const lineToNodes = new Map<number, string[]>();
  let title: string | undefined;
  let order = 0;

  const recordLine = (lineNum: number, ids: string[]) => {
    if (ids.length === 0) return;
    const existing = lineToNodes.get(lineNum) ?? [];
    for (const id of ids) if (!existing.includes(id)) existing.push(id);
    lineToNodes.set(lineNum, existing);
  };

  const ensureActor = (id: string, lineNum: number): Actor => {
    let a = actorMap.get(id);
    if (!a) {
      a = { id, label: id, sourceLine: lineNum };
      actorMap.set(id, a);
    }
    return a;
  };

  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = stripComment(lines[i]).trim();
    if (!line) continue;

    if (/^type\s*:/i.test(line)) continue;
    const titleMatch = line.match(/^title\s*:?\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/^["']|["']$/g, '').trim();
      continue;
    }

    // Note: "note over A, B: text" or "note over A: text"
    const noteMatch = line.match(/^note\s+over\s+([^:]+)\s*:\s*(.+)$/i);
    if (noteMatch) {
      const actorIds = noteMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const id of actorIds) ensureActor(id, lineNum);
      const note: SequenceNote = {
        text: noteMatch[2].trim(),
        actorIds,
        order: order++,
        sourceLine: lineNum,
      };
      notes.push(note);
      items.push({ kind: 'note', data: note });
      recordLine(lineNum, actorIds);
      continue;
    }

    // Actor declaration: "actor Name" or "Name [label: ...]"
    const actorDeclMatch = line.match(
      /^(?:actor\s+)?([A-Za-z_][\w]*)(?:\s*\[([^\]]+)\])?$/,
    );
    if (actorDeclMatch && !findArrowOperator(line)) {
      const id = actorDeclMatch[1];
      const attrPart = actorDeclMatch[2];
      const actor = ensureActor(id, lineNum);
      if (attrPart) {
        if (attrPart.includes(':')) {
          const attrs = parseAttrs(attrPart, lineNum, errors);
          if (attrs.label) actor.label = attrs.label;
        } else {
          actor.label = attrPart.trim();
        }
      }
      recordLine(lineNum, [id]);
      continue;
    }

    // Message: "A > B: text" or "A --> B: text" or A > B (no label)
    const arrow = findArrowOperator(line);
    if (arrow) {
      const colonIdx = indexOfOutsideBrackets(line, ':');
      const edgePart = colonIdx === -1 ? line : line.slice(0, colonIdx);
      const labelRaw = colonIdx === -1 ? '' : line.slice(colonIdx + 1);

      let label: string | undefined;
      let edgeAttrs: Record<string, string> = {};
      if (labelRaw.trim()) {
        const trim = labelRaw.trim();
        const m = trim.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
        if (m) {
          const lbl = m[1].trim();
          if (lbl) label = lbl;
          edgeAttrs = parseAttrs(m[2], lineNum, errors);
        } else {
          label = trim;
        }
      }

      const arrowInEdge = findArrowOperator(edgePart);
      if (!arrowInEdge) continue;
      const sourcesStr = edgePart.slice(0, arrowInEdge.idx).trim();
      const targetsStr = edgePart.slice(arrowInEdge.idx + arrowInEdge.len).trim();

      const fromId = sourcesStr.match(/^([A-Za-z_][\w]*)/)?.[1];
      const toId = targetsStr.match(/^([A-Za-z_][\w]*)/)?.[1];
      if (!fromId || !toId) {
        errors.push({ line: lineNum, message: 'Mensaje requiere actores' });
        continue;
      }

      ensureActor(fromId, lineNum);
      ensureActor(toId, lineNum);

      let style: EdgeStyle | undefined;
      let color: string | undefined;
      if (edgeAttrs.style && STYLE_SET.has(edgeAttrs.style as EdgeStyle))
        style = edgeAttrs.style as EdgeStyle;
      if (edgeAttrs.color) color = edgeAttrs.color;

      const msg: Message = {
        from: fromId,
        to: toId,
        arrow: arrow.type,
        sourceLine: lineNum,
        order: order++,
      };
      if (label) msg.label = label;
      if (style) msg.style = style;
      if (color) msg.color = color;
      messages.push(msg);
      items.push({ kind: 'message', data: msg });
      recordLine(lineNum, [fromId, toId]);
      continue;
    }
  }

  const ast: SequenceAST = {
    type: 'sequence',
    actors: Array.from(actorMap.values()),
    messages,
    notes,
    items,
  };
  if (title) ast.title = title;
  return { ast, errors, sourceMap: { lineToNodes } };
}

// ============================================================================
// ER
// ============================================================================

function parseEr(source: string): ParseResult {
  const tables = new Map<string, ErTable>();
  const relations: ErRelation[] = [];
  const errors: ParseError[] = [];
  const lineToNodes = new Map<number, string[]>();
  let direction: Direction = 'LR';
  let title: string | undefined;

  const recordLine = (lineNum: number, ids: string[]) => {
    if (ids.length === 0) return;
    const existing = lineToNodes.get(lineNum) ?? [];
    for (const id of ids) if (!existing.includes(id)) existing.push(id);
    lineToNodes.set(lineNum, existing);
  };

  const lines = source.split('\n');
  let i = 0;
  while (i < lines.length) {
    const lineNum = i + 1;
    const line = stripComment(lines[i]).trim();
    if (!line) {
      i++;
      continue;
    }

    if (/^type\s*:/i.test(line)) {
      i++;
      continue;
    }
    const titleMatch = line.match(/^title\s*:?\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/^["']|["']$/g, '').trim();
      i++;
      continue;
    }
    const dirMatch = line.match(/^direction\s+(\w+)$/);
    if (dirMatch) {
      const dir = dirMatch[1].toUpperCase();
      if (DIRECTIONS.has(dir as Direction)) direction = dir as Direction;
      i++;
      continue;
    }

    // Table declaration: "Name [attrs] {" or "Name {"
    const tableOpen = line.match(/^([A-Za-z_][\w]*)\s*(?:\[([^\]]+)\])?\s*\{$/);
    if (tableOpen) {
      const id = tableOpen[1];
      const attrPart = tableOpen[2];
      const table: ErTable = {
        id,
        label: id,
        columns: [],
        sourceLine: lineNum,
      };
      if (attrPart) {
        const attrs = parseAttrs(attrPart, lineNum, errors);
        if (attrs.label) table.label = attrs.label;
        if (attrs.color) table.color = attrs.color;
        if (attrs.icon) table.icon = attrs.icon;
      }
      // Consume columns until closing brace
      i++;
      while (i < lines.length) {
        const colLineNum = i + 1;
        const colLine = stripComment(lines[i]).trim();
        if (!colLine) {
          i++;
          continue;
        }
        if (colLine === '}') {
          i++;
          break;
        }
        // Format: "col_name type [pk|fk|pk fk]"
        const colMatch = colLine.match(
          /^([A-Za-z_][\w]*)\s+([A-Za-z_][\w()]*)\s*(.*)$/,
        );
        if (colMatch) {
          const [, name, colType, rest] = colMatch;
          const tokens = rest.split(/\s+/).filter(Boolean).map((t) => t.toLowerCase());
          const column: ErColumn = {
            name,
            type: colType,
            isPk: tokens.includes('pk'),
            isFk: tokens.includes('fk'),
          };
          table.columns.push(column);
        } else {
          errors.push({
            line: colLineNum,
            message: `Columna invalida: ${colLine}`,
          });
        }
        i++;
      }
      tables.set(id, table);
      recordLine(lineNum, [id]);
      continue;
    }

    // Relation: "A.col > B.col" or "A > B" with cardinality syntax
    // Support: "A.col > B.col" (one-to-many implied)
    //          "A.col <> B.col" (many-to-many)
    //          "A.col -- B.col" (one-to-one)
    const arrow = findArrowOperator(line);
    if (arrow) {
      const sourcesStr = line.slice(0, arrow.idx).trim();
      const targetsStr = line.slice(arrow.idx + arrow.len).trim();

      const fromMatch = sourcesStr.match(/^([A-Za-z_][\w]*)(?:\.([A-Za-z_][\w]*))?$/);
      const toMatch = targetsStr.match(/^([A-Za-z_][\w]*)(?:\.([A-Za-z_][\w]*))?$/);
      if (!fromMatch || !toMatch) {
        errors.push({
          line: lineNum,
          message: 'Relacion requiere TableA[.col] OP TableB[.col]',
        });
        i++;
        continue;
      }
      const cardinality:
        | 'one-to-one'
        | 'one-to-many'
        | 'many-to-many'
        | undefined =
        arrow.type === 'directed'
          ? 'one-to-many'
          : arrow.type === 'bidirectional'
            ? 'many-to-many'
            : 'one-to-one';
      const rel: ErRelation = {
        fromTable: fromMatch[1],
        toTable: toMatch[1],
        sourceLine: lineNum,
        cardinality,
      };
      if (fromMatch[2]) rel.fromColumn = fromMatch[2];
      if (toMatch[2]) rel.toColumn = toMatch[2];
      relations.push(rel);
      recordLine(lineNum, [fromMatch[1], toMatch[1]]);
      i++;
      continue;
    }

    i++;
  }

  const ast: ErAST = {
    type: 'er',
    direction,
    tables: Array.from(tables.values()),
    relations,
  };
  if (title) ast.title = title;
  return { ast, errors, sourceMap: { lineToNodes } };
}
