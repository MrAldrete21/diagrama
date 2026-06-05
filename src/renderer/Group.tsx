import type { LayoutGroup } from '../layout/layout';

export function Group({ group }: { group: LayoutGroup }) {
  const x = group.x - group.width / 2;
  const y = group.y - group.height / 2;
  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect className="group-rect" width={group.width} height={group.height} rx={10} ry={10} />
      <text
        className="group-label"
        x={12}
        y={16}
        fontSize={11}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight={500}
      >
        {group.label}
      </text>
    </g>
  );
}
