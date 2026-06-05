import { forwardRef } from 'react';
import type { ErLayout, ErTableBox } from '../layout/layout';

type ErDiagramProps = {
  layout: ErLayout;
  highlightedNodeIds?: ReadonlySet<string>;
  onTablePointerDown?: (id: string, e: React.PointerEvent) => void;
  draggingNodeId?: string | null;
};

export const ErDiagram = forwardRef<SVGSVGElement, ErDiagramProps>(
  ({ layout, highlightedNodeIds, onTablePointerDown, draggingNodeId }, ref) => {
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
            id="er-many"
            viewBox="0 0 12 12"
            refX="11"
            refY="6"
            markerWidth="14"
            markerHeight="14"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 6 L 8 1 M 0 6 L 8 6 M 0 6 L 8 11"
              fill="none"
              stroke="context-stroke"
              strokeWidth="1.5"
            />
          </marker>
          <marker
            id="er-one"
            viewBox="0 0 12 12"
            refX="11"
            refY="6"
            markerWidth="14"
            markerHeight="14"
            orient="auto-start-reverse"
          >
            <path
              d="M 4 1 L 4 11"
              fill="none"
              stroke="context-stroke"
              strokeWidth="1.5"
            />
          </marker>
        </defs>

        {layout.title && (
          <text
            className="diagram-title"
            x={layout.width / 2}
            y={20}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
          >
            {layout.title}
          </text>
        )}

        {/* Relations first so they go behind tables */}
        {layout.relations.map((r, i) => {
          const d = r.points
            .map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
            .join(' ');
          const isManyEnd =
            r.cardinality === 'one-to-many' || r.cardinality === 'many-to-many';
          const isManyStart = r.cardinality === 'many-to-many';
          return (
            <path
              key={`rel-${i}`}
              className="edge-path"
              d={d}
              markerEnd={isManyEnd ? 'url(#er-many)' : 'url(#er-one)'}
              markerStart={isManyStart ? 'url(#er-many)' : 'url(#er-one)'}
            />
          );
        })}

        {/* Tables */}
        {layout.tables.map((t) => (
          <ErTable
            key={t.id}
            table={t}
            isHighlighted={highlightedNodeIds?.has(t.id) ?? false}
            isDragging={draggingNodeId === t.id}
            onPointerDown={
              onTablePointerDown ? (e) => onTablePointerDown(t.id, e) : undefined
            }
          />
        ))}
      </svg>
    );
  },
);

ErDiagram.displayName = 'ErDiagram';

function ErTable({
  table,
  isHighlighted,
  isDragging,
  onPointerDown,
}: {
  table: ErTableBox;
  isHighlighted: boolean;
  isDragging: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const w = table.width;
  const h = table.height;
  const className = `er-table ${isHighlighted ? 'is-highlighted' : ''}`;
  return (
    <g
      className={className}
      data-node="true"
      data-id={table.id}
      transform={`translate(${table.x - w / 2}, ${table.y - h / 2})`}
      style={{
        cursor: onPointerDown ? (isDragging ? 'grabbing' : 'grab') : undefined,
      }}
      onPointerDown={onPointerDown}
    >
      <rect
        className="node-shape"
        width={w}
        height={h}
        rx={6}
        style={
          table.color
            ? ({ ['--node-fill-override' as string]: table.color } as React.CSSProperties)
            : undefined
        }
      />
      {/* Header */}
      <rect className="er-header" x={0} y={0} width={w} height={table.headerHeight} rx={6} />
      <text
        className="er-table-name"
        x={w / 2}
        y={table.headerHeight / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={600}
      >
        {table.icon ? `${table.icon}  ${table.label}` : table.label}
      </text>
      {/* Separator line */}
      <line
        className="er-divider"
        x1={0}
        y1={table.headerHeight}
        x2={w}
        y2={table.headerHeight}
      />
      {/* Columns */}
      {table.columns.map((c, i) => {
        const y = table.headerHeight + i * table.rowHeight;
        return (
          <g key={c.name}>
            {i > 0 && (
              <line
                className="er-row-divider"
                x1={8}
                y1={y}
                x2={w - 8}
                y2={y}
              />
            )}
            <text
              className={`er-col-name ${c.isPk ? 'is-pk' : ''} ${c.isFk ? 'is-fk' : ''}`}
              x={12}
              y={y + table.rowHeight / 2}
              dominantBaseline="central"
              fontSize={11}
              fontFamily="ui-monospace, Menlo, Consolas, monospace"
            >
              {c.name}
              {c.isPk && (
                <tspan className="er-tag" dx={6}>
                  PK
                </tspan>
              )}
              {c.isFk && (
                <tspan className="er-tag" dx={c.isPk ? 4 : 6}>
                  FK
                </tspan>
              )}
            </text>
            <text
              className="er-col-type"
              x={w - 12}
              y={y + table.rowHeight / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={11}
              fontFamily="ui-monospace, Menlo, Consolas, monospace"
            >
              {c.type}
            </text>
          </g>
        );
      })}
    </g>
  );
}
