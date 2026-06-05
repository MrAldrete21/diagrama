import {
  appendEdge,
  appendNode,
  removeNodeFromSource,
  updateNodeAttrInPlace,
  updateNodeLabelInPlace,
} from '../source/edit';
import { parse } from '../parser/parse';
import { SHAPES } from '../parser/types';
import type { Shape } from '../parser/types';
import type { SolverActions } from './client';

const SHAPE_SET = new Set<string>(SHAPES);

export type ApplyResult = {
  source: string;
  applied: number;
  skipped: Array<{ kind: string; reason: string }>;
  newIds: string[];
};

/**
 * Applies a batch of solver actions to a source DSL string. Each step
 * re-parses to keep ids and source lines coherent. Invalid actions are
 * skipped, not thrown.
 */
export function applyActions(source: string, actions: SolverActions): ApplyResult {
  let cur = source;
  let applied = 0;
  const skipped: ApplyResult['skipped'] = [];
  const newIds: string[] = [];

  // 1. add_nodes
  for (const a of actions.add_nodes ?? []) {
    if (!a.id || !a.label) {
      skipped.push({ kind: 'add_node', reason: 'missing id or label' });
      continue;
    }
    const parsed = parse(cur);
    if (parsed.ast.type !== 'flowchart') {
      skipped.push({ kind: 'add_node', reason: 'not a flowchart' });
      continue;
    }
    if (parsed.ast.nodes.some((n) => n.id === a.id)) {
      skipped.push({ kind: 'add_node', reason: `id ${a.id} already exists` });
      continue;
    }
    const shape: Shape =
      a.shape && SHAPE_SET.has(a.shape) ? (a.shape as Shape) : 'rectangle';
    cur = appendNode(cur, a.id, shape);
    // label override (since appendNode uses id as default label)
    if (a.label !== a.id) {
      const reparsed = parse(cur);
      if (reparsed.ast.type === 'flowchart') {
        const node = reparsed.ast.nodes.find((n) => n.id === a.id);
        if (node)
          cur = updateNodeLabelInPlace(cur, a.id, node.sourceLine, a.label);
      }
    }
    if (a.labels && a.labels.length > 0) {
      const reparsed = parse(cur);
      if (reparsed.ast.type === 'flowchart') {
        const node = reparsed.ast.nodes.find((n) => n.id === a.id);
        if (node)
          cur = updateNodeAttrInPlace(
            cur,
            a.id,
            node.sourceLine,
            'labels',
            a.labels.join('; '),
          );
      }
    }
    newIds.push(a.id);
    applied++;
  }

  // 2. add_edges
  for (const e of actions.add_edges ?? []) {
    if (!e.from || !e.to) {
      skipped.push({ kind: 'add_edge', reason: 'missing from/to' });
      continue;
    }
    const parsed = parse(cur);
    if (parsed.ast.type !== 'flowchart') {
      skipped.push({ kind: 'add_edge', reason: 'not a flowchart' });
      continue;
    }
    const ids = new Set(parsed.ast.nodes.map((n) => n.id));
    if (!ids.has(e.from) || !ids.has(e.to)) {
      skipped.push({ kind: 'add_edge', reason: `${e.from} -> ${e.to} references unknown id` });
      continue;
    }
    cur = appendEdge(cur, e.from, e.to);
    applied++;
  }

  // 3. edit_nodes
  for (const ed of actions.edit_nodes ?? []) {
    if (!ed.id) {
      skipped.push({ kind: 'edit_node', reason: 'missing id' });
      continue;
    }
    const parsed = parse(cur);
    if (parsed.ast.type !== 'flowchart') {
      skipped.push({ kind: 'edit_node', reason: 'not a flowchart' });
      continue;
    }
    const node = parsed.ast.nodes.find((n) => n.id === ed.id);
    if (!node) {
      skipped.push({ kind: 'edit_node', reason: `id ${ed.id} not found` });
      continue;
    }
    if (ed.label !== undefined && ed.label !== node.label) {
      cur = updateNodeLabelInPlace(cur, ed.id, node.sourceLine, ed.label);
    }
    if (ed.shape && SHAPE_SET.has(ed.shape) && ed.shape !== node.shape) {
      cur = updateNodeAttrInPlace(cur, ed.id, node.sourceLine, 'shape', ed.shape);
    }
    applied++;
  }

  // 4. annotate
  for (const an of actions.annotate ?? []) {
    if (!an.id || !an.labels || an.labels.length === 0) {
      skipped.push({ kind: 'annotate', reason: 'missing id or labels' });
      continue;
    }
    const parsed = parse(cur);
    if (parsed.ast.type !== 'flowchart') {
      skipped.push({ kind: 'annotate', reason: 'not a flowchart' });
      continue;
    }
    const node = parsed.ast.nodes.find((n) => n.id === an.id);
    if (!node) {
      skipped.push({ kind: 'annotate', reason: `id ${an.id} not found` });
      continue;
    }
    const existing = node.labels ?? [];
    const merged = Array.from(new Set([...existing, ...an.labels]));
    cur = updateNodeAttrInPlace(
      cur,
      an.id,
      node.sourceLine,
      'labels',
      merged.join('; '),
    );
    applied++;
  }

  // 5. delete_nodes
  for (const id of actions.delete_nodes ?? []) {
    if (!id) continue;
    cur = removeNodeFromSource(cur, id);
    applied++;
  }

  return { source: cur, applied, skipped, newIds };
}
