import type { Shape, FlowchartAST, ArrowType } from '../parser/types';
import { findArrowOperator, indexOfOutsideBrackets, splitOutsideBrackets } from '../parser/common';

export function nextNodeId(existingIds: ReadonlySet<string>): string {
  let n = 1;
  while (existingIds.has(`Node${n}`)) n++;
  return `Node${n}`;
}

export function appendNode(
  source: string,
  id: string,
  shape: Shape,
): string {
  const decl = shape === 'rectangle' ? id : `${id} [shape: ${shape}]`;
  return ensureTrailingNewline(stripTrailingBlank(source)) + decl + '\n';
}

export function appendEdge(
  source: string,
  from: string,
  to: string,
  opts?: { label?: string; conditional?: boolean },
): string {
  let line = `${from} > ${to}`;
  // El label se sanea de corchetes para no romper la seccion de attrs.
  const label = opts?.label?.replace(/[[\]]/g, ' ').trim();
  const attrs: string[] = [];
  if (opts?.conditional) attrs.push('conditional: true');
  if (label) {
    line += `: ${label}`;
    if (attrs.length > 0) line += ` [${attrs.join(', ')}]`;
  } else if (attrs.length > 0) {
    line += `: [${attrs.join(', ')}]`;
  }
  return ensureTrailingNewline(stripTrailingBlank(source)) + line + '\n';
}

export function appendLabelOverride(
  source: string,
  id: string,
  label: string,
): string {
  return (
    ensureTrailingNewline(stripTrailingBlank(source)) +
    `${id} [label: ${escapeLabel(label)}]\n`
  );
}

export function updateNodeLabelInPlace(
  source: string,
  id: string,
  sourceLine: number,
  newLabel: string,
): string {
  return updateNodeAttrInPlace(source, id, sourceLine, 'label', escapeLabel(newLabel));
}

/**
 * Set or update a single attribute on a node. If the node has a pure declaration
 * line (e.g. "Foo [attrs]"), edit that line in place. Otherwise append an
 * override line.
 */
export function updateNodeAttrInPlace(
  source: string,
  id: string,
  sourceLine: number,
  key: string,
  value: string,
): string {
  const lines = source.split('\n');
  if (sourceLine < 1 || sourceLine > lines.length) {
    return appendAttrOverride(source, id, key, value);
  }
  const idx = sourceLine - 1;
  const original = lines[idx];
  const indent = original.match(/^\s*/)?.[0] ?? '';
  const trimmed = original.trim();

  const pure = trimmed.match(/^([^\s[]+)(?:\s*\[([^\]]+)\])?$/);
  if (pure && pure[1] === id) {
    const attrs = pure[2];
    const nextAttrs = setOrAddAttr(attrs, key, value);
    lines[idx] = `${indent}${id} [${nextAttrs}]`;
    return lines.join('\n');
  }

  return appendAttrOverride(source, id, key, value);
}

/**
 * Remove an attribute from a node. Edits the source line if it's a pure
 * declaration. If the attribute does not exist, returns source unchanged.
 */
export function removeNodeAttrInPlace(
  source: string,
  id: string,
  sourceLine: number,
  key: string,
): string {
  const lines = source.split('\n');
  if (sourceLine < 1 || sourceLine > lines.length) return source;
  const idx = sourceLine - 1;
  const original = lines[idx];
  const indent = original.match(/^\s*/)?.[0] ?? '';
  const trimmed = original.trim();
  const pure = trimmed.match(/^([^\s[]+)(?:\s*\[([^\]]+)\])?$/);
  if (!pure || pure[1] !== id) return source;
  const attrs = pure[2];
  if (!attrs) return source;
  const nextAttrs = removeAttr(attrs, key);
  if (nextAttrs === null) {
    lines[idx] = `${indent}${id}`;
  } else {
    lines[idx] = `${indent}${id} [${nextAttrs}]`;
  }
  return lines.join('\n');
}

/**
 * Set (or clear) the list of constraint-node ids applied to a node. Stored as
 * the `constraints` attr (ids separated by `;`). Empty list removes the attr.
 */
