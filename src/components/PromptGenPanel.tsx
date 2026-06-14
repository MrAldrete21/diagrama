import { useMemo, useState } from 'react';

export type PromptScope = 'all' | 'selected' | 'request' | 'pending';

const SCOPES: { key: PromptScope; label: string }[] = [
  { key: 'all', label: 'todo' },
  { key: 'selected', label: 'seleccion' },
  { key: 'request', label: 'pedidos' },
  { key: 'pending', label: 'pendientes' },
];

export function PromptGenPanel({
  isFlowchart,
  buildPrompt,
  onCopy,
  onExportSvg,
  onExportPng,
  onClose,
}: {
  isFlowchart: boolean;
  /** Genera el prompt para el scope dado (incremental). */
  buildPrompt: (scope: PromptScope) => string;
  onCopy: (text: string) => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<PromptScope>('all');
  const prompt = useMemo(
    () => (isFlowchart ? buildPrompt(scope) : ''),
    [isFlowchart, buildPrompt, scope],
  );

  return (
    <div
      className="solver-panel"
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="solver-header">
        <span className="solver-title">exportar</span>
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

      {/* Exportar imagen (siempre disponible, cualquier tipo de diagrama) */}
      <div className="export-section">
        <div className="export-section-title">imagen</div>
        <div className="export-btns">
          <button type="button" className="btn" onClick={onExportSvg} title="Exportar SVG (Ctrl+E)">
            SVG
          </button>
          <button type="button" className="btn btn-primary" onClick={onExportPng} title="Exportar PNG (Ctrl+Shift+E)">
            PNG
          </button>
        </div>
      </div>

      {!isFlowchart && (
        <div className="solver-empty">
          El generador de prompt opera sobre flowcharts. Cambia el `type:` del DSL.
        </div>
      )}

      {isFlowchart && (
        <>
          <div className="export-section-title">prompt para Claude Code</div>
          <div className="promptgen-scope">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`promptgen-scope-btn ${scope === s.key ? 'is-active' : ''}`}
                onClick={() => setScope(s.key)}
                title={
                  s.key === 'all'
                    ? 'Todo el diagrama'
                    : s.key === 'selected'
                      ? 'Solo los nodos seleccionados'
                      : s.key === 'request'
                        ? 'Solo los nodos marcados como pedido (R)'
                        : 'Solo los que no estan done'
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <textarea
            className="solver-textarea promptgen-output"
            readOnly
            value={prompt}
            onFocus={(e) => e.currentTarget.select()}
          />
          <footer className="solver-footer">
            <span className="solver-hint">{prompt.length} chars</span>
            <div className="spacer" />
            <button type="button" className="btn btn-primary" onClick={() => onCopy(prompt)}>
              Copiar
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
