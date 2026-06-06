import type { CSSProperties, ReactNode } from 'react';
import type { LayoutNode } from '../layout/layout';
import { IconAt, isIconKey } from './icons';
import { labelDef } from './labels';

export type ResizeCorner = 'nw' | 'ne' | 'se' | 'sw';

export function Node({
  node,
  onPointerDown,
  onDoubleClick,
  onResizeStart,
  onToggleProgress,
  isDragging,
  isHighlighted,
  isConnectSource,
  isSelected,
  showHandles,
}: {
  node: LayoutNode;
  onPointerDown?: (e: React.PointerEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onResizeStart?: (corner: ResizeCorner, e: React.PointerEvent) => void;
  onToggleProgress?: (id: string) => void;
  isDragging?: boolean;
  isHighlighted?: boolean;
  isConnectSource?: boolean;
  isSelected?: boolean;
  showHandles?: boolean;
}) {
  const className = [
    'node-group',
    isHighlighted ? 'is-highlighted' : '',
    isConnectSource ? 'is-connect-source' : '',
    isSelected ? 'is-selected' : '',
    node.promptHidden ? 'is-prompt-hidden' : '',
    node.status ? `status-${node.status}` : '',
    node.request ? 'is-request' : '',
    node.shape === 'note' && !node.expanded ? 'is-note-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style: CSSProperties = {};
  if (node.color) (style as Record<string, string>)['--node-fill-override'] = node.color;
  if (node.textColor) (style as Record<string, string>)['--node-text-override'] = node.textColor;
  if (node.strokeColor) (style as Record<string, string>)['--node-stroke-override'] = node.strokeColor;
  if (node.strokeWidth !== undefined)
    (style as Record<string, string>)['--node-stroke-width-override'] = String(node.strokeWidth);
  if (onPointerDown) style.cursor = isDragging ? 'grabbing' : 'grab';

  const hasIcon = !!node.icon;
  const iconIsSvg = hasIcon && isIconKey(node.icon);
  const labelY = hasIcon ? node.height / 2 + 10 : node.height / 2;

  return (
    <g
      className={className}
      data-node="true"
      data-id={node.id}
      transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
      style={style}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <NodeShape node={node} />
      {node.shape === 'list' && <ListContents node={node} />}
      {node.shape === 'note' && <NoteContents node={node} />}
      {node.shape === 'image' && <ImageContents node={node} />}
      {node.shape === 'upload' && <UploadContents node={node} />}
      {node.shape !== 'list' &&
        node.shape !== 'note' &&
        node.shape !== 'image' &&
        node.shape !== 'upload' && (
        <>
          {hasIcon && iconIsSvg && (
            <IconAt
              name={node.icon as Parameters<typeof IconAt>[0]['name']}
              cx={node.width / 2}
              cy={node.height / 2 - 12}
              size={18}
            />
          )}
          {hasIcon && !iconIsSvg && (
            <text
              className="node-icon"
              x={node.width / 2}
              y={node.height / 2 - 10}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fontFamily="ui-monospace, Menlo, Consolas, monospace"
            >
              {node.icon}
            </text>
          )}
          <text
            className="node-label"
            x={node.width / 2}
            y={labelY - ((node.labelLines?.length ?? 1) - 1) * 9}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={14}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {(node.labelLines && node.labelLines.length > 1
              ? node.labelLines
              : [node.label]
            ).map((line, i) => (
              <tspan key={i} x={node.width / 2} dy={i === 0 ? 0 : 18}>
                {line}
              </tspan>
            ))}
          </text>
        </>
      )}
      {node.progress !== undefined && (
        <ProgressBadge
          x={node.width - 18}
          y={6}
          done={node.progress}
          onClick={(e) => {
            e.stopPropagation();
            onToggleProgress?.(node.id);
          }}
        />
      )}
      {node.quantity !== undefined && (
        <QuantityBadge x={6} y={node.height - 22} value={node.quantity} />
      )}
      {node.labels && node.labels.length > 0 && (
        <LabelChips
          labels={node.labels}
          maxWidth={node.width}
          x={0}
          y={-22}
        />
      )}
      {/* Glyphs apilados en la esquina sup-izquierda */}
      {(() => {
        const glyphs: React.ReactNode[] = [];
        if (node.promptHidden) glyphs.push(<PromptHiddenIcon key="h" x={0} y={0} />);
        if (node.content && node.shape !== 'note' && node.shape !== 'image')
          glyphs.push(<ContentIcon key="c" x={0} y={0} />);
        return glyphs.map((g, i) => (
          <g key={i} transform={`translate(${6 + i * 16}, 6)`}>
            {g}
          </g>
        ));
      })()}
      {node.request && <RequestRibbon width={node.width} />}
      {(() => {
        // Badges esquina inferior-derecha: se apilan hacia la izquierda.
        const y = node.height - 17;
        const slots: Array<(x: number) => ReactNode> = [];
        if (node.files?.length)
          slots.push((x) => <FileBadge key="f" x={x} y={y} count={node.files!.length} files={node.files!} />);
        if (node.tests?.length)
          slots.push((x) => <TestsBadge key="t" x={x} y={y} count={node.tests!.length} tests={node.tests!} />);
        if (node.assets?.length)
          slots.push((x) => <AssetsBadge key="a" x={x} y={y} count={node.assets!.length} assets={node.assets!} />);
        return slots.map((render, i) => render(node.width - 17 - 19 * i));
      })()}
      {/* Estado de implementacion: pill obvia con texto + color, abajo del nodo */}
      {node.status && <StatusPill cx={node.width / 2} y={node.height + 4} status={node.status} />}
      {showHandles && onResizeStart && node.shape !== 'note' && (
        <ResizeHandles width={node.width} height={node.height} onStart={onResizeStart} />
      )}
    </g>
  );
}

function ProgressBadge({
  x,
  y,
  done,
  onClick,
}: {
  x: number;
  y: number;
  done: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <g
      transform={`translate(${x}, ${y})`}
      className="progress-badge"
      data-resize-handle="true"
      onClick={onClick}
    >
      <rect width={12} height={12} rx={3} className="progress-box" />
      {done && (
        <path d="M 2 6 L 5 9 L 10 3" className="progress-check" fill="none" />
      )}
    </g>
  );
}

function LabelChips({
  labels,
  maxWidth,
  x,
  y,
}: {
  labels: string[];
  maxWidth: number;
  x: number;
  y: number;
}) {
  // Approximate width per char @ 9px font; chips wrap when overflow.
  const PAD_X = 6;
  const CHAR_W = 5.4;
  const CHIP_H = 16;
  const GAP = 4;
  let curX = 0;
  let curY = 0;
  const positions: Array<{ x: number; y: number; w: number; label: string }> = [];
  for (const l of labels) {
    const def = labelDef(l);
    const w = Math.max(28, def.display.length * CHAR_W + PAD_X * 2);
    if (curX + w > maxWidth && curX > 0) {
      curX = 0;
      curY -= CHIP_H + GAP;
    }
    positions.push({ x: curX, y: curY, w, label: l });
    curX += w + GAP;
  }
  return (
    <g
      className="label-chips"
      transform={`translate(${x}, ${y})`}
      pointerEvents="none"
    >
      {positions.map((p, i) => {
        const def = labelDef(p.label);
        return (
          <g key={i} transform={`translate(${p.x}, ${p.y})`}>
            <rect
              width={p.w}
              height={CHIP_H}
              rx={CHIP_H / 2}
              ry={CHIP_H / 2}
              fill={def.bg}
              stroke={def.fg}
              strokeWidth={0.8}
              strokeOpacity={0.35}
            />
            <text
              x={p.w / 2}
              y={CHIP_H / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fontWeight={600}
              fontFamily="ui-monospace, Menlo, Consolas, monospace"
              fill={def.fg}
            >
              {def.display}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ContentIcon({ x, y }: { x: number; y: number }) {
  return (
    <g className="node-content-icon" transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect width={11} height={13} rx={1.5} />
      <line x1={3} y1={4} x2={8} y2={4} />
      <line x1={3} y1={7} x2={8} y2={7} />
      <line x1={3} y1={10} x2={6} y2={10} />
    </g>
  );
}

// Simbolo (prohibido) que marca un nodo excluido del prompt generator (tecla N).
function PromptHiddenIcon({ x, y }: { x: number; y: number }) {
  return (
    <g className="node-prompt-hidden-icon" transform={`translate(${x}, ${y})`}>
      <title>Excluido del prompt generator (N)</title>
      <circle cx={5.5} cy={6} r={5.5} />
      <line x1={1.8} y1={9.7} x2={9.2} y2={2.3} />
    </g>
  );
}

// Pill de estado de implementacion (todo/wip/done/blocked): texto + color,
// centrada debajo del nodo para que sea bien visible. Color via CSS.
function StatusPill({ cx, y, status }: { cx: number; y: number; status: string }) {
  const text = status.toUpperCase();
  const w = Math.max(38, text.length * 7 + 14);
  return (
    <g
      className={`node-status-pill status-${status}`}
      transform={`translate(${cx - w / 2}, ${y})`}
      pointerEvents="none"
    >
      <title>estado: {status}</title>
      <rect width={w} height={16} rx={8} />
      <text
        x={w / 2}
        y={8.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {text}
      </text>
    </g>
  );
}

// Cinta en la esquina sup-derecha que marca un nodo "pedido" (request, tecla R).
function RequestRibbon({ width }: { width: number }) {
  return (
    <g className="node-request-ribbon" pointerEvents="none">
      <title>Pedido (request) — pendiente de implementar</title>
      <path d={`M ${width - 16} 0 L ${width} 0 L ${width} 16 Z`} />
    </g>
  );
}

// Badge de archivos vinculados (clip + contador). Tooltip con los paths.
function FileBadge({
  x,
  y,
  count,
  files,
}: {
  x: number;
  y: number;
  count: number;
  files: string[];
}) {
  return (
    <g className="node-file-badge" transform={`translate(${x}, ${y})`} pointerEvents="none">
      <title>{`archivos vinculados:\n${files.join('\n')}`}</title>
      <path
        className="node-file-clip"
        d="M9 4.5 L9 10 a3 3 0 0 1 -6 0 L3 3 a2 2 0 0 1 4 0 L7 9 a1 1 0 0 1 -2 0 L5 4.5"
        fill="none"
      />
      {count > 1 && (
        <text className="node-file-count" x={12} y={6} fontSize={8} fontWeight={700}>
          {count}
        </text>
      )}
    </g>
  );
}

// Badge de matraz: archivos de test que cubren el nodo (attr `tests`).
function TestsBadge({
  x,
  y,
  count,
  tests,
}: {
  x: number;
  y: number;
  count: number;
  tests: string[];
}) {
  return (
    <g className="node-tests-badge" transform={`translate(${x}, ${y})`} pointerEvents="none">
      <title>{`tests:\n${tests.join('\n')}`}</title>
      <path className="node-tests-flask" d="M6 1.5 L6 5 L9.5 11.5 a1.5 1.5 0 0 1 -1.3 2.2 L3.8 13.7 a1.5 1.5 0 0 1 -1.3 -2.2 L6 5" fill="none" />
      <line className="node-tests-flask" x1={4.5} y1={1.5} x2={7.5} y2={1.5} />
      {count > 1 && (
        <text className="node-tests-count" x={12} y={5} fontSize={8} fontWeight={700}>
          {count}
        </text>
      )}
    </g>
  );
}

// Badge de evidencia/avance: archivos subidos por el usuario (attr `assets`).
// Icono de claqueta/pelicula (videos son el caso tipico de progreso).
function AssetsBadge({
  x,
  y,
  count,
  assets,
}: {
  x: number;
  y: number;
  count: number;
  assets: string[];
}) {
  return (
    <g className="node-assets-badge" transform={`translate(${x}, ${y})`} pointerEvents="none">
      <title>{`evidencia / avance:\n${assets.join('\n')}`}</title>
      <rect className="node-assets-film" x={1.5} y={3} width={9} height={8} rx={1.2} fill="none" />
      <path className="node-assets-play" d="M4.5 5.5 L7.5 7 L4.5 8.5 Z" />
      {count > 1 && (
        <text className="node-assets-count" x={12} y={6} fontSize={8} fontWeight={700}>
          {count}
        </text>
      )}
    </g>
  );
}

function QuantityBadge({
  x,
  y,
  value,
}: {
  x: number;
  y: number;
  value: number;
}) {
  const text = String(value);
  const w = Math.max(20, text.length * 7 + 8);
  return (
    <g transform={`translate(${x}, ${y})`} className="quantity-badge" pointerEvents="none">
      <rect width={w} height={16} rx={8} className="quantity-bg" />
      <text
        x={w / 2}
        y={8}
        textAnchor="middle"
        dominantBaseline="central"
        className="quantity-text"
        fontSize={10}
        fontFamily="ui-monospace, Menlo, Consolas, monospace"
        fontWeight={600}
      >
        {text}
      </text>
    </g>
  );
}

function ListContents({ node }: { node: LayoutNode }) {
  const items = node.items ?? [];
  const HEADER_H = 30;
  const ROW_H = 22;
  const w = node.width;
  const style = node.listStyle ?? 'bullets';
  return (
    <>
      <text
        className="node-label"
        x={w / 2}
        y={HEADER_H / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {node.label}
      </text>
      <line
        className="node-divider"
        x1={6}
        y1={HEADER_H}
        x2={w - 6}
        y2={HEADER_H}
      />
      {items.map((item, i) => {
        const prefix = style === 'numbered' ? `${i + 1}.` : '•';
        return (
          <text
            key={i}
            className="node-label"
            x={12}
            y={HEADER_H + i * ROW_H + ROW_H / 2}
            textAnchor="start"
            dominantBaseline="central"
            fontSize={12}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {prefix} {item}
          </text>
        );
      })}
    </>
  );
}

function ImageContents({ node }: { node: LayoutNode }) {
  const w = node.width;
  const h = node.height;
  const src = node.src ?? '';
  const HEADER_H = node.label ? 22 : 0;
  if (!src) {
    return (
      <>
        <text
          className="node-label"
          x={w / 2}
          y={h / 2 - 8}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
        >
          (sin imagen)
        </text>
        <text
          className="node-label"
          x={w / 2}
          y={h / 2 + 10}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {node.label}
        </text>
      </>
    );
  }
  return (
    <>
      <image
        href={src}
        x={4}
        y={HEADER_H + 4}
        width={w - 8}
        height={h - HEADER_H - 8}
        preserveAspectRatio="xMidYMid meet"
        pointerEvents="none"
      />
      {HEADER_H > 0 && (
        <text
          className="node-label"
          x={w / 2}
          y={HEADER_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={600}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {node.label}
        </text>
      )}
    </>
  );
}

// Nodo "buzon de progreso" (shape: upload): icono de subida + label + contador
// de archivos subidos / pedidos por el modelo. Doble-click abre su interfaz.
function UploadContents({ node }: { node: LayoutNode }) {
  const w = node.width;
  const uploaded = node.assets?.length ?? 0;
  const requested = node.items?.length ?? 0;
  return (
    <>
      <g transform={`translate(${w / 2 - 9}, 14)`} className="node-upload-icon">
        <path
          d="M9 1.5 L9 11 M9 1.5 L5 5.5 M9 1.5 L13 5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M1.5 10 L1.5 15.5 a1 1 0 0 0 1 1 L15.5 16.5 a1 1 0 0 0 1 -1 L16.5 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <text
        className="node-label"
        x={w / 2}
        y={50}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {node.label}
      </text>
      <text
        className="node-upload-count"
        x={w / 2}
        y={72}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {uploaded} subido{uploaded === 1 ? '' : 's'}
        {requested > 0 ? ` · ${requested} pedido${requested === 1 ? '' : 's'}` : ''}
      </text>
    </>
  );
}

function NoteContents({ node }: { node: LayoutNode }) {
  const w = node.width;
  const h = node.height;
  if (!node.expanded) {
    // Tiny pill: just label with a note glyph indicator
    return (
      <>
        <text
          className="node-icon"
          x={10}
          y={h / 2}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={11}
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
        >
          note
        </text>
        <text
          className="node-label"
          x={w - 8}
          y={h / 2}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={12}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {node.label}
        </text>
      </>
    );
  }
  const HEADER_H = 28;
  const PAD = 12;
  return (
    <>
      <text
        className="node-label"
        x={PAD}
        y={HEADER_H / 2}
        textAnchor="start"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {node.label}
      </text>
      <line
        className="node-divider"
        x1={6}
        y1={HEADER_H}
        x2={w - 6}
        y2={HEADER_H}
      />
      <foreignObject
        x={PAD}
        y={HEADER_H + 4}
        width={w - PAD * 2}
        height={h - HEADER_H - PAD}
      >
        <div className="note-content">{node.content ?? ''}</div>
      </foreignObject>
    </>
  );
}

function ResizeHandles({
  width,
  height,
  onStart,
}: {
  width: number;
  height: number;
  onStart: (corner: ResizeCorner, e: React.PointerEvent) => void;
}) {
  const size = 8;
  const half = size / 2;
  const handles: { corner: ResizeCorner; x: number; y: number; cursor: string }[] = [
    { corner: 'nw', x: -half, y: -half, cursor: 'nwse-resize' },
    { corner: 'ne', x: width - half, y: -half, cursor: 'nesw-resize' },
    { corner: 'se', x: width - half, y: height - half, cursor: 'nwse-resize' },
    { corner: 'sw', x: -half, y: height - half, cursor: 'nesw-resize' },
  ];
  return (
    <g className="resize-handles">
      {handles.map((h) => (
        <rect
          key={h.corner}
          className="resize-handle"
          data-resize-handle="true"
          x={h.x}
          y={h.y}
          width={size}
          height={size}
          style={{ cursor: h.cursor }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onStart(h.corner, e);
          }}
        />
      ))}
    </g>
  );
}

function NodeShape({ node }: { node: LayoutNode }) {
  const w = node.width;
  const h = node.height;

  switch (node.shape) {
    case 'rectangle':
      return <rect className="node-shape" width={w} height={h} rx={6} ry={6} />;
    case 'ellipse':
      return (
        <ellipse className="node-shape" cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} />
      );
    case 'circle': {
      const r = Math.min(w, h) / 2;
      return <circle className="node-shape" cx={w / 2} cy={h / 2} r={r} />;
    }
    case 'diamond': {
      const points = `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
      return <polygon className="node-shape" points={points} />;
    }
    case 'hexagon': {
      const off = Math.min(20, h / 2);
      const points = `${off},0 ${w - off},0 ${w},${h / 2} ${w - off},${h} ${off},${h} 0,${h / 2}`;
      return <polygon className="node-shape" points={points} />;
    }
    case 'cylinder': {
      const ry = Math.min(8, h / 5);
      return (
        <g>
          <path
            className="node-shape"
            d={`M 0 ${ry} L 0 ${h - ry} A ${w / 2} ${ry} 0 0 0 ${w} ${h - ry} L ${w} ${ry} A ${w / 2} ${ry} 0 0 0 0 ${ry} Z`}
          />
          <ellipse className="node-shape" cx={w / 2} cy={ry} rx={w / 2} ry={ry} />
        </g>
      );
    }
    case 'list':
      return <rect className="node-shape" width={w} height={h} rx={6} ry={6} />;
    case 'image':
      return <rect className="node-shape" width={w} height={h} rx={6} ry={6} />;
    case 'upload':
      return <rect className="node-shape node-upload-shape" width={w} height={h} rx={8} ry={8} />;
    case 'note':
      // Folded-corner note shape: rectangle with a tiny triangle cut from top-right
      return (
        <g>
          <path
            className="node-shape"
            d={`M 6 0 L ${w - 10} 0 L ${w} 10 L ${w} ${h - 6} Q ${w} ${h} ${w - 6} ${h} L 6 ${h} Q 0 ${h} 0 ${h - 6} L 0 6 Q 0 0 6 0 Z`}
          />
          <path
            className="note-fold"
            d={`M ${w - 10} 0 L ${w} 10 L ${w - 10} 10 Z`}
          />
        </g>
      );
  }
}
