import type { Grouped, GroupedNode } from './groupAst';
import {
  PRESET_LABELS,
  PRESET_LABEL_KEYS,
  resolveLabelDescription,
  type LabelPrompts,
} from '../renderer/labels';
import { SHAPES } from '../parser/types';

export type TaskType = 'expand' | 'critique' | 'plan' | 'simplify' | 'test' | 'custom';

export const TASKS: Array<{ key: TaskType; display: string; desc: string }> = [
  { key: 'expand', display: 'Expand', desc: 'Sugerir nuevos nodos / features que cubran los Goals respetando Constraints' },
  { key: 'critique', display: 'Critique', desc: 'Detectar contradicciones, riesgos no mitigados, gaps' },
  { key: 'plan', display: 'Plan', desc: 'Convertir Goals + Features en una secuencia de Todos en orden' },
  { key: 'simplify', display: 'Simplify', desc: 'Identificar nodos redundantes y proponer fusionarlos o eliminarlos' },
  { key: 'test', display: 'Test', desc: 'Generar Test cases para cada Feature considerando Risks' },
  { key: 'custom', display: 'Custom', desc: 'Tu instruccion libre' },
];

export function buildSystemPrompt(labelPrompts?: LabelPrompts): string {
  const ontology = PRESET_LABELS
    .map((l) => `- ${l.key}: ${resolveLabelDescription(l.key, labelPrompts)}`)
    .join('\n');
  return [
    'You are a structured reasoning assistant operating on a labeled diagram.',
    'The diagram is a directed graph. Each node has zero or more semantic labels.',
    '',
    'LABEL ONTOLOGY:',
    ontology,
    '',
    'You receive the current diagram state grouped by label, plus all edges.',
    'Your job is to produce a set of structured ACTIONS that mutate the diagram',
    'to satisfy the user task. You must call the apply_diagram_changes tool',
    'exactly once with a JSON payload conforming to its schema. Do not produce',
    'free-form prose outside the tool call.',
    '',
    'RULES:',
    '- Prefer adding small, well-labeled nodes over editing existing ones.',
    '- New node ids: short (Node5, Node6, ...) avoiding collision with existing.',
    '- When connecting new nodes to existing ones, use add_edge with valid ids.',
    '- Annotate adds labels to an existing node (never overwrites others).',
    '- Warn (not abort) on missing Goals, contradictions, or ambiguity.',
    '- Be terse: brief rationale, only necessary actions.',
  ].join('\n');
}

export function buildUserPrompt(
  grouped: Grouped,
  taskType: TaskType,
  userInstruction: string,
  existingIds: string[],
): string {
  const sections: string[] = [];
  const task = TASKS.find((t) => t.key === taskType);
  sections.push(`TASK: ${task?.display ?? 'custom'} — ${task?.desc ?? ''}`);
  if (userInstruction.trim()) {
    sections.push(`USER INSTRUCTION:\n${userInstruction.trim()}`);
  }
  sections.push('');
  sections.push('CURRENT DIAGRAM:');

  // Render byLabel in canonical order for prompt cache stability.
  for (const labelKey of PRESET_LABEL_KEYS) {
    const nodes = grouped.byLabel[labelKey.toLowerCase()];
    if (!nodes || nodes.length === 0) continue;
    sections.push(`\n${labelKey.toUpperCase()}:`);
    for (const n of nodes) {
      sections.push(formatNode(n));
    }
  }

  // Custom (non-preset) labels
  const customKeys = Object.keys(grouped.byLabel).filter(
    (k) => !PRESET_LABEL_KEYS.map((s) => s.toLowerCase()).includes(k),
  );
  for (const k of customKeys) {
    sections.push(`\n${k.toUpperCase()} (custom):`);
    for (const n of grouped.byLabel[k]) sections.push(formatNode(n));
  }

  if (grouped.untagged.length > 0) {
    sections.push('\nUNTAGGED:');
    for (const n of grouped.untagged) sections.push(formatNode(n));
  }

  if (grouped.edges.length > 0) {
    sections.push('\nEDGES:');
    for (const e of grouped.edges) {
      const lbl = e.label ? ` [${e.label}]` : '';
      sections.push(`  ${e.from} -> ${e.to}${lbl}`);
    }
  }

  sections.push('');
  sections.push(`EXISTING IDS (do not reuse for new nodes): ${existingIds.join(', ')}`);

  return sections.join('\n');
}

