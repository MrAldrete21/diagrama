import { SOLVER_TOOL } from './buildPrompt';

export type AddNode = {
  id: string;
  label: string;
  labels?: string[];
  shape?: string;
  near?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
};

export type AddEdge = { from: string; to: string; label?: string };
export type EditNode = { id: string; label?: string; shape?: string };
export type Annotate = { id: string; labels: string[] };

export type SolverActions = {
  add_nodes?: AddNode[];
  add_edges?: AddEdge[];
  edit_nodes?: EditNode[];
  delete_nodes?: string[];
  annotate?: Annotate[];
};

export type SolverResponse = {
  rationale: string;
  actions: SolverActions;
  warnings?: string[];
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-5';

export async function callSolver(opts: {
  apiKey: string;
  model?: string;
  system: string;
  user: string;
}): Promise<SolverResponse> {
  const { apiKey, model = DEFAULT_MODEL, system, user } = opts;

  const body = {
    model,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: system,
        // Cache the system prompt — it doesn't change between calls in a session.
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: user }],
    tools: [SOLVER_TOOL],
    tool_choice: { type: 'tool', name: SOLVER_TOOL.name },
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text}`);
  }

  const json = await res.json();
  const toolUse = json.content?.find((b: { type: string }) => b.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Modelo no llamo a la herramienta apply_diagram_changes');
  }
  const input = toolUse.input as {
    rationale?: string;
    actions?: SolverActions;
    warnings?: string[];
  };
  return {
    rationale: input.rationale ?? '',
    actions: input.actions ?? {},
    warnings: input.warnings ?? [],
  };
}