export function setNodeConstraints(
  source: string,
  id: string,
  sourceLine: number,
  ids: string[],
): string {
  if (ids.length === 0) {
    return removeNodeAttrInPlace(source, id, sourceLine, 'constraints');
  }
  return updateNodeAttrInPlace(source, id, sourceLine, 'constraints', ids.join('; '));
}

function appendAttrOverride(
  source: string,
  id: string,
  key: string,
  value: string,
): string {
  return (
    ensureTrailingNewline(stripTrailingBlank(source)) +
    `${id} [${key}: ${value}]\n`
  );
}

/**
 * Remove a node from the source. Removes pure declaration lines for this node
 * and any edge lines that reference it.
 */
export function removeNodeFromSource(source: string, id: string): string {
  const lines = source.split('\n');
  const idRe = new RegExp(`\\b${escapeRegex(id)}\\b`);
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push(line);
      continue;
    }
    const codePart = trimmed.includes('//') ? trimmed.slice(0, trimmed.indexOf('//')) : trimmed;
    if (!idRe.test(codePart)) {
      result.push(line);
      continue;
    }
    const pure = codePart.match(/^([^\s[]+)(?:\s*\[[^\]]+\])?$/);
    if (pure && pure[1] === id) continue;
    if (/<>|>|--/.test(codePart) && idRe.test(codePart)) continue;
    result.push(line);
  }
  return result.join('\n');
}

/**
 * Remove a single (from -> to) edge from a multi-edge line. Handles the
 * Cartesian case `A, B > C, D` by rewriting the line as the surviving edges.
 * If only one edge remains, keeps it on a single line; if none, removes line.
 */
export function removeEdgeFromSource(
  source: string,
  fromId: string,
  toId: string,
  sourceLine: number,
): string {
  const lines = source.split('\n');
  if (sourceLine < 1 || sourceLine > lines.length) return source;
  const idx = sourceLine - 1;
  const original = lines[idx];
  const indent = original.match(/^\s*/)?.[0] ?? '';
  const trimmed = original.trim();
  if (!trimmed) return source;

  const commentIdx = trimmed.indexOf('//');
  const codePart = commentIdx === -1 ? trimmed : trimmed.slice(0, commentIdx).trim();
  const commentSuffix = commentIdx === -1 ? '' : '  ' + trimmed.slice(commentIdx);

  const arrow = findArrowOperator(codePart);
  if (!arrow) return source;

  const colonIdx = indexOfOutsideBrackets(codePart, ':');
  const edgePart = colonIdx === -1 ? codePart : codePart.slice(0, colonIdx);
  const labelPart = colonIdx === -1 ? '' : codePart.slice(colonIdx);

  const arrowInEdge = findArrowOperator(edgePart);
  if (!arrowInEdge) return source;
  const sourcesStr = edgePart.slice(0, arrowInEdge.idx);
  const targetsStr = edgePart.slice(arrowInEdge.idx + arrowInEdge.len);
  const sourceEntries = splitOutsideBrackets(sourcesStr, ',')
    .map((s) => s.trim())
    .filter(Boolean);
  const targetEntries = splitOutsideBrackets(targetsStr, ',')
    .map((s) => s.trim())
    .filter(Boolean);

  const idOf = (entry: string): string | null =>
    entry.match(/^([A-Za-z_][\w]*)/)?.[1] ?? null;

  const op =
    arrow.type === 'bidirectional' ? '<>' : arrow.type === 'undirected' ? '--' : '>';

  const remaining: string[] = [];
  for (const s of sourceEntries) {
    for (const t of targetEntries) {
      if (idOf(s) === fromId && idOf(t) === toId) continue;
      remaining.push(`${s} ${op} ${t}${labelPart}`);
    }
  }

  if (remaining.length === 0) {
    lines.splice(idx, 1);
    return lines.join('\n');
  }

  if (remaining.length === 1) {
    lines[idx] = `${indent}${remaining[0]}${commentSuffix}`;
    return lines.join('\n');
  }

  const replacement = remaining.map((r) => `${indent}${r}`).join('\n');
  lines[idx] = replacement + (commentSuffix ? '\n' + indent + commentSuffix.trim() : '');
  return lines.join('\n');
}