function formatNode(n: GroupedNode): string {
  const parts = [`  - ${n.id}: "${n.label}"`];
  const meta: string[] = [];
  if (n.shape !== 'rectangle') meta.push(`shape=${n.shape}`);
  if (n.labels.length > 0) meta.push(`labels=[${n.labels.join(',')}]`);
  if (n.attrs.icon) meta.push(`icon=${n.attrs.icon}`);
  if (n.attrs.quantity !== undefined) meta.push(`qty=${n.attrs.quantity}`);
  if (n.attrs.progress !== undefined) meta.push(`progress=${n.attrs.progress}`);
  if (n.attrs.items && n.attrs.items.length > 0)
    meta.push(`items=[${n.attrs.items.map((i) => `"${i}"`).join(',')}]`);
  if (n.attrs.content) meta.push(`content="${n.attrs.content.slice(0, 120)}${n.attrs.content.length > 120 ? '...' : ''}"`);
  if (meta.length > 0) parts.push(`(${meta.join(', ')})`);
  return parts.join(' ');
}

// ============================================================================
// Tool schema — Anthropic forces structured output via tool_use.
// ============================================================================

const labelEnum = PRESET_LABEL_KEYS.map((k) => k.toLowerCase());
const shapeEnum = SHAPES;

export const SOLVER_TOOL = {
  name: 'apply_diagram_changes',
  description:
    'Apply a batch of structured changes to the diagram. Call this exactly once with all changes.',
  input_schema: {
    type: 'object',
    required: ['rationale', 'actions'],
    properties: {
      rationale: {
        type: 'string',
        description:
          'One or two sentences explaining the changes, in the same language as the user instruction.',
      },
      actions: {
        type: 'object',
        properties: {
          add_nodes: {
            type: 'array',
            description: 'New nodes to create.',
            items: {
              type: 'object',
              required: ['id', 'label'],
              properties: {
                id: { type: 'string', description: 'Unique id, do not reuse existing ids.' },
                label: { type: 'string', description: 'Short display label, < 60 chars.' },
                labels: {
                  type: 'array',
                  items: { type: 'string', enum: labelEnum },
                  description: 'Semantic tags. Pick from the enum.',
                },
                shape: {
                  type: 'string',
                  enum: shapeEnum as unknown as string[],
                  description: 'Default rectangle if omitted.',
                },
                near: { type: 'string', description: 'Optional: id of existing node to position near.' },
                direction: {
                  type: 'string',
                  enum: ['up', 'down', 'left', 'right'],
                  description: 'Only used when near is set.',
                },
              },
            },
          },
          add_edges: {
            type: 'array',
            description: 'New connections.',
            items: {
              type: 'object',
              required: ['from', 'to'],
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
          edit_nodes: {
            type: 'array',
            description: 'Edit existing node label or shape.',
            items: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                shape: { type: 'string', enum: shapeEnum as unknown as string[] },
              },
            },
          },
          delete_nodes: {
            type: 'array',
            description: 'Ids of nodes to remove (and their edges).',
            items: { type: 'string' },
          },
          annotate: {
            type: 'array',
            description: 'Add semantic labels to existing nodes.',
            items: {
              type: 'object',
              required: ['id', 'labels'],
              properties: {
                id: { type: 'string' },
                labels: {
                  type: 'array',
                  items: { type: 'string', enum: labelEnum },
                },
              },
            },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Soft issues the user should review.',
      },
    },
  },
} as const;
