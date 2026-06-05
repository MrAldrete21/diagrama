import { parse } from '../parser/parse';

// Snapshots con nombre del diagrama (versiones "v1 MVP", "v2"...) para comparar
// como fue creciendo. Se guardan globales en localStorage (independiente de las
// pestanias). El diff alimenta el prompt incremental (que se agrego/quito).

const KEY = 'diagrama:snapshots';

export type Snapshot = { id: string; name: string; source: string; ts: number };

function read(): Snapshot[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Snapshot[]) : [];
  } catch {
    return [];
  }
}

function write(list: Snapshot[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listSnapshots(): Snapshot[] {
  return read().sort((a, b) => b.ts - a.ts);
}

export function saveSnapshot(name: string, source: string): Snapshot {
  const list = read();
  const snap: Snapshot = {
    id: `s${Date.now().toString(36)}${list.length.toString(36)}`,
    name: name.trim() || `v${list.length + 1}`,
    source,
    ts: Date.now(),
  };
  write([...list, snap]);
  return snap;
}

export function removeSnapshot(id: string): void {
  write(read().filter((s) => s.id !== id));
}

export type DiagramDiff = {
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
};

function setsOf(src: string): { nodes: Set<string>; edges: Set<string> } {
  const r = parse(src);
  const nodes = new Set<string>();
  const edges = new Set<string>();
  if (r.ast.type === 'flowchart') {
    for (const n of r.ast.nodes) nodes.add(n.id);
    for (const e of r.ast.edges) edges.add(`${e.from}>${e.to}`);
  }
  return { nodes, edges };
}

// Diff de `from` -> `to`: que se agrego / quito al pasar de from a to.
export function diffSources(from: string, to: string): DiagramDiff {
  const a = setsOf(from);
  const b = setsOf(to);
  const diff = (x: Set<string>, y: Set<string>) => [...y].filter((v) => !x.has(v));
  return {
    addedNodes: diff(a.nodes, b.nodes),
    removedNodes: diff(b.nodes, a.nodes),
    addedEdges: diff(a.edges, b.edges),
    removedEdges: diff(b.edges, a.edges),
  };
}
