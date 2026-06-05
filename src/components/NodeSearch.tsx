import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutNode } from '../layout/layout';
import { labelDef } from '../renderer/labels';

export function NodeSearch({
  nodes,
  onPick,
  onClose,
}: {
  nodes: ReadonlyArray<LayoutNode>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
    if (!q) return sorted.slice(0, 50);
    return sorted
      .filter((n) => {
        if (n.id.toLowerCase().includes(q)) return true;
        if (n.label.toLowerCase().includes(q)) return true;
        if (n.labels && n.labels.some((l) => l.toLowerCase().includes(q))) return true;
        return false;
      })
      .slice(0, 50);
  }, [nodes, query]);

  // Clamp focus when matches shrink
  useEffect(() => {
    if (focusedIdx >= matches.length) setFocusedIdx(Math.max(0, matches.length - 1));
  }, [matches.length, focusedIdx]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(matches.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = matches[focusedIdx];
      if (target) {
        onPick(target.id);
        onClose();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
  };

  return (
    <div className="node-search-overlay" onClick={onClose}>
      <div
        className="node-search"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <input
          ref={inputRef}
          type="text"
          className="node-search-input"
          placeholder="Buscar nodo por id, label o tag..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFocusedIdx(0);
          }}
          onKeyDown={handleKey}
        />
        <div className="node-search-results">
          {matches.length === 0 && (
            <div className="node-search-empty">sin resultados</div>
          )}
          {matches.map((n, i) => (
            <button
              key={n.id}
              type="button"
              className={`node-search-item ${i === focusedIdx ? 'is-focused' : ''}`}
              onClick={() => {
                onPick(n.id);
                onClose();
              }}
              onMouseEnter={() => setFocusedIdx(i)}
            >
              <span className="node-search-id">{n.id}</span>
              <span className="node-search-label">{n.label}</span>
              {n.labels && n.labels.length > 0 && (
                <span className="node-search-chips">
                  {n.labels.slice(0, 3).map((l) => {
                    const def = labelDef(l);
                    return (
                      <span
                        key={l}
                        className="node-search-chip"
                        style={{ background: def.bg, color: def.fg }}
                      >
                        {def.display}
                      </span>
                    );
                  })}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="node-search-hint">↑↓ navegar · Enter saltar · Esc cerrar</div>
      </div>
    </div>
  );
}
