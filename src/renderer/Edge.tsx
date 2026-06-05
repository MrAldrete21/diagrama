import type { LayoutEdge } from '../layout/layout';

const DASH_PATTERNS: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '6 4',
  dotted: '2 3',
};

export function Edge({
  edge,
  isSelected,
  onPointerDown,
}: {
  edge: LayoutEdge;
  isSelected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  if (edge.points.length === 0) return null;

  const d = edge.points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  const mid = edge.points[Math.floor(edge.points.length / 2)];
  // El connect condicional, sin estilo explicito, se dibuja dashed para
  // diferenciarlo a simple vista.
  const dasharray = edge.style
    ? DASH_PATTERNS[edge.style]
    : edge.conditional
      ? '5 4'
      : undefined;
  const stroke = edge.color;

  const markerEnd = edge.arrow !== 'undirected' ? 'url(#arrow)' : undefined;
  const markerStart = edge.arrow === 'bidirectional' ? 'url(#arrow)' : undefined;

  const groupClass = [
    'edge-group',
    isSelected ? 'is-selected' : '',
    edge.conditional ? 'is-conditional' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Diamante (gate) cerca del origen que marca la condicion/accion.
  let gate: { x: number; y: number } | null = null;
  if (edge.conditional && edge.points.length >= 2) {
    const s = edge.points[0];
    const n = edge.points[1];
    const dx = n.x - s.x;
    const dy = n.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    gate = { x: s.x + (dx / len) * 11, y: s.y + (dy / len) * 11 };
  }
  const R = 5.5;

  return (
    <g className={groupClass}>
      {/* Invisible thick path catches clicks even outside the visible line */}
      {onPointerDown && (
        <path
          d={d}
          className="edge-hit"
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          pointerEvents="stroke"
          onPointerDown={onPointerDown}
        />
      )}
      <path
        className="edge-path"
        d={d}
        markerEnd={markerEnd}
        markerStart={markerStart}
        strokeDasharray={dasharray}
        stroke={stroke}
        pointerEvents="none"
      />
      {gate && (
        <polygon
          className="edge-conditional-gate"
          points={`${gate.x},${gate.y - R} ${gate.x + R},${gate.y} ${gate.x},${gate.y + R} ${gate.x - R},${gate.y}`}
          pointerEvents="none"
        />
      )}
      {edge.label && (
        <text
          className="edge-label"
          x={mid.x}
          y={mid.y - 6}
          textAnchor="middle"
          fontSize={12}
          fontFamily="system-ui, -apple-system, sans-serif"
          pointerEvents="none"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}
