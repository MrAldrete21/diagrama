import type { ReactNode } from 'react';

// Barra compacta de atajos, pegada a la derecha de la paleta.
// Cada item: iconito + la tecla (cheat-sheet siempre visible).
// Los items contextuales disparan el MISMO handler que el teclado via un
// KeyboardEvent sintetico (sin duplicar logica). Los de WASD son referencia
// (direccionales: se usan con el teclado).

type Item = {
  label: string;
  combo?: string;
  icon: ReactNode;
  onClick?: () => void;
  ref?: boolean;
};

const fireKey = (init: KeyboardEventInit) => () =>
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

export function ShortcutBar({
  onSearch,
  onSolver,
  onPrompt,
  onExamples,
  onLint,
  onSnapshots,
}: {
  onSearch: () => void;
  onSolver: () => void;
  onPrompt: () => void;
  onExamples: () => void;
  onLint: () => void;
  onSnapshots: () => void;
}) {
  const groups: Item[][] = [
    [
      { label: 'Buscar nodos', combo: 'Ctrl+K', icon: <SearchIcon />, onClick: onSearch },
      { label: 'Solver', combo: '⇧P', icon: <SolverIcon />, onClick: onSolver },
      { label: 'Generar prompt', combo: '⇧G', icon: <PromptIcon />, onClick: onPrompt },
      { label: 'Lint del diagrama', icon: <LintIcon />, onClick: onLint },
      { label: 'Snapshots / versiones', icon: <SnapshotIcon />, onClick: onSnapshots },
      { label: 'Ejemplos', icon: <ExamplesIcon />, onClick: onExamples },
    ],
    [
      { label: 'Editar label', combo: '⇧Q', icon: <EditIcon />, onClick: fireKey({ code: 'KeyQ', key: 'q', shiftKey: true }) },
      { label: 'Editar y vaciar', combo: '⇧E', icon: <EditClearIcon />, onClick: fireKey({ code: 'KeyE', key: 'e', shiftKey: true }) },
      { label: 'Labels (Feature, Goal...)', combo: '⇧F', icon: <TagIcon />, onClick: fireKey({ code: 'KeyF', key: 'F', shiftKey: true }) },
      { label: 'Constraints', combo: '⇧R', icon: <ConstraintIcon />, onClick: fireKey({ code: 'KeyR', key: 'r', shiftKey: true }) },
      { label: 'Contenido interno', combo: '⇧T', icon: <ContentIcon />, onClick: fireKey({ code: 'KeyT', key: 't', shiftKey: true }) },
    ],
    [
      { label: 'Auto-focus', combo: '⇧1', icon: <TargetIcon />, onClick: fireKey({ code: 'Digit1', key: '1', shiftKey: true }) },
      { label: 'Menu de personalizacion', combo: '⇧2', icon: <SlidersIcon />, onClick: fireKey({ code: 'Digit2', key: '2', shiftKey: true }) },
      { label: 'Bloque (lista / nota)', combo: '⇧3', icon: <ListIcon />, onClick: fireKey({ code: 'Digit3', key: '3', shiftKey: true }) },
      { label: 'Atributos (progress, qty, icon)', combo: '⇧4', icon: <BadgeIcon />, onClick: fireKey({ code: 'Digit4', key: '4', shiftKey: true }) },
    ],
    [
      { label: 'Navegar entre nodos', combo: 'WASD', icon: <PadIcon />, ref: true },
      { label: 'Crear nodo conectado', combo: '⇧WASD', icon: <PlusNodeIcon />, ref: true },
    ],
  ];

  return (
    <div className="shortcut-bar">
      {groups.flatMap((group, gi) => [
        gi > 0 ? <div key={`div-${gi}`} className="palette-divider" /> : null,
        ...group.map((it) => {
          const title = it.combo ? `${it.label} (${it.combo})` : it.label;
          const body = (
            <>
              {it.icon}
              {it.combo && <kbd className="shortcut-kbd">{it.combo}</kbd>}
            </>
          );
          return it.ref ? (
            <div key={it.label} className="shortcut-btn shortcut-ref" title={title}>
              {body}
            </div>
          ) : (
            <button
              key={it.label}
              type="button"
              className="shortcut-btn"
              onClick={it.onClick}
              title={title}
            >
              {body}
            </button>
          );
        }),
      ])}
    </div>
  );
}

const SZ = 15;

function SearchIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SolverIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <path d="M8 1 L9.4 6.6 L15 8 L9.4 9.4 L8 15 L6.6 9.4 L1 8 L6.6 6.6 Z" fill="currentColor" />
    </svg>
  );
}

function PromptIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 6 L6 8 L4 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="7.5" y1="10.5" x2="11" y2="10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function LintIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5 L14.5 13 L1.5 13 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <line x1="8" y1="6" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
    </svg>
  );
}

function SnapshotIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.5 V8 L10.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExamplesIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <path d="M10.5 2.5 L13.5 5.5 L5.5 13.5 L2.5 13.5 L2.5 10.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function EditClearIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <path d="M11 5 L14 8 L7.5 14 L4.5 14 L4.5 11 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M1.5 1.5 L4.5 4.5 M4.5 1.5 L1.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <path d="M2 2 H8 L14 8 L8 14 L2 8 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="5.5" y1="5.5" x2="10.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="5.5" y1="8" x2="10.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="5.5" y1="10.5" x2="8.5" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ConstraintIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 7 V5 a3 3 0 0 1 6 0 V7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <line x1="2" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="2" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6" cy="5" r="1.8" fill="var(--palette-bg)" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10" cy="11" r="1.8" fill="var(--palette-bg)" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <line x1="3" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="3" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 8 L7 10 L11 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PadIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1 L10.2 4 L5.8 4 Z" />
      <path d="M8 15 L5.8 12 L10.2 12 Z" />
      <path d="M1 8 L4 5.8 L4 10.2 Z" />
      <path d="M15 8 L12 10.2 L12 5.8 Z" />
    </svg>
  );
}

function PlusNodeIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="5" width="7.5" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <line x1="12.5" y1="3.5" x2="12.5" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9.5" y1="6.5" x2="15.5" y2="6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
