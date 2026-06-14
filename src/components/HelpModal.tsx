import type { ReactNode } from 'react';

type Shortcut = { keys: string; desc: string };
type Group = { title: string; icon: ReactNode; items: Shortcut[] };

// Iconitos chicos para escanear cada grupo de un vistazo.
const I = (d: string, fill = false) => (
  <svg className="help-ico" width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path
      d={d}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={fill ? 'currentColor' : 'none'}
    />
  </svg>
);
const IcoNav = I('M8 1 L10 4 L6 4 Z M8 15 L6 12 L10 12 Z M1 8 L4 6 L4 10 Z M15 8 L12 10 L12 6 Z', true);
const IcoEdit = I('M10.5 2.5 L13.5 5.5 L5.5 13.5 L2.5 13.5 L2.5 10.5 Z');
const IcoMenu = I('M2 4 H14 M2 8 H14 M2 12 H10');
const IcoAlign = I('M2 2 V14 M5 4 H13 M5 8 H10 M5 12 H13');
const IcoFile = I('M4 1.5 H10 L13 4.5 V14 H4 Z M10 1.5 V4.5 H13');
const IcoClip = I('M5.5 2 H10.5 V4 H5.5 Z M4 3 H3 V14 H13 V3 H12');
const IcoView = I('M1 8 C3 4 13 4 15 8 C13 12 3 12 1 8 Z M8 6 a2 2 0 1 0 0.01 0');
const IcoSyntax = I('M6 4 L2.5 8 L6 12 M10 4 L13.5 8 L10 12');

const GROUPS: Group[] = [
  {
    title: 'Navegacion',
    icon: IcoNav,
    items: [
      { keys: 'W A S D', desc: 'Mover seleccion al vecino (arriba / izq / abajo / der). Tras Esc retoma del ultimo nodo.' },
      { keys: 'Ctrl + A', desc: 'Seleccionar todo' },
      { keys: 'Shift + click', desc: 'Multi-select' },
      { keys: 'Shift + drag', desc: 'Marquee (rectangulo de seleccion)' },
      { keys: 'Esc', desc: 'Deselect / cancelar / cerrar menus' },
    ],
  },
  {
    title: 'Crear / editar',
    icon: IcoEdit,
    items: [
      { keys: 'Shift + W A S D', desc: 'Crear nodo conectado en esa direccion' },
      { keys: 'F + W A S D', desc: 'Crear nodo + elegir su label' },
      { keys: 'Shift + Q / Shift + E', desc: 'Editar label (mantener / vaciar texto)' },
      { keys: 'Doble-click', desc: 'Editar label inline' },
      { keys: '/ + W A S D', desc: 'Nudge del nodo 20px (1 grid)' },
      { keys: 'Delete', desc: 'Eliminar nodo(s) o edge' },
    ],
  },
  {
    title: 'Menus del nodo',
    icon: IcoMenu,
    items: [
      { keys: 'Shift + 2', desc: 'Personalizar (color, shape, icono)' },
      { keys: 'Shift + 3', desc: 'Bloque: lista / note / image / buzon' },
      { keys: 'Shift + F', desc: 'Labels (Feature, Goal, Ai decision, Review…)' },
      { keys: 'M / R', desc: 'Ciclar estado (todo/wip/done) / toggle pedido' },
      { keys: 'Shift + L / Shift + J', desc: 'Archivos / tests del nodo' },
    ],
  },
  {
    title: 'Alinear (≥2 nodos)',
    icon: IcoAlign,
    items: [
      { keys: 'Ctrl + Alt + L R T B', desc: 'Alinear bordes (izq / der / arriba / abajo)' },
      { keys: 'Ctrl + Alt + C M', desc: 'Centrar horizontal / vertical' },
      { keys: 'Ctrl + Alt + H V', desc: 'Distribuir (≥3 nodos)' },
    ],
  },
  {
    title: 'Archivos',
    icon: IcoFile,
    items: [
      { keys: 'Ctrl + N / O', desc: 'Nuevo / abrir' },
      { keys: 'Ctrl + I', desc: 'Importar (prompt -> diagrama)' },
      { keys: 'Ctrl + S', desc: 'Guardar (auto-save 2s tambien)' },
    ],
  },
  {
    title: 'Clipboard / historia',
    icon: IcoClip,
    items: [
      { keys: 'Ctrl + C V D', desc: 'Copiar / pegar / duplicar' },
      { keys: 'Ctrl + Z / Y', desc: 'Undo / redo' },
    ],
  },
  {
    title: 'Vista / exportar',
    icon: IcoView,
    items: [
      { keys: 'Ctrl + 0 / + / -', desc: 'Fit / zoom in / out' },
      { keys: 'Pinch / Ctrl+wheel', desc: 'Zoom; swipe = pan' },
      { keys: 'Shift + G', desc: 'Panel exportar (imagen SVG/PNG + prompt)' },
      { keys: 'Ctrl + E / Ctrl + Shift + E', desc: 'Exportar SVG / PNG directo' },
    ],
  },
];

const SYNTAX: { title: string; lines: string[] }[] = [
  {
    title: 'Basico',
    lines: [
      'type: flowchart | sequence | er',
      'title: Mi diagrama        // direction TB | LR | BT | RL',
      'A                         // nodo simple',
      'A > B                     // edge (>, <>, --)',
      'A > B: label              // con etiqueta',
    ],
  },
  {
    title: 'Atributos de nodo',
    lines: [
      'A [shape: cylinder, color: #fef3c7]',
      'A [shape: list, items: one; two]',
      'A [shape: upload, items: video HOLA | descripcion]   // buzon',
      'A [labels: feature; review, status: wip]',
      'A [file: src/a.ts, tests: src/a.test.ts]',
    ],
  },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Ayuda</h2>
          <button
            type="button"
            className="btn btn-ghost modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            x
          </button>
        </header>
        <div className="modal-body help-body">
          <div className="help-grid">
            {GROUPS.map((g) => (
              <div key={g.title} className="help-card">
                <h4 className="help-card-title">
                  {g.icon}
                  {g.title}
                </h4>
                <table className="shortcut-table">
                  <tbody>
                    {g.items.map((s) => (
                      <tr key={s.keys}>
                        <td>
                          <kbd>{s.keys}</kbd>
                        </td>
                        <td>{s.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <section className="help-section">
            <h3 className="help-card-title">
              {IcoSyntax}
              Sintaxis DSL
            </h3>
            <div className="help-grid">
              {SYNTAX.map((group) => (
                <div key={group.title} className="help-card">
                  <h4>{group.title}</h4>
                  <pre className="syntax-block">{group.lines.join('\n')}</pre>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
