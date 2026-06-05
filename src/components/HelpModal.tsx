type Shortcut = { keys: string; desc: string };
type Group = { title: string; items: Shortcut[] };

const GROUPS: Group[] = [
  {
    title: 'Navegacion',
    items: [
      { keys: 'W / A / S / D', desc: 'Mover seleccion al vecino arriba / izq / abajo / der' },
      { keys: 'Ctrl + A', desc: 'Seleccionar todos los nodos' },
      { keys: 'Shift + click', desc: 'Multi-select toggle' },
      { keys: 'Shift + drag (canvas)', desc: 'Marquee selection (rectangulo de seleccion)' },
      { keys: 'Ctrl + Shift + drag', desc: 'Marquee additive (suma a seleccion existente)' },
      { keys: 'Esc', desc: 'Deselect / cancel edit / fall-through cierre de menus' },
      { keys: 'Shift (tap solo)', desc: 'Cierra el menu/popup top-most' },
    ],
  },
  {
    title: 'Crear / editar',
    items: [
      { keys: 'Shift + W / A / S / D', desc: 'Crear nodo conectado en esa direccion' },
      { keys: 'F + W / A / S / D', desc: 'Crear nodo conectado + abrir LabelPicker en modo create' },
      { keys: 'Shift + / + W/A/S/D', desc: 'Connect condicional: barra para la condicion + Enter (nodo nuevo, o solo el edge si hay vecino)' },
      { keys: 'Shift + Q', desc: 'Editar label (mantiene texto)' },
      { keys: 'Shift + E', desc: 'Editar label (borra texto, vacio)' },
      { keys: 'Doble-click nodo', desc: 'Editar label inline' },
      { keys: 'Drag nodo seleccionado', desc: 'Mover (snap a otros nodos + grid; Shift desactiva)' },
      { keys: 'Drag con multi-select', desc: 'Mueve toda la seleccion preservando offsets' },
      { keys: '/ + W / A / S / D', desc: 'Nudge nodo seleccionado en 20px (1 grid)' },
      { keys: 'Drag esquina', desc: 'Resize del nodo (Shift desactiva snap)' },
      { keys: 'Delete / Cmd+Backspace', desc: 'Eliminar nodos o edge seleccionada' },
      { keys: 'Enter (en NOTE)', desc: 'Expand / collapse del bloque note' },
    ],
  },
  {
    title: 'Menus / popups',
    items: [
      { keys: 'Shift + 1', desc: 'Toggle auto-focus (camara sigue al seleccionado)' },
      { keys: 'Shift + 2', desc: 'Abrir / cerrar personalization menu (color, shape, icon)' },
      { keys: 'Shift + 3', desc: 'CustomBlock menu (lista / note / image)' },
      { keys: 'Shift + 4', desc: 'AttributePicker (toggle progress / quantity / icon)' },
      { keys: 'Shift + 5', desc: 'AttributeEditor (editar valores actuales)' },
      { keys: 'Shift + F', desc: 'LabelPicker (Feature, Constraint, Ai decision, etc.). R o Shift+click edita el prompt de la label' },
      { keys: 'Shift + R', desc: 'Constraints (marcar nodo y aplicar a otros; afecta el prompt)' },
      { keys: 'Shift + T', desc: 'Editar contenido interno del nodo (no se muestra)' },
      { keys: 'F', desc: 'Ver el contenido interno del nodo seleccionado' },
      { keys: 'N', desc: 'Excluir / incluir el nodo en el prompt generator (simbolo rojo = excluido)' },
      { keys: 'M', desc: 'Ciclar estado de implementacion (todo/wip/done/blocked) — punto de color' },
      { keys: 'R', desc: 'Toggle "pedido" (request): marca algo nuevo a implementar (cinta)' },
      { keys: 'Shift + L', desc: 'Archivos del nodo: textarea (una ruta por linea) + boton "del repo…" (lista archivos reales con su path)' },
      { keys: 'Shift + J', desc: 'Archivos de TEST del nodo (attr tests:, badge matraz) — misma barra que Shift+L' },
      { keys: 'Shift + P', desc: 'Solver LLM panel (Anthropic prompt-driven)' },
    ],
  },
  {
    title: 'Align / distribute (≥2 seleccionados)',
    items: [
      { keys: 'Ctrl + Alt + L / R', desc: 'Align left / right edges' },
      { keys: 'Ctrl + Alt + T / B', desc: 'Align top / bottom edges' },
      { keys: 'Ctrl + Alt + C / M', desc: 'Center horizontal / middle vertical' },
      { keys: 'Ctrl + Alt + H / V', desc: 'Distribute horizontal / vertical (≥3)' },
    ],
  },
  {
    title: 'Archivos',
    items: [
      { keys: 'Ctrl + N', desc: 'Nuevo archivo (prompt si dirty)' },
      { keys: 'Ctrl + O', desc: 'Abrir .dgr / .txt desde disco' },
      { keys: 'Ctrl + I', desc: 'Importar (prompt -> diagrama): pega/carga DSL en pestania nueva' },
      { keys: 'Ctrl + S', desc: 'Guardar al archivo abierto (auto-save 2s tambien)' },
      { keys: 'Ctrl + Shift + S', desc: 'Guardar como...' },
      { keys: 'Drag-drop .dgr', desc: 'Tirar archivo al canvas para abrirlo' },
    ],
  },
  {
    title: 'Clipboard / history',
    items: [
      { keys: 'Ctrl + C / V / D', desc: 'Copiar / pegar / duplicar nodos' },
      { keys: 'Ctrl + Z / Ctrl + Y', desc: 'Undo / redo (history de 100 entradas)' },
    ],
  },
  {
    title: 'Vista / export',
    items: [
      { keys: 'Ctrl + 0 / + / -', desc: 'Fit / zoom in / zoom out' },
      { keys: 'Trackpad swipe', desc: 'Pan' },
      { keys: 'Pinch / Ctrl+wheel', desc: 'Zoom centrado en cursor' },
      { keys: 'Ctrl + E', desc: 'Export SVG' },
      { keys: 'Ctrl + Shift + E', desc: 'Export PNG' },
      { keys: 'Ctrl + /', desc: 'Abrir esta ayuda' },
    ],
  },
];

