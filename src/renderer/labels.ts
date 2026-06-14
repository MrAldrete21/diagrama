// Semantic labels attached to a node. Used today for visual tagging and later
// as context hints for prompt-solver / AI generation features.

export type LabelDef = {
  key: string;
  display: string;
  bg: string;
  fg: string;
  /** Semantic description fed to the LLM solver as ontology. */
  description: string;
};

export const PRESET_LABELS: LabelDef[] = [
  { key: 'feature', display: 'Feature', bg: '#dbeafe', fg: '#1e3a8a', description: 'A capability the system provides.' },
  { key: 'constraint', display: 'Constraint', bg: '#fef3c7', fg: '#78350f', description: 'A limitation, rule or requirement that any solution must respect.' },
  { key: 'goal', display: 'Goal', bg: '#dcfce7', fg: '#14532d', description: 'An outcome we want to achieve. The solver should optimize towards these.' },
  { key: 'risk', display: 'Risk', bg: '#fee2e2', fg: '#991b1b', description: 'Something that could go wrong; a failure mode to mitigate.' },
  { key: 'todo', display: 'Todo', bg: '#ede9fe', fg: '#5b21b6', description: 'Work that still needs to be done.' },
  { key: 'idea', display: 'Idea', bg: '#fef9c3', fg: '#854d0e', description: 'An unvalidated proposal.' },
  { key: 'question', display: 'Question', bg: '#e2e8f0', fg: '#1e293b', description: 'Something that needs clarification before progressing.' },
  { key: 'blocked', display: 'Blocked', bg: '#fecaca', fg: '#7f1d1d', description: 'Cannot proceed because of an external dependency.' },
  { key: 'done', display: 'Done', bg: '#a7f3d0', fg: '#064e3b', description: 'Completed work; treat as fixed context.' },
  { key: 'input', display: 'Input', bg: '#cffafe', fg: '#155e75', description: 'Data or signal flowing into the system or step.' },
  { key: 'output', display: 'Output', bg: '#fae8ff', fg: '#701a75', description: 'Data or signal flowing out of the system or step.' },
  { key: 'decision', display: 'Decision', bg: '#ffedd5', fg: '#7c2d12', description: 'A branching point with multiple possible paths.' },
  { key: 'ai-decision', display: 'Ai decision (auto)', bg: '#e0e7ff', fg: '#3730a3', description: 'Punto donde la IA decide el diseno. Antes de implementar NADA, el modelo propone los cambios EDITANDO el diagrama (agrega/edita nodos) y los marca con la label "review" para que el usuario los apruebe. No escribir codigo hasta la aprobacion.' },
  { key: 'ai-decision-user', display: 'Ai decision (user)', bg: '#fce7f3', fg: '#9d174f', description: 'La IA propone opciones o una recomendacion editando el diagrama, pero el usuario toma la decision final antes de que el sistema avance. No implementar hasta la aprobacion.' },
  { key: 'review', display: 'Review', bg: '#fde68a', fg: '#92400e', description: 'Cambio propuesto por el modelo (nodo nuevo o editado tras una Ai decision) que el usuario todavia no aprobo. No implementar; esperar revision. El nodo late suave hasta que se quita la label.' },
];

const PRESET_MAP = new Map(PRESET_LABELS.map((l) => [l.key.toLowerCase(), l]));

export function labelDef(key: string): LabelDef {
  const found = PRESET_MAP.get(key.toLowerCase());
  if (found) return found;
  // Custom labels get a neutral fallback chip.
  return {
    key,
    display: key,
    bg: '#f1f5f9',
    fg: '#334155',
    description: 'Custom user-defined tag.',
  };
}

// Override map for editable label prompts (key -> custom description).
export type LabelPrompts = Record<string, string>;

/**
 * Descripcion efectiva de una label: el override del usuario si existe y no esta
 * vacio, si no la descripcion default. Es la unica fuente que consumen el prompt
 * generator y la ontologia del solver, asi editar una label se refleja en todos
 * los nodos que la llevan.
 */
export function resolveLabelDescription(key: string, overrides?: LabelPrompts): string {
  const custom = overrides?.[key.toLowerCase()];
  if (custom && custom.trim()) return custom.trim();
  return labelDef(key).description;
}

export function hasLabelOverride(key: string, overrides?: LabelPrompts): boolean {
  const custom = overrides?.[key.toLowerCase()];
  return !!(custom && custom.trim());
}

export function isPresetLabel(key: string): boolean {
  return PRESET_MAP.has(key.toLowerCase());
}

export const PRESET_LABEL_KEYS: string[] = PRESET_LABELS.map((l) => l.key);
