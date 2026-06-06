// Genera un prompt de desarrollo (markdown) a partir de un flowchart.
// El diagrama ya codifica una spec semantica (labels, edges, grupos, iconos);
// esto la traduce a un texto listo para pegar en Claude Code.

import type { FlowchartAST, DiagramNode } from '../parser/types';
import { groupAst } from '../solver/groupAst';
import {
  resolveLabelDescription,
  labelDef,
  PRESET_LABEL_KEYS,
  type LabelPrompts,
} from '../renderer/labels';

// Infiere tecnologia/rol a partir del icono del nodo.
const TECH_BY_ICON: Record<string, string> = {
  database: 'base de datos',
  'aws-rds': 'base de datos (RDS)',
  server: 'servicio backend',
  'aws-ec2': 'servicio backend (EC2)',
  'aws-lambda': 'funcion serverless (Lambda)',
  'aws-s3': 'almacenamiento de objetos (S3)',
  api: 'API / endpoint',
  globe: 'cliente web / externo',
  lock: 'auth / seguridad',
  code: 'modulo de codigo',
  file: 'archivo / recurso',
  user: 'actor / usuario',
};

// Secciones semanticas derivadas de los labels del nodo, en orden canonico.
const LABEL_SECTIONS: Array<{ key: string; heading: string; checklist?: boolean }> = [
  { key: 'goal', heading: 'Objetivos' },
  { key: 'feature', heading: 'Features a construir' },
  { key: 'constraint', heading: 'Requisitos / constraints' },
  { key: 'input', heading: 'Inputs' },
  { key: 'output', heading: 'Outputs' },
  { key: 'decision', heading: 'Decisiones / branching' },
  { key: 'ai-decision', heading: 'Decisiones por IA (automaticas)' },
  { key: 'ai-decision-user', heading: 'Decisiones por IA (decision final del usuario)' },
  { key: 'risk', heading: 'Riesgos a manejar' },
  { key: 'question', heading: 'Preguntas abiertas (resolver antes de codear)' },
  { key: 'done', heading: 'Ya hecho (contexto fijo)' },
  { key: 'todo', heading: 'Tareas', checklist: true },
];

function displayName(n: DiagramNode): string {
  return n.label?.trim() || n.id;
}

function techHint(n: DiagramNode): string | null {
  if (!n.icon) return null;
  return TECH_BY_ICON[n.icon] ?? n.icon;
}

function indent(text: string, pad = '  '): string {
  return text
    .split('\n')
    .map((l) => pad + l)
    .join('\n');
}

function componentLine(n: DiagramNode, resolveName: (id: string) => string): string {
  const meta: string[] = [];
  const tech = techHint(n);
  if (tech) meta.push(tech);
  if (n.status) meta.push(`estado: ${n.status}`);
  if (n.request) meta.push('PEDIDO (implementar)');
  if (n.labels && n.labels.length > 0) meta.push(n.labels.join(', '));
  let line = `- **${displayName(n)}**`;
  if (meta.length > 0) line += ` — ${meta.join('; ')}`;
  if (n.items && n.items.length > 0) {
    line += '\n' + n.items.map((i) => `  - ${i}`).join('\n');
  }
  if (n.content) line += '\n' + indent(n.content.trim(), '  ');
  if (n.files && n.files.length > 0) {
    line += '\n' + `  - archivos: ${n.files.join('; ')}`;
  }
  if (n.tests && n.tests.length > 0) {
    line += '\n' + `  - tests: ${n.tests.join('; ')}`;
  }
  if (n.assets && n.assets.length > 0) {
    line += '\n' + `  - evidencia/avance: ${n.assets.join('; ')}`;
  }
  if (n.constraints && n.constraints.length > 0) {
    const names = n.constraints.map(resolveName).filter(Boolean);
    if (names.length > 0) line += '\n' + `  - constraints: ${names.join('; ')}`;
  }
  return line;
}

// Orden topologico (Kahn) sobre edges dirigidos. Los nodos en ciclo quedan aparte.
function topoOrder(ast: FlowchartAST): { order: string[]; cyclic: string[] } {
  const ids = ast.nodes.map((n) => n.id);
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of ast.edges) {
    if (e.arrow === 'undirected') continue;
    if (!indeg.has(e.from) || !indeg.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const queue = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const nx of adj.get(id) ?? []) {
      indeg.set(nx, (indeg.get(nx) ?? 0) - 1);
      if ((indeg.get(nx) ?? 0) === 0) queue.push(nx);
    }
  }
  const inOrder = new Set(order);
  const cyclic = ids.filter((id) => !inOrder.has(id));
  return { order, cyclic };
}

