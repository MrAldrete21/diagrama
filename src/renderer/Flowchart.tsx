import { forwardRef } from 'react';
import type { LayoutNode, LayoutEdge, FlowchartLayout } from '../layout/layout';
import { Node } from './Node';
import type { ResizeCorner } from './Node';
import { Edge } from './Edge';
import { Group } from './Group';

export type Direction = 'up' | 'right' | 'down' | 'left';

export type EdgeKey = { from: string; to: string; sourceLine: number };

type FlowchartProps = {
  layout: FlowchartLayout;
  onNodePointerDown?: (id: string, e: React.PointerEvent) => void;
  onNodeDoubleClick?: (id: string, e: React.MouseEvent) => void;
  onNodeResizeStart?: (id: string, corner: ResizeCorner, e: React.PointerEvent) => void;
  onAddConnected?: (id: string, direction: Direction) => void;
  onToggleProgress?: (id: string) => void;
  onEdgePointerDown?: (edge: LayoutEdge, e: React.PointerEvent) => void;
  draggingNodeId?: string | null;
  highlightedNodeIds?: ReadonlySet<string>;
  selectedNodeIds?: ReadonlySet<string>;
  selectedEdgeKey?: EdgeKey | null;
  connectFromId?: string | null;
  editingNode?: LayoutNode | null;
  editingValue?: string;
  onEditingValueChange?: (v: string) => void;
  onEditingCommit?: () => void;
  onEditingCancel?: () => void;
  /** World-space coords (X) of vertical guide lines to render during drag. */
  guidesX?: ReadonlyArray<number>;
  /** World-space coords (Y) of horizontal guide lines to render during drag. */
  guidesY?: ReadonlyArray<number>;
};

function isSameEdge(a: EdgeKey | null | undefined, e: LayoutEdge): boolean {
  if (!a) return false;
  return a.from === e.from && a.to === e.to && a.sourceLine === e.sourceLine;
}

export const Flowchart = forwardRef<SVGSVGElement, FlowchartProps>(
  (
    {
      layout,
      onNodePointerDown,
      onNodeDoubleClick,
      onNodeResizeStart,
      onAddConnected,
      onToggleProgress,
      onEdgePointerDown,
      draggingNodeId,
      highlightedNodeIds,
      selectedNodeIds,
      selectedEdgeKey,
      connectFromId,
      editingNode,
      editingValue,
      onEditingValueChange,
      onEditingCommit,
      onEditingCancel,
      guidesX,
      guidesY,
    },
    ref,
  ) => {
    const singleSelectedId =
      selectedNodeIds && selectedNodeIds.size === 1
        ? Array.from(selectedNodeIds)[0]
        : null;
    const singleSelectedNode = singleSelectedId
      ? layout.nodes.find((n) => n.id === singleSelectedId)
      : null;

    return (
      <svg
        ref={ref}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className="diagram-svg"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>
        {layout.title && (
          <text
            className="diagram-title"
            x={layout.width / 2}
            y={18}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
          >
            {layout.title}
          </text>
        )}
        <g>
          {layout.groups.map((g) => (
            <Group key={g.id} group={g} />
          ))}
          {layout.edges.map((e, i) => (
            <Edge
              key={`${e.from}->${e.to}-${i}`}
              edge={e}
              isSelected={isSameEdge(selectedEdgeKey, e)}
              onPointerDown={
                onEdgePointerDown ? (ev) => onEdgePointerDown(e, ev) : undefined
              }
            />
          ))}
          {layout.nodes.map((n) => (
            <Node
              key={n.id}
              node={n}
              onPointerDown={
                onNodePointerDown ? (e) => onNodePointerDown(n.id, e) : undefined
              }
              onDoubleClick={
                onNodeDoubleClick ? (e) => onNodeDoubleClick(n.id, e) : undefined
              }
              onResizeStart={
                onNodeResizeStart
                  ? (corner, e) => onNodeResizeStart(n.id, corner, e)
                  : undefined
              }
              onToggleProgress={onToggleProgress}
              isDragging={draggingNodeId === n.id}
              isHighlighted={highlightedNodeIds?.has(n.id) ?? false}
              isConnectSource={connectFromId === n.id}
              isSelected={selectedNodeIds?.has(n.id) ?? false}
              showHandles={singleSelectedId === n.id}
            />
          ))}
          {singleSelectedNode && onAddConnected && !editingNode && (
            <ConnectorButtons
              node={singleSelectedNode}
              onAdd={(dir) => onAddConnected(singleSelectedNode.id, dir)}
            />
          )}
          {editingNode && (
            <foreignObject
              x={editingNode.x - editingNode.width / 2 + 6}
              y={editingNode.y - 14}
              width={editingNode.width - 12}
              height={28}
            >
              <input
                className="label-input"
                autoFocus
                value={editingValue ?? ''}
                onChange={(e) => onEditingValueChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onEditingCommit?.();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onEditingCancel?.();
                  }
                }}
                onBlur={() => onEditingCommit?.()}
              />
            </foreignObject>
          )}
          {(guidesX && guidesX.length > 0) || (guidesY && guidesY.length > 0) ? (
            <g className="drag-guides" pointerEvents="none">
              {(guidesX ?? []).map((x, i) => (
                <line
                  key={`gx${i}`}
                  className="drag-guide-line"
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={layout.height}
                />
              ))}
              {(guidesY ?? []).map((y, i) => (
                <line
                  key={`gy${i}`}
                  className="drag-guide-line"
                  x1={0}
                  y1={y}
                  x2={layout.width}
                  y2={y}
                />
              ))}
            </g>
          ) : null}
        </g>
      </svg>
    );
  },
);

Flowchart.displayName = 'Flowchart';

function ConnectorButtons({
  node,
  onAdd,
}: {
  node: LayoutNode;
  onAdd: (dir: Direction) => void;
}) {
  const w = node.width;
  const h = node.height;
  const offset = 22;
  const r = 9;

  const positions: { dir: Direction; x: number; y: number; titleText: string }[] = [
    { dir: 'up', x: 0, y: -h / 2 - offset, titleText: 'Conectar arriba (Shift+W)' },
    { dir: 'right', x: w / 2 + offset, y: 0, titleText: 'Conectar a la derecha (Shift+D)' },
    { dir: 'down', x: 0, y: h / 2 + offset, titleText: 'Conectar abajo (Shift+S)' },
    { dir: 'left', x: -w / 2 - offset, y: 0, titleText: 'Conectar a la izquierda (Shift+A)' },
  ];

  return (
    <g transform={`translate(${node.x}, ${node.y})`} className="connector-buttons">
      {positions.map((p) => (
        <g
          key={p.dir}
          transform={`translate(${p.x}, ${p.y})`}
          className="connector-button"
          data-resize-handle="true"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            onAdd(p.dir);
          }}
        >
          <title>{p.titleText}</title>
          <circle className="connector-bg" r={r} />
          <line className="connector-plus" x1={-4} y1={0} x2={4} y2={0} />
          <line className="connector-plus" x1={0} y1={-4} x2={0} y2={4} />
        </g>
      ))}
    </g>
  );
}