const SYNTAX: { title: string; lines: string[] }[] = [
  {
    title: 'Header',
    lines: [
      'type: flowchart | sequence | er',
      'title: Mi diagrama',
      'direction TB | LR | BT | RL',
    ],
  },
  {
    title: 'Flowchart — edges',
    lines: [
      'A > B               // directed',
      'A <> B              // bidirectional',
      'A -- B              // undirected',
      'A > B: label        // con etiqueta',
      'A, B > C, D         // cartesian (4 edges)',
      'A > B [style: dashed, color: red]',
      'A > B: hacer login [conditional: true]  // connect condicional',
    ],
  },
  {
    title: 'Flowchart — nodos',
    lines: [
      'A                                       // rectangle simple',
      'A [shape: cylinder, color: #fef3c7]',
      'A [shape: list, items: one; two, listStyle: numbered]',
      'A [shape: note, content: SGVsbG8=]      // base64',
      'A [shape: image, src: <base64>]',
      'A [progress: true, quantity: 42, icon: aws-rds]',
      'A [labels: feature; goal; risk]',
    ],
  },
  {
    title: 'Grupos',
    lines: ['group "Nombre" {', '  X', '  X > Y', '}'],
  },
  {
    title: 'Sequence',
    lines: [
      'Alice > Bob: hola',
      'Bob --> Alice: hi',
      'note over Alice, Bob: comentario',
    ],
  },
  {
    title: 'ER',
    lines: [
      'User { id uuid pk; name string }',
      'Post { id uuid pk; user_id uuid fk }',
      'User.id > Post.user_id   // 1:N',
      'A.x <> B.y               // N:M',
      'A.x -- B.y               // 1:1',
    ],
  },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
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
          <section className="help-section">
            <h3>Atajos</h3>
            {GROUPS.map((g) => (
              <div key={g.title} className="help-group">
                <h4>{g.title}</h4>
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
          </section>
          <section className="help-section">
            <h3>Sintaxis DSL</h3>
            {SYNTAX.map((group) => (
              <div key={group.title}>
                <h4>{group.title}</h4>
                <pre className="syntax-block">{group.lines.join('\n')}</pre>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
