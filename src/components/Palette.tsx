import type { Shape } from '../parser/types';
import { SHAPES } from '../parser/types';

export type Tool = 'select' | 'connect' | Shape;

const SHAPE_LABELS: Record<Shape, string> = {
  rectangle: 'Rect',
  ellipse: 'Ellipse',
  circle: 'Circle',
  diamond: 'Diamond',
  cylinder: 'DB',
  hexagon: 'Hex',
  list: 'List',
  note: 'Note',
  image: 'Image',
  upload: 'Buzon',
};

export function Palette({
  tool,
  onSelect,
  connectFromId,
}: {
  tool: Tool;
  onSelect: (t: Tool) => void;
  connectFromId: string | null;
}) {
  return (
    <div className="palette">
      <button
        type="button"
        className={`palette-btn ${tool === 'select' ? 'is-active' : ''}`}
        onClick={() => onSelect('select')}
        title="Seleccionar / arrastrar (Esc)"
      >
        <ArrowIcon />
      </button>
      <div className="palette-divider" />
      {SHAPES.map((s) => (
        <button
          key={s}
          type="button"
          className={`palette-btn ${tool === s ? 'is-active' : ''}`}
          onClick={() => onSelect(s)}
          title={`Agregar ${s} (click en canvas)`}
        >
          <ShapePreview shape={s} />
          <span className="palette-label">{SHAPE_LABELS[s]}</span>
        </button>
      ))}
      <div className="palette-divider" />
      <button
        type="button"
        className={`palette-btn ${tool === 'connect' ? 'is-active' : ''}`}
        onClick={() => onSelect('connect')}
        title="Conectar nodos (click 2 nodos)"
      >
        <ConnectIcon />
        <span className="palette-label">
          {tool === 'connect' && connectFromId ? `from ${connectFromId}` : 'Connect'}
        </span>
      </button>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 2 L13 8 L8 9 L7 14 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConnectIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
      <circle cx="3" cy="8" r="2.5" fill="currentColor" />
      <line
        x1="5.5"
        y1="8"
        x2="14.5"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M14 5 L17 8 L14 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShapePreview({ shape }: { shape: Shape }) {
  const stroke = 'currentColor';
  switch (shape) {
    case 'rectangle':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14">
          <rect
            x="1.5"
            y="1.5"
            width="17"
            height="11"
            rx="2"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'ellipse':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14">
          <ellipse
            cx="10"
            cy="7"
            rx="8.5"
            ry="5.5"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'circle':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle
            cx="8"
            cy="8"
            r="6.5"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'diamond':
      return (
        <svg width="20" height="16" viewBox="0 0 20 16">
          <polygon
            points="10,1 19,8 10,15 1,8"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'hexagon':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14">
          <polygon
            points="5,1 15,1 19,7 15,13 5,13 1,7"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'cylinder':
      return (
        <svg width="20" height="16" viewBox="0 0 20 16">
          <path
            d="M2 4 L2 12 A 8 2 0 0 0 18 12 L18 4"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <ellipse
            cx="10"
            cy="4"
            rx="8"
            ry="2"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'list':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14">
          <rect
            x="1.5"
            y="1.5"
            width="17"
            height="11"
            rx="2"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <line x1="3" y1="5" x2="17" y2="5" stroke={stroke} strokeWidth="1" />
          <line x1="3" y1="8" x2="13" y2="8" stroke={stroke} strokeWidth="1" />
          <line x1="3" y1="10" x2="15" y2="10" stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case 'note':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14">
          <path
            d="M2 1 L14 1 L19 5 L19 13 L2 13 Z"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <path d="M14 1 L14 5 L19 5" fill="none" stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case 'image':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14">
          <rect
            x="1.5"
            y="1.5"
            width="17"
            height="11"
            rx="2"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <circle cx="6" cy="6" r="1.5" fill={stroke} />
          <path
            d="M2 12 L7 8 L11 11 L14 9 L18 12"
            fill="none"
            stroke={stroke}
            strokeWidth="1.2"
          />
        </svg>
      );
    case 'upload':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2 L8 10 M8 2 L5 5 M8 2 L11 5"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2.5 10 L2.5 13.5 L13.5 13.5 L13.5 10"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}
