import { useMemo, useState } from 'react';
import type { DiagramNode, BuzonData } from '../parser/types';
import { seedBuzon, buzonProgress } from '../buzon/buzon';
import { BuzonChecklist } from './UploadNodeModal';

// Pestania "Tareas" (panel del lado derecho): junta TODO lo que el modelo
// requiere del usuario — los nodos buzon (shape: upload = subir archivos,
// shape: form = responder texto) — en un solo lugar. Cada tarea se expande
// inline con su checklist para completarla sin buscar el nodo en el canvas.
// Al avanzar (◀ ▶ o click) la camara se centra sobre el nodo asignado.
export function TasksPanel({
  nodes,
  onSetBuzon,
  onFocusNode,
  onClose,
}: {
  nodes: DiagramNode[];
  onSetBuzon: (nodeId: string, data: BuzonData) => void;
  onFocusNode: (id: string) => void;
  onClose: () => void;
}) {
  const tasks = useMemo(
    () =>
      nodes
        .filter((n) => n.shape === 'upload' || n.shape === 'form')
        .map((n) => {
          const prog = buzonProgress(seedBuzon(n.buzon, n.items));
          const done = prog.totalLists > 0 && prog.doneLists === prog.totalLists;
          return { node: n, prog, done };
        })
        // Pendientes primero, completas al final (orden estable dentro de cada grupo).
        .sort((a, b) => Number(a.done) - Number(b.done)),
    [nodes],
  );
  const pending = tasks.filter((t) => !t.done);

  const [activeId, setActiveId] = useState<string | null>(null);

  const open = (id: string) => {
    setActiveId(id);
    onFocusNode(id);
  };
  const toggle = (id: string) => {
    if (activeId === id) setActiveId(null);
    else open(id);
  };

  // Avanza/retrocede dentro de las tareas (pendientes si hay, sino todas).
  const nav = (dir: 1 | -1) => {
    const pool = (pending.length > 0 ? pending : tasks).map((t) => t.node.id);
    if (pool.length === 0) return;
    const idx = activeId ? pool.indexOf(activeId) : -1;
    const next = pool[(idx + dir + pool.length) % pool.length];
    open(next);
  };

  return (
    <div
      className="solver-panel tasks-panel"
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="solver-header">
        <span className="solver-title">tareas del modelo</span>
        <span className={`buzon-overall ${pending.length === 0 && tasks.length > 0 ? 'is-done' : ''}`}>
          {tasks.length === 0 ? '—' : pending.length === 0 ? 'todo ✓' : `${pending.length} pendiente${pending.length === 1 ? '' : 's'}`}
        </span>
        <button
          type="button"
          className="tasks-nav"
          onClick={() => nav(-1)}
          title="tarea anterior"
          disabled={tasks.length === 0}
        >
          ◀
        </button>
        <button
          type="button"
          className="tasks-nav"
          onClick={() => nav(1)}
          title="siguiente tarea"
          disabled={tasks.length === 0}
        >
          ▶
        </button>
        <button type="button" className="solver-close" onClick={onClose} aria-label="cerrar" tabIndex={-1}>
          x
        </button>
      </header>

      {tasks.length === 0 ? (
        <div className="solver-empty">
          No hay tareas asignadas. El modelo crea nodos buzon (archivos o texto)
          con lo que necesita de vos; van a aparecer aca.
        </div>
      ) : (
        <div className="tasks-body">
          {tasks.map(({ node, prog, done }) => {
            const isActive = activeId === node.id;
            return (
              <section key={node.id} className={`tasks-card ${done ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}>
                <button type="button" className="tasks-card-head" onClick={() => toggle(node.id)}>
                  <span className={`buzon-check ${done ? 'is-on' : ''}`}>{done ? '✓' : ''}</span>
                  <span className="tasks-kind" title={node.shape === 'form' ? 'responder texto' : 'subir archivos'}>
                    {node.shape === 'form' ? 'T' : '↑'}
                  </span>
                  <span className="tasks-card-title" title={node.label || node.id}>
                    {node.label || node.id}
                  </span>
                  <span className="buzon-list-prog">
                    {prog.totalLists > 0 ? `${prog.doneItems}/${prog.totalItems}` : 'vacio'}
                  </span>
                  <span className="buzon-collapse">{isActive ? '▾' : '▸'}</span>
                </button>
                {isActive && (
                  <div className="tasks-card-body">
                    <BuzonChecklist key={node.id} node={node} onSetBuzon={onSetBuzon} />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