/**
 * Build a snippet for the given selected node ids. Synthesizes a clean
 * declaration for each selected node (independent of how it appears in the
 * original source — could be declared on an edge line) and includes any edge
 * whose BOTH endpoints are in the selection. The snippet starts with a marker
 * comment for round-trip detection.
 */
export function buildCopySnippet(
  ast: FlowchartAST,
  ids: ReadonlySet<string>,
): string {
  if (ids.size === 0) return '';
  const out: string[] = [];

  for (const node of ast.nodes) {
    if (!ids.has(node.id)) continue;
    const attrs: string[] = [];
    if (node.label && node.label !== node.id) attrs.push(`label: ${node.label}`);
    if (node.shape && node.shape !== 'rectangle') attrs.push(`shape: ${node.shape}`);
    if (node.color) attrs.push(`color: ${node.color}`);
    if (node.textColor) attrs.push(`textColor: ${node.textColor}`);
    if (node.strokeColor) attrs.push(`strokeColor: ${node.strokeColor}`);
    if (node.strokeWidth !== undefined)
      attrs.push(`strokeWidth: ${node.strokeWidth}`);
    if (node.icon) attrs.push(`icon: ${node.icon}`);
    if (node.width !== undefined) attrs.push(`width: ${node.width}`);
    if (node.height !== undefined) attrs.push(`height: ${node.height}`);
    out.push(attrs.length === 0 ? node.id : `${node.id} [${attrs.join(', ')}]`);
  }

  for (const edge of ast.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    const op =
      edge.arrow === 'bidirectional'
        ? '<>'
        : edge.arrow === 'undirected'
          ? '--'
          : '>';
    let line = `${edge.from} ${op} ${edge.to}`;
    const eattrs: string[] = [];
    if (edge.style) eattrs.push(`style: ${edge.style}`);
    if (edge.color) eattrs.push(`color: ${edge.color}`);
    if (edge.conditional) eattrs.push('conditional: true');
    if (edge.label) {
      line += `: ${edge.label}`;
      if (eattrs.length > 0) line += ` [${eattrs.join(', ')}]`;
    } else if (eattrs.length > 0) {
      line += `: [${eattrs.join(', ')}]`;
    }
    out.push(line);
  }

  return out.join('\n') + '\n';
}

/**
 * Take a snippet (DSL text) and rename node IDs so they don't collide with
 * the given set. Returns the renamed snippet and the new ID set.
 */
export function renameSnippetIds(
  snippet: string,
  existingIds: ReadonlySet<string>,
): { text: string; newIds: string[]; map: Record<string, string> } {
  const lines = snippet.split('\n');
  const declaredIds = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    if (/<>|>|--/.test(trimmed)) {
      for (const id of extractIdsFromEdgeLine(trimmed)) declaredIds.add(id);
      continue;
    }
    const pure = trimmed.match(/^([^\s[]+)(?:\s*\[[^\]]+\])?$/);
    if (pure) declaredIds.add(pure[1]);
  }

  const map: Record<string, string> = {};
  const taken = new Set(existingIds);
  for (const id of declaredIds) {
    let n = 1;
    let candidate = `${id}_${n}`;
    while (taken.has(candidate)) {
      n++;
      candidate = `${id}_${n}`;
    }
    map[id] = candidate;
    taken.add(candidate);
  }

  // Now rewrite snippet with renamed IDs. Replace whole-word matches.
  const rewritten = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return '';
      let out = line;
      for (const [from, to] of Object.entries(map)) {
        const re = new RegExp(`\\b${escapeRegex(from)}\\b`, 'g');
        out = out.replace(re, to);
      }
      return out;
    })
    .filter(Boolean)
    .join('\n');

  return { text: rewritten, newIds: Object.values(map), map };
}

export function appendSnippet(source: string, snippet: string): string {
  return ensureTrailingNewline(stripTrailingBlank(source)) + snippet.trim() + '\n';
}

