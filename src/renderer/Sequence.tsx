import { forwardRef } from 'react';
import type { SequenceLayout } from '../layout/layout';

type SequenceDiagramProps = {
  layout: SequenceLayout;
  highlightedNodeIds?: ReadonlySet<string>;
};

const DASH_PATTERNS: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '6 4',
  dotted: '2 3',
};

export const SequenceDiagram = forwardRef<SVGSVGElement, SequenceDiagramProps>(
  ({ layout, highlightedNodeIds }, ref) => {
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
            y={20}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
          >
            {layout.title}
          </text>
        )}

        {/* Lifelines */}
        {layout.actors.map((a) => (
          <line
            key={`life-${a.id}`}
            className="lifeline"
            x1={a.x}
            y1={a.y + a.height / 2}
            x2={a.x}
            y2={a.y + a.height / 2 + a.lifelineHeight}
            strokeDasharray="4 4"
          />
        ))}

        {/* Actor boxes */}
        {layout.actors.map((a) => {
          const isHl = highlightedNodeIds?.has(a.id) ?? false;
          return (
            <g
              key={a.id}
              className={`actor-group ${isHl ? 'is-highlighted' : ''}`}
              data-node="true"
              data-id={a.id}
              transform={`translate(${a.x - a.width / 2}, ${a.y - a.height / 2})`}
            >
              <rect
                className="node-shape"
                width={a.width}
                height={a.height}
                rx={6}
              />
              <text
                className="node-label"
                x={a.width / 2}
                y={a.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={500}
              >
                {a.label}
              </text>
            </g>
          );
        })}

        {/* Bottom actor mirror */}
        {layout.actors.map((a) => (
          <g
            key={`btm-${a.id}`}
            transform={`translate(${a.x - a.width / 2}, ${a.y + a.height / 2 + a.lifelineHeight - a.height / 2})`}
          >
            <rect
              className="node-shape"
              width={a.width}
              height={a.height}
              rx={6}
            />
            <text
              className="node-label"
              x={a.width / 2}
              y={a.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={13}
              fontWeight={500}
            >
              {a.label}
            </text>
          </g>
        ))}

        {/* Notes */}
        {layout.notes.map((n, i) => (
          <g key={`note-${i}`} transform={`translate(${n.x}, ${n.y})`}>
            <rect
              className="seq-note"
              width={n.width}
              height={n.height}
              rx={2}
            />
            <text
              className="seq-note-text"
              x={n.width / 2}
              y={n.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
            >
              {n.text}
            </text>
          </g>
        ))}

        {/* Messages */}
        {layout.messages.map((m, i) => {
          const dasharray = m.style ? DASH_PATTERNS[m.style] : undefined;
          const stroke = m.color;
          const isSelf = m.from === m.to;
          let d: string;
          let labelX: number;
          let labelY: number;
          if (isSelf) {
            const x = m.fromX;
            const r = 30;
            d = `M ${x} ${m.y} C ${x + r} ${m.y}, ${x + r} ${m.y + 30}, ${x} ${m.y + 30}`;
            labelX = x + r + 6;
            labelY = m.y + 15;
          } else {
            d = `M ${m.fromX} ${m.y} L ${m.toX} ${m.y}`;
            labelX = (m.fromX + m.toX) / 2;
            labelY = m.y - 6;
          }
          const markerEnd = m.arrow !== 'undirected' ? 'url(#arrow)' : undefined;
          const markerStart =
            m.arrow === 'bidirectional' ? 'url(#arrow)' : undefined;
          return (
            <g key={`msg-${i}`}>
              <path
                className="edge-path"
                d={d}
                markerEnd={markerEnd}
                markerStart={markerStart}
                strokeDasharray={dasharray}
                stroke={stroke}
              />
              {m.label && (
                <text
                  className="edge-label"
                  x={labelX}
                  y={labelY}
                  textAnchor={isSelf ? 'start' : 'middle'}
                  fontSize={12}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {m.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  },
);

SequenceDiagram.displayName = 'SequenceDiagram';
