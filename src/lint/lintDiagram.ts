import type { FlowchartAST } from '../parser/types';

export type LintLevel = 'error' | 'warn' | 'info';
export type LintIssue = { level: LintLevel; message: string; nodeId?: string };

// Linter de diagrama: chequeos deterministas de completitud/consistencia para
// el loop con Claude Code. No es exhaustivo; busca los gaps mas comunes.
export function lintDiagram(ast: FlowchartAST): LintIssue[] {
  const issues: LintIssue[] = [];
  const ids = new Set(ast.nodes.map((n) => n.id));

  // Edges a nodos inexistentes (raro, pero posible al editar a mano).
  for (const e of ast.edges) {
    if (!ids.has(e.from)) issues.push({ level: 'error', message: `edge desde nodo inexistente "${e.from}"` });
    if (!ids.has(e.to)) issues.push({ level: 'error', message: `edge hacia nodo inexistente "${e.to}"` });
  }

  // Nodos aislados (sin ninguna conexion) — salvo que el diagrama tenga 1 solo nodo.
  if (ast.nodes.length > 1) {
    const connected = new Set<string>();
    for (const e of ast.edges) {
      connected.add(e.from);
      connected.add(e.to);
    }
    for (const n of ast.nodes) {
      if (!connected.has(n.id)) {
        issues.push({ level: 'warn', message: `nodo aislado (sin conexiones)`, nodeId: n.id });
      }
    }
  }

  // Nodos sin label descriptivo (el label cae al id).
  for (const n of ast.nodes) {
    if (!n.label || n.label === n.id) {
      issues.push({ level: 'info', message: `sin label descriptivo`, nodeId: n.id });
    }
  }

  // Nodos bloqueados — necesitan atencion.
  for (const n of ast.nodes) {
    if (n.status === 'blocked') {
      issues.push({ level: 'warn', message: `bloqueado (status: blocked)`, nodeId: n.id });
    }
  }

  // Feature marcada done pero sin archivos de test vinculados (test-first).
  for (const n of ast.nodes) {
    const isFeature = (n.labels ?? []).includes('feature');
    if (isFeature && n.status === 'done' && (!n.tests || n.tests.length === 0)) {
      issues.push({ level: 'warn', message: `feature done sin tests vinculados`, nodeId: n.id });
    }
  }

  // Goals sin ninguna feature en el diagrama.
  const hasLabel = (key: string) => ast.nodes.some((n) => (n.labels ?? []).includes(key));
  if (hasLabel('goal') && !hasLabel('feature')) {
    issues.push({ level: 'warn', message: 'hay goals pero ninguna feature que los cubra' });
  }

  // Ciclos en el grafo dirigido (informativo).
  if (hasCycle(ast)) {
    issues.push({ level: 'info', message: 'el grafo dirigido tiene al menos un ciclo' });
  }

  return issues;
}

function hasCycle(ast: FlowchartAST): boolean {
  const adj = new Map<string, string[]>();
  for (const n of ast.nodes) adj.set(n.id, []);
  for (const e of ast.edges) {
    if (e.arrow === 'undirected') continue;
    adj.get(e.from)?.push(e.to);
  }
  const state = new Map<string, 0 | 1 | 2>(); // 0 sin visitar, 1 en pila, 2 listo
  const dfs = (id: string): boolean => {
    state.set(id, 1);
    for (const nx of adj.get(id) ?? []) {
      const s = state.get(nx) ?? 0;
      if (s === 1) return true;
      if (s === 0 && dfs(nx)) return true;
    }
    state.set(id, 2);
    return false;
  };
  for (const n of ast.nodes) {
    if ((state.get(n.id) ?? 0) === 0 && dfs(n.id)) return true;
  }
  return false;
}
