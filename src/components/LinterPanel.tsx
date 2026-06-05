import type { LintIssue } from '../lint/lintDiagram';

export function LinterPanel({
  issues,
  onSelectNode,
  onClose,
}: {
  issues: LintIssue[];
  onSelectNode: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="solver-panel"
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="solver-header">
        <span className="solver-title">lint · {issues.length}</span>
        <button type="button" className="solver-close" onClick={onClose} aria-label="cerrar" tabIndex={-1}>
          x
        </button>
      </header>
      {issues.length === 0 ? (
        <div className="solver-empty">Sin problemas detectados ✓</div>
      ) : (
        <div className="lint-list">
          {issues.map((i, idx) => (
            <button
              key={idx}
              type="button"
              className={`lint-item lint-${i.level} ${i.nodeId ? 'is-clickable' : ''}`}
              onClick={() => i.nodeId && onSelectNode(i.nodeId)}
              disabled={!i.nodeId}
            >
              <span className={`lint-badge lint-${i.level}`}>{i.level}</span>
              <span className="lint-msg">
                {i.nodeId ? `${i.nodeId}: ` : ''}
                {i.message}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
