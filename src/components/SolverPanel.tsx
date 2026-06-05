import { useEffect, useRef, useState } from 'react';
import { TASKS } from '../solver/buildPrompt';
import type { TaskType } from '../solver/buildPrompt';
import type { SolverResponse } from '../solver/client';

const API_KEY_STORAGE = 'diagrama:anthropic-key';

export function SolverPanel({
  isFlowchart,
  isRunning,
  response,
  error,
  onSubmit,
  onApply,
  onReject,
  onClose,
}: {
  isFlowchart: boolean;
  isRunning: boolean;
  response: SolverResponse | null;
  error: string | null;
  onSubmit: (apiKey: string, taskType: TaskType, instruction: string) => void;
  onApply: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE) ?? '';
    } catch {
      return '';
    }
  });
  const [showKey, setShowKey] = useState(false);
  const [task, setTask] = useState<TaskType>('expand');
  const [instruction, setInstruction] = useState('');
  const instructionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!response) instructionRef.current?.focus();
  }, [response]);

  const handleSubmit = () => {
    if (!apiKey.trim()) return;
    try {
      localStorage.setItem(API_KEY_STORAGE, apiKey);
    } catch {
      /* ignore */
    }
    onSubmit(apiKey.trim(), task, instruction);
  };

  const actionCount = response
    ? (response.actions.add_nodes?.length ?? 0) +
      (response.actions.add_edges?.length ?? 0) +
      (response.actions.edit_nodes?.length ?? 0) +
      (response.actions.delete_nodes?.length ?? 0) +
      (response.actions.annotate?.length ?? 0)
    : 0;

  return (
    <div
      className="solver-panel"
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="solver-header">
        <span className="solver-title">solver</span>
        <button
          type="button"
          className="solver-close"
          onClick={onClose}
          aria-label="cerrar"
          tabIndex={-1}
        >
          x
        </button>
      </header>

      {!isFlowchart && (
        <div className="solver-empty">
          El solver opera sobre flowcharts. Cambia el `type:` del DSL.
        </div>
      )}

      {isFlowchart && !response && (
        <>
          <section className="solver-section">
            <label className="solver-label">API key (Anthropic)</label>
            <div className="solver-key-row">
              <input
                type={showKey ? 'text' : 'password'}
                className="solver-input"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost solver-key-toggle"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? 'hide' : 'show'}
              </button>
            </div>
            <p className="solver-hint">
              Se guarda en localStorage. La llamada es directa desde el browser
              (sin proxy) — usa una key con scope acotado.
            </p>
          </section>

          <section className="solver-section">
            <label className="solver-label">task</label>
            <div className="solver-tasks">
              {TASKS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`solver-task ${task === t.key ? 'is-active' : ''}`}
                  onClick={() => setTask(t.key)}
                  title={t.desc}
                >
                  {t.display}
                </button>
              ))}
            </div>
            <p className="solver-hint">
              {TASKS.find((t) => t.key === task)?.desc}
            </p>
          </section>

          <section className="solver-section">
            <label className="solver-label">instruccion</label>
            <textarea
              ref={instructionRef}
              className="solver-textarea"
              rows={4}
              placeholder="Opcional. E.g. 'enfoca en la latencia de la API de search'"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </section>

          <footer className="solver-footer">
            {error && <div className="solver-error">{error}</div>}
            <div className="spacer" />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!apiKey.trim() || isRunning}
            >
              {isRunning ? 'thinking...' : 'run (Ctrl+Enter)'}
            </button>
          </footer>
        </>
      )}

      {isFlowchart && response && (
        <>
          <section className="solver-section">
            <div className="solver-rationale">{response.rationale}</div>
          </section>

          {response.warnings && response.warnings.length > 0 && (
            <section className="solver-section solver-warnings">
              <div className="solver-label">warnings</div>
              <ul>
                {response.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="solver-section">
            <div className="solver-label">{actionCount} acciones</div>
            <ActionDiff response={response} />
          </section>

          <footer className="solver-footer">
            <button type="button" className="btn btn-ghost" onClick={onReject}>
              rechazar
            </button>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn-primary"
              onClick={onApply}
              disabled={actionCount === 0}
            >
              aplicar
            </button>
          </footer>
        </>
      )}
    </div>
  );
}

function ActionDiff({ response }: { response: SolverResponse }) {
  const { actions } = response;
  const items: Array<{ kind: string; line: string }> = [];
  for (const n of actions.add_nodes ?? [])
    items.push({
      kind: 'add',
      line: `+ ${n.id}: "${n.label}"${n.labels && n.labels.length > 0 ? ` [${n.labels.join(',')}]` : ''}`,
    });
  for (const e of actions.add_edges ?? [])
    items.push({ kind: 'add', line: `+ edge ${e.from} → ${e.to}${e.label ? ` (${e.label})` : ''}` });
  for (const ed of actions.edit_nodes ?? [])
    items.push({
      kind: 'edit',
      line: `~ ${ed.id}${ed.label ? ` label="${ed.label}"` : ''}${ed.shape ? ` shape=${ed.shape}` : ''}`,
    });
  for (const an of actions.annotate ?? [])
    items.push({ kind: 'edit', line: `~ ${an.id} +labels [${an.labels.join(',')}]` });
  for (const id of actions.delete_nodes ?? [])
    items.push({ kind: 'del', line: `- ${id}` });
  if (items.length === 0)
    return <div className="solver-hint">(no actions)</div>;
  return (
    <ul className="solver-actions">
      {items.map((it, i) => (
        <li key={i} className={`solver-action solver-action-${it.kind}`}>
          {it.line}
        </li>
      ))}
    </ul>
  );
}
