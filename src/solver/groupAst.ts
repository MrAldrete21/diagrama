import type { FlowchartAST, DiagramNode, DiagramEdge } from '../parser/types';

export type GroupedNode = {
  id: string;
  label: string;
  shape: string;
  labels: string[];
  /** Compact attrs to give the LLM: only things that affect semantics. */
  attrs: {
    icon?: string;
    quantity?: number;
    progress?: boolean;
    items?: string[];
    content?: string;
  };
};

export type GroupedEdge = {
  from: string;
  to: string;
  label?: string;
};

export type Grouped = {
  /** Map from label key (lowercased) → nodes carrying that label. */
  byLabel: Record<string, GroupedNode[]>;
  /** Nodes without any label. */
  untagged: GroupedNode[];
  edges: GroupedEdge[];
};

function compactNode(n: DiagramNode): GroupedNode {
  const attrs: GroupedNode['attrs'] = {};
  if (n.icon) attrs.icon = n.icon;
  if (n.quantity !== undefined) attrs.quantity = n.quantity;
  if (n.progress !== undefined) attrs.progress = n.progress;
  if (n.items && n.items.length > 0) attrs.items = n.items;
  if (n.content) attrs.content = n.content;
  return {
    id: n.id,
    label: n.label,
    shape: n.shape,
    labels: n.labels ?? [],
    attrs,
  };
}

function compactEdge(e: DiagramEdge): GroupedEdge {
  const out: GroupedEdge = { from: e.from, to: e.to };
  if (e.label) out.label = e.label;
  return out;
}

export function groupAst(ast: FlowchartAST): Grouped {
  const byLabel: Record<string, GroupedNode[]> = {};
  const untagged: GroupedNode[] = [];

  for (const n of ast.nodes) {
    const compact = compactNode(n);
    if (compact.labels.length === 0) {
      untagged.push(compact);
      continue;
    }
    for (const l of compact.labels) {
      const key = l.toLowerCase();
      if (!byLabel[key]) byLabel[key] = [];
      byLabel[key].push(compact);
    }
  }

  const edges = ast.edges.map(compactEdge);
  return { byLabel, untagged, edges };
}