function extractIdsFromEdgeLine(line: string): string[] {
  // Strip the label part after `:` (outside brackets)
  const noBrackets = line.replace(/\[[^\]]*\]/g, '');
  const colonIdx = noBrackets.indexOf(':');
  const edgePart = colonIdx === -1 ? noBrackets : noBrackets.slice(0, colonIdx);
  const sides = edgePart.split(/<>|--|>/);
  const ids: string[] = [];
  for (const side of sides) {
    for (const tok of side.split(',')) {
      const m = tok.trim().match(/^([A-Za-z_][\w]*)/);
      if (m) ids.push(m[1]);
    }
  }
  return ids;
}

function setOrAddAttr(
  current: string | undefined,
  key: string,
  value: string,
): string {
  if (!current) return `${key}: ${value}`;
  if (!current.includes(':')) {
    return `label: ${current.trim()}, ${key}: ${value}`;
  }
  const parts = current.split(',').map((p) => p.trim()).filter(Boolean);
  let found = false;
  const next = parts.map((part) => {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) return part;
    const k = part.slice(0, colonIdx).trim();
    if (k === key) {
      found = true;
      return `${key}: ${value}`;
    }
    return part;
  });
  if (!found) next.push(`${key}: ${value}`);
  return next.join(', ');
}

function removeAttr(current: string, key: string): string | null {
  if (!current.includes(':')) {
    // Legacy single-label: removing it leaves nothing
    if (key === 'label') return null;
    return current;
  }
  const parts = current
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const next = parts.filter((part) => {
    const idx = part.indexOf(':');
    if (idx === -1) return true;
    return part.slice(0, idx).trim() !== key;
  });
  if (next.length === 0) return null;
  return next.join(', ');
}

