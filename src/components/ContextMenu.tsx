import { useEffect, useRef, useState } from 'react';
import type { Shape } from '../parser/types';
import { SHAPES } from '../parser/types';

const PALETTES = {
  pastels: [
    '#ffffff',
    '#fee2e2',
    '#fef3c7',
    '#dcfce7',
    '#dbeafe',
    '#ede9fe',
    '#fce7f3',
    '#e2e8f0',
  ],
  tailwind: [
    '#0f172a',
    '#dc2626',
    '#f59e0b',
    '#16a34a',
    '#0891b2',
    '#2563eb',
    '#7c3aed',
    '#db2777',
  ],
  grays: [
    '#ffffff',
    '#f1f5f9',
    '#cbd5e1',
    '#94a3b8',
    '#64748b',
    '#475569',
    '#1e293b',
    '#0f172a',
  ],
};

type Tab = 'fill' | 'text' | 'stroke' | 'shape';

export type Placement = 'top' | 'bottom';

const ICON_PRESETS = [
  'user',
  'database',
  'server',
  'globe',
  'lock',
  'api',
  'code',
  'file',
  'aws-ec2',
  'aws-rds',
  'aws-s3',
  'aws-lambda',
];

export function ContextMenu({
  x,
  y,
  placement,
  currentColor,
  currentTextColor,
  currentStrokeColor,
  currentStrokeWidth,
  currentShape,
  currentIcon,
  recentColors,
  usedColors,
  onColorChange,
  onTextColorChange,
  onStrokeColorChange,
  onStrokeWidthChange,
  onShapeChange,
  onIconChange,
  onClearColor,
  onClearTextColor,
  onClearStroke,
  onClearIcon,
  onResetSize,
  onAutoContrast,
  onDelete,
  onDuplicate,
}: {
  x: number;
  y: number;
  placement: Placement;
  currentColor?: string;
  currentTextColor?: string;
  currentStrokeColor?: string;
  currentStrokeWidth?: number;
  currentShape?: Shape;
  currentIcon?: string;
  recentColors: string[];
  usedColors: string[];
  onColorChange: (color: string) => void;
  onTextColorChange: (color: string) => void;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (w: number) => void;
  onShapeChange: (s: Shape) => void;
  onIconChange: (v: string) => void;
  onClearColor: () => void;
  onClearTextColor: () => void;
  onClearStroke: () => void;
  onClearIcon: () => void;
  onResetSize: () => void;
  onAutoContrast: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [tab, setTab] = useState<Tab>('fill');

  return (
    <div
      className={`context-menu placement-${placement}`}
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="context-menu-tabs">
        {(['fill', 'text', 'stroke', 'shape'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`context-tab ${tab === t ? 'is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="context-menu-body">
        {tab === 'fill' && (
          <ColorTab
            current={currentColor}
            recent={recentColors}
            used={usedColors}
            onPick={onColorChange}
            onClear={onClearColor}
            extraAction={
              <button
                type="button"
                className="context-action subtle"
                onClick={onAutoContrast}
                title="Calcula texto blanco/negro segun el fill"
              >
                auto-contrast text
              </button>
            }
          />
        )}
        {tab === 'text' && (
          <ColorTab
            current={currentTextColor}
            recent={recentColors}
            used={usedColors}
            onPick={onTextColorChange}
            onClear={onClearTextColor}
          />
        )}
        {tab === 'stroke' && (
          <>
            <ColorTab
              current={currentStrokeColor}
              recent={recentColors}
              used={usedColors}
              onPick={onStrokeColorChange}
              onClear={onClearStroke}
            />
            <div className="slider-row">
              <span className="slider-label">width</span>
              <input
                type="range"
                min="0"
                max="6"
                step="0.5"
                value={currentStrokeWidth ?? 1.5}
                onChange={(e) => onStrokeWidthChange(parseFloat(e.target.value))}
              />
              <span className="slider-value">
                {(currentStrokeWidth ?? 1.5).toFixed(1)}px
              </span>
            </div>
          </>
        )}
        {tab === 'shape' && (
          <ShapeTab
            current={currentShape}
            currentIcon={currentIcon}
            onPick={onShapeChange}
            onIconChange={onIconChange}
            onClearIcon={onClearIcon}
            onResetSize={onResetSize}
          />
        )}
      </div>
      <div className="context-menu-actions">
        <button
          type="button"
          className="context-action"
          onClick={onDuplicate}
          title="Duplicar (Ctrl+D)"
        >
          duplicate
        </button>
        <button
          type="button"
          className="context-action danger"
          onClick={onDelete}
          title="Eliminar (Delete)"
        >
          delete
        </button>
      </div>
    </div>
  );
}

function ColorTab({
  current,
  recent,
  used,
  onPick,
  onClear,
  extraAction,
}: {
  current?: string;
  recent: string[];
  used: string[];
  onPick: (c: string) => void;
  onClear: () => void;
  extraAction?: React.ReactNode;
}) {
  const [hexValue, setHexValue] = useState(current ?? '');
  const [showAll, setShowAll] = useState(false);
  const hexRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHexValue(current ?? '');
  }, [current]);

  const tryApplyHex = (raw: string) => {
    let v = raw.trim();
    if (!v) return;
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    }
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onPick(v.toLowerCase());
  };

  // Combined quick row: used (up to 4) + recent (up to 4)
  const quick: string[] = [];
  for (const c of used) {
    if (quick.length >= 4) break;
    if (!quick.includes(c.toLowerCase())) quick.push(c.toLowerCase());
  }
  for (const c of recent) {
    if (quick.length >= 8) break;
    if (!quick.includes(c.toLowerCase())) quick.push(c.toLowerCase());
  }

  return (
    <>
      {quick.length > 0 && (
        <ColorRow
          label="recientes"
          presets={quick}
          current={current}
          onPick={onPick}
        />
      )}
      <ColorRow
        label="pastels"
        presets={PALETTES.pastels}
        current={current}
        onPick={onPick}
      />
      {showAll && (
        <>
          <ColorRow
            label="tailwind"
            presets={PALETTES.tailwind}
            current={current}
            onPick={onPick}
          />
          <ColorRow
            label="grays"
            presets={PALETTES.grays}
            current={current}
            onPick={onPick}
          />
        </>
      )}
      {!showAll && (
        <button
          type="button"
          className="more-palettes"
          onClick={() => setShowAll(true)}
        >
          + tailwind / grays
        </button>
      )}
      <div className="hex-row">
        <input
          ref={hexRef}
          type="text"
          className="hex-input"
          value={hexValue}
          placeholder="#aabbcc"
          maxLength={7}
          onChange={(e) => setHexValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              tryApplyHex(hexValue);
            }
          }}
          onBlur={() => tryApplyHex(hexValue)}
        />
        <label className="color-swatch color-custom" title="Color custom">
          <input
            type="color"
            value={current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#000000'}
            onChange={(e) => onPick(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="hex-clear"
          onClick={onClear}
          title="Quitar color"
        >
          x
        </button>
      </div>
      {extraAction}
    </>
  );
}

function ColorRow({
  label,
  presets,
  current,
  onPick,
}: {
  label: string;
  presets: string[];
  current?: string;
  onPick: (c: string) => void;
}) {
  return (
    <div className="palette-row">
      <span className="palette-row-label">{label}</span>
      <div className="palette-row-swatches">
        {presets.map((c, i) => (
          <button
            key={`${c}-${i}`}
            type="button"
            className={`color-swatch ${current?.toLowerCase() === c.toLowerCase() ? 'is-active' : ''}`}
            style={{ background: c }}
            onClick={() => onPick(c)}
            aria-label={c}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

function ShapeTab({
  current,
  currentIcon,
  onPick,
  onIconChange,
  onClearIcon,
  onResetSize,
}: {
  current?: Shape;
  currentIcon?: string;
  onPick: (s: Shape) => void;
  onIconChange: (v: string) => void;
  onClearIcon: () => void;
  onResetSize: () => void;
}) {
  const [iconValue, setIconValue] = useState(currentIcon ?? '');
  useEffect(() => {
    setIconValue(currentIcon ?? '');
  }, [currentIcon]);

  const applyIcon = (v: string) => {
    const trimmed = v.trim();
    if (trimmed) onIconChange(trimmed);
    else onClearIcon();
  };

  return (
    <>
      <div className="shape-grid">
        {SHAPES.map((s) => (
          <button
            key={s}
            type="button"
            className={`shape-tile ${current === s ? 'is-active' : ''}`}
            onClick={() => onPick(s)}
            title={s}
          >
            <ShapeMini shape={s} />
            <span>{s}</span>
          </button>
        ))}
      </div>
      <div className="palette-row">
        <span className="palette-row-label">icon</span>
        <div className="hex-row">
          <input
            type="text"
            className="hex-input"
            value={iconValue}
            placeholder="aws-ec2, user, db..."
            onChange={(e) => setIconValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyIcon(iconValue);
              }
            }}
            onBlur={() => applyIcon(iconValue)}
          />
          <button
            type="button"
            className="hex-clear"
            onClick={() => {
              setIconValue('');
              onClearIcon();
            }}
            title="Quitar icon"
          >
            x
          </button>
        </div>
        <div className="icon-presets">
          {ICON_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={`icon-chip ${currentIcon === p ? 'is-active' : ''}`}
              onClick={() => {
                setIconValue(p);
                onIconChange(p);
              }}
              title={p}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="context-action subtle"
        onClick={onResetSize}
        title="Vuelve al tamano automatico"
      >
        reset size
      </button>
    </>
  );
}

function ShapeMini({ shape }: { shape: Shape }) {
  const c = 'currentColor';
  switch (shape) {
    case 'rectangle':
      return (
        <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
          <rect x="1" y="1" width="18" height="10" rx="2" stroke={c} strokeWidth="1.5" />
        </svg>
      );
    case 'ellipse':
      return (
        <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
          <ellipse cx="10" cy="6" rx="9" ry="5" stroke={c} strokeWidth="1.5" />
        </svg>
      );
    case 'circle':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke={c} strokeWidth="1.5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
          <polygon points="10,1 19,8 10,15 1,8" stroke={c} strokeWidth="1.5" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
          <polygon points="5,1 15,1 19,6 15,11 5,11 1,6" stroke={c} strokeWidth="1.5" />
        </svg>
      );
    case 'cylinder':
      return (
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
          <path d="M2 5 L2 13 A 8 2 0 0 0 18 13 L18 5" stroke={c} strokeWidth="1.5" fill="none" />
          <ellipse cx="10" cy="5" rx="8" ry="2" stroke={c} strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'list':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
          <rect x="1" y="1" width="18" height="12" rx="2" stroke={c} strokeWidth="1.5" />
          <line x1="3" y1="5" x2="17" y2="5" stroke={c} strokeWidth="1" />
          <line x1="3" y1="8" x2="13" y2="8" stroke={c} strokeWidth="1" />
          <line x1="3" y1="10" x2="15" y2="10" stroke={c} strokeWidth="1" />
        </svg>
      );
    case 'note':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
          <path
            d="M2 1 L14 1 L19 5 L19 13 L2 13 Z"
            stroke={c}
            strokeWidth="1.5"
          />
          <path d="M14 1 L14 5 L19 5" stroke={c} strokeWidth="1" />
        </svg>
      );
  }
}