export function buildDevPrompt(
  ast: FlowchartAST,
  source: string,
  labelPrompts?: LabelPrompts,
  onlyIds?: ReadonlySet<string>,
): string {
  // byId con TODOS los nodos: resuelve nombres (edges, constraints) aunque el
  // nodo este oculto del prompt.
  const byId = new Map(ast.nodes.map((n) => [n.id, n]));
  const name = (id: string) => {
    const n = byId.get(id);
    return n ? displayName(n) : id;
  };

  // Nodos excluidos del prompt (attr noPrompt / tecla N) se filtran. Sus edges
  // tambien se omiten. El resto del prompt opera sobre `vis`.
  const visibleNodes = ast.nodes.filter(
    (n) => !n.promptHidden && (!onlyIds || onlyIds.has(n.id)),
  );
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const vis: FlowchartAST = {
    ...ast,
    nodes: visibleNodes,
    edges: ast.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to)),
  };
  // Resuelve un id de constraint a su texto; '' si el nodo ya no existe.
  const resolveConstraint = (id: string) => {
    const n = byId.get(id);
    return n ? displayName(n) : '';
  };
  const out: string[] = [];
  const title = ast.title?.trim() || 'la aplicacion';

  out.push(`# Construir: ${title}`);
  out.push('');
  out.push(
    'Spec de una app derivada de un diagrama. Construila respetando la arquitectura, ' +
      'el flujo de datos y los constraints. Detalles abajo.',
  );
  out.push('');

  // Arquitectura: grupos + nodos
  out.push('## Arquitectura');
  if (vis.groups.length > 0) {
    for (const g of vis.groups) {
      const members = vis.nodes.filter((n) => n.groupId === g.id);
      if (members.length === 0) continue;
      out.push('');
      out.push(`### Modulo: ${g.label || g.id}`);
      for (const n of members) out.push(componentLine(n, resolveConstraint));
    }
    const orphans = vis.nodes.filter((n) => !n.groupId);
    if (orphans.length > 0) {
      out.push('');
      out.push('### Sin modulo');
      for (const n of orphans) out.push(componentLine(n, resolveConstraint));
    }
  } else {
    for (const n of vis.nodes) out.push(componentLine(n, resolveConstraint));
  }
  out.push('');

  // Flujo de datos
  if (vis.edges.length > 0) {
    out.push('## Flujo de datos / dependencias');
    for (const e of vis.edges) {
      const sym = e.conditional
        ? '?>'
        : e.arrow === 'bidirectional'
          ? '<->'
          : e.arrow === 'undirected'
            ? '--'
            : '->';
      const lbl = e.label ? `: ${e.label}` : '';
      const note = e.conditional ? ' (condicional: solo transiciona al cumplirse)' : '';
      out.push(`- ${name(e.from)} ${sym} ${name(e.to)}${lbl}${note}`);
    }
    out.push('');
  }

  // Secciones semanticas por label
  const grouped = groupAst(vis);
  const sectionKeys = new Set(LABEL_SECTIONS.map((s) => s.key));
  for (const sec of LABEL_SECTIONS) {
    const nodes = grouped.byLabel[sec.key];
    if (!nodes || nodes.length === 0) continue;
    out.push(`## ${sec.heading}`);
    // Semantica de la label (editable desde el menu de labels). Se refleja para
    // todos los nodos que la llevan.
    const desc = resolveLabelDescription(sec.key, labelPrompts);
    if (desc) out.push(`> ${desc}`);
    for (const n of nodes) {
      const bullet = sec.checklist ? '- [ ]' : '-';
      out.push(`${bullet} ${n.label || n.id}`);
      if (n.attrs.content) out.push(indent(n.attrs.content.trim(), '  '));
      if (n.attrs.items && n.attrs.items.length > 0) {
        for (const it of n.attrs.items) out.push(`  - ${it}`);
      }
    }
    out.push('');
  }

  // Otras labels: cualquier label usada por un nodo visible que NO tenga seccion
  // propia (idea, blocked, custom...). Garantiza que la semantica de TODA label
  // se refleje en el prompt, con su override si fue editada desde el menu.
  const otherKeys = Object.keys(grouped.byLabel).filter((k) => !sectionKeys.has(k));
  if (otherKeys.length > 0) {
    // Orden canonico: presets primero, luego custom alfabetico.
    const presetOrder = PRESET_LABEL_KEYS.map((k) => k.toLowerCase());
    otherKeys.sort((a, b) => {
      const ia = presetOrder.indexOf(a);
      const ib = presetOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    out.push('## Otras labels (semantica)');
    for (const k of otherKeys) {
      const nodes = grouped.byLabel[k];
      const desc = resolveLabelDescription(k, labelPrompts);
      const names = nodes.map((n) => n.label || n.id).join(', ');
      out.push(`- **${labelDef(k).display}**: ${desc} — ${names}`);
    }
    out.push('');
  }

  // Orden de build sugerido
  if (vis.edges.length > 0) {
    const { order, cyclic } = topoOrder(vis);
    if (order.length > 0) {
      out.push('## Orden de build sugerido (por dependencias)');
      order.forEach((id, i) => out.push(`${i + 1}. ${name(id)}`));
      if (cyclic.length > 0) {
        out.push(`- (ciclo, resolver manualmente: ${cyclic.map(name).join(', ')})`);
      }
      out.push('');
    }
  }

  // DSL fuente verbatim
  out.push('## Diagrama (DSL fuente)');
  out.push('```');
  out.push(source.trim());
  out.push('```');
  out.push('');

  // Instrucciones de cierre
  out.push('## Instrucciones');
  out.push('- Resolve primero las "Preguntas abiertas" si las hay.');
  out.push('- Scaffold el proyecto y luego implementa los componentes en el orden de build sugerido.');
  out.push('- Cada edge del flujo de datos es una dependencia o llamada: implementala explicitamente.');
  out.push('- Respeta los constraints y mitiga los riesgos listados.');
  out.push('- No agregues features fuera de las listadas sin avisar.');

  return out.join('\n');
}