function escapeLabel(label: string): string {
  return label.replace(/[\],]/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripTrailingBlank(s: string): string {
  return s.replace(/[\n\s]+$/, '');
}

function ensureTrailingNewline(s: string): string {
  return s.length === 0 ? '' : s + '\n';
}

// ============================================================================
// EDGE editing
// ============================================================================

const ARROW_OP: Record<ArrowType, string> = {
  directed: '>',
  bidirectional: '<>',
  undirected: '--',
};

/**
 * Parse an edge line into its parts so we can mutate one piece without
 * touching the rest. Returns null for cartesian edges (multiple sources or
 * targets) — those require splitting and we keep it out of scope.
 */
type EdgeParts = {
  indent: string;
  sourcesStr: string;
  targetsStr: string;
  arrowOp: string;
  label: string;
  attrs: string;
  commentSuffix: string;
};

function parseEdgeLine(line: string): EdgeParts | null {
  const indent = line.match(/^\s*/)?.[0] ?? '';
  const trimmed = line.trim();
  if (!trimmed) return null;
  const commentIdx = trimmed.indexOf('//');
  const codePart = commentIdx === -1 ? trimmed : trimmed.slice(0, commentIdx).trim();
  const commentSuffix = commentIdx === -1 ? '' : '  ' + trimmed.slice(commentIdx);

  const colonIdx = indexOfOutsideBrackets(codePart, ':');
  const edgePart = colonIdx === -1 ? codePart : codePart.slice(0, colonIdx);
  const labelRaw = colonIdx === -1 ? '' : codePart.slice(colonIdx + 1);

  const arrow = findArrowOperator(edgePart);
  if (!arrow) return null;
  const sourcesStr = edgePart.slice(0, arrow.idx).trim();
  const targetsStr = edgePart.slice(arrow.idx + arrow.len).trim();
  // Skip cartesian
  if (sourcesStr.includes(',') || targetsStr.includes(',')) return null;

  let label = '';
  let attrs = '';
  if (labelRaw.trim()) {
    const m = labelRaw.trim().match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
    if (m) {
      label = m[1].trim();
      attrs = m[2];
    } else {
      label = labelRaw.trim();
    }
  }
  return {
    indent,
    sourcesStr,
    targetsStr,
    arrowOp: edgePart.slice(arrow.idx, arrow.idx + arrow.len),
    label,
    attrs,
    commentSuffix,
  };
}

function buildEdgeLine(p: EdgeParts): string {
  const labelSection =
    p.label || p.attrs
      ? `: ${p.label}${p.attrs ? ` [${p.attrs}]` : ''}`
      : '';
  return `${p.indent}${p.sourcesStr} ${p.arrowOp} ${p.targetsStr}${labelSection}${p.commentSuffix}`;
}

function setAttrInList(attrs: string, key: string, value: string): string {
  const parts = attrs ? splitOutsideBrackets(attrs, ',').map((s) => s.trim()).filter(Boolean) : [];
  const k = `${key}:`;
  const idx = parts.findIndex((p) => p.startsWith(k));
  if (idx >= 0) parts[idx] = `${key}: ${value}`;
  else parts.push(`${key}: ${value}`);
  return parts.join(', ');
}

function removeAttrInList(attrs: string, key: string): string {
  const parts = attrs ? splitOutsideBrackets(attrs, ',').map((s) => s.trim()).filter(Boolean) : [];
  const k = `${key}:`;
  return parts.filter((p) => !p.startsWith(k)).join(', ');
}

export function updateEdgeArrowInPlace(
  source: string,
  fromId: string,
  toId: string,
  sourceLine: number,
  arrow: ArrowType,
): string {
  const lines = source.split('\n');
  if (sourceLine < 1 || sourceLine > lines.length) return source;
  const idx = sourceLine - 1;
  const parts = parseEdgeLine(lines[idx]);
  if (!parts) return source;
  // Sanity: ensure this line is the edge we think it is
  if (!parts.sourcesStr.startsWith(fromId) || !parts.targetsStr.startsWith(toId)) return source;
  parts.arrowOp = ARROW_OP[arrow];
  lines[idx] = buildEdgeLine(parts);
  return lines.join('\n');
}

// Invierte el sentido de un edge simple (A > B  ->  B > A) conservando label y
// attrs. Devuelve el source sin cambios para edges cartesianos (varios origenes
// o destinos) o si la linea no matchea.
export function reverseEdgeInPlace(
  source: string,
  fromId: string,
  toId: string,
  sourceLine: number,
): string {
  const lines = source.split('\n');
  if (sourceLine < 1 || sourceLine > lines.length) return source;
  const idx = sourceLine - 1;
  const parts = parseEdgeLine(lines[idx]);
  if (!parts) return source;
  if (!parts.sourcesStr.startsWith(fromId) || !parts.targetsStr.startsWith(toId)) return source;
  const tmp = parts.sourcesStr;
  parts.sourcesStr = parts.targetsStr;
  parts.targetsStr = tmp;
  lines[idx] = buildEdgeLine(parts);
  return lines.join('\n');
}

export function updateEdgeAttrInPlace(
  source: string,
  fromId: string,
  toId: string,
  sourceLine: number,
  key: string,
  value: string,
): string {
  const lines = source.split('\n');
  if (sourceLine < 1 || sourceLine > lines.length) return source;
  const idx = sourceLine - 1;
  const parts = parseEdgeLine(lines[idx]);
  if (!parts) return source;
  if (!parts.sourcesStr.startsWith(fromId) || !parts.targetsStr.startsWith(toId)) return source;
  parts.attrs = setAttrInList(parts.attrs, key, value);
  lines[idx] = buildEdgeLine(parts);
  return lines.join('\n');
}

export function removeEdgeAttrInPlace(
  source: string,
  fromId: string,
  toId: string,
  sourceLine: number,
  key: string,
): string {
  const lines = source.split('\n');
  if (sourceLine < 1 || sourceLine > lines.length) return source;
  const idx = sourceLine - 1;
  const parts = parseEdgeLine(lines[idx]);
  if (!parts) return source;
  if (!parts.sourcesStr.startsWith(fromId) || !parts.targetsStr.startsWith(toId)) return source;
  parts.attrs = removeAttrInList(parts.attrs, key);
  lines[idx] = buildEdgeLine(parts);
  return lines.join('\n');
}
