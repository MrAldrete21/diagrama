# diagrama — handoff

Diagram editor estilo eraser.io. Diagram-as-code (DSL en Monaco) sincronizado con un canvas SVG editable visualmente.

## Stack

- Vite 8 + React 19 + TypeScript (verbatimModuleSyntax, noUnusedLocals)
- Monaco Editor (DSL custom con Monarch + autocomplete contextual)
- Dagre (multigraph + compound) para layout automático de flowchart / ER
- Zustand para estado (con persist manual via localStorage)
- SVG nativo (sin canvas/WebGL) — exports SVG/PNG via XMLSerializer + drawImage
- PWA via vite-plugin-pwa (manifest + service worker, offline). Tauri fue ABANDONADO (WebView2 tragaba el pinch del trackpad). Ver memoria project_tauri_to_pwa.
- Vitest para tests de logica pura (`npm test`). Lint enforzado en build: `tsc -b && eslint . && vite build`.

## Cambios desde el handoff original (LEER ESTO PRIMERO)

Partes de abajo quedaron viejas. Estado real:

- **Loop diagrama <-> Claude Code** (diagrama = spec viva, bidireccional). Features:
  - **Attrs nuevos de nodo**: `status: todo|wip|done|blocked` (punto de color, tecla **M**
    cicla), `request: true` ("pedido"/nuevo, cinta indigo, tecla **R** toggle),
    `file: a.ts; b.tsx` (archivos vinculados, badge clip). Tecla **Shift+L**: abre una barra
    (textarea, una ruta por linea) con boton **"del repo…"** = `RepoFilePicker` que lista los
    archivos REALES del proyecto via `GET /__files?root=` (plugin vite, walk del fs filtrando
    node_modules/etc.) con su path correcto. `root` (otro repo) se persiste en
    `diagrama:filesRoot`. Ctrl+Enter guarda.
  - **Attr `tests:`** (gemelo de `file:`): archivos de test del nodo, separados por `;`.
    Tecla **Shift+J** (misma barra + RepoFilePicker que Shift+L, target `tests`). Badge de
    matraz (`TestsBadge`, violeta) al lado del FileBadge. `buildDevPrompt` emite `tests: a; b`.
    Linter: feature `status:done` sin `tests:` -> warning. (Lo TDD-especifico del pedido
    --- attr `tdd`, `criteria`, endpoint `/__tests`+reporter, scope "rojo" --- NO se
    implemento; ver `public/funciones-app.md` para el reporte al proyecto externo.)
  - **Attr `assets:` + panel "Archivos / Progreso"** (`components/FilesPanel`, boton en
    ShortcutBar, icono carpeta-play). `assets:` es gemelo de `file:`/`tests:` (rutas
    separadas por `;`, relativas al repo del proyecto = `diagrama:filesRoot`):
    evidencia/avance que el usuario SUBE (videos, imagenes, docs). El panel (lado
    derecho, clase `solver-panel`) lista por nodo sus `file:`/`tests:`/`assets:`
    ordenados, marca cuales existen en el repo (cruza contra `GET /__files`), y permite
    **subir** (boton o drag&drop sobre la card) -> `POST /__upload` (binario crudo,
    query `root&dir&name`) guarda en `<root>/progreso/<nodeId>/` y devuelve la ruta
    relativa, que se vincula al nodo via `handleSetAssets` -> `updateNodeAttrInPlace(...,
    'assets', ...)`. Preview embebido (lightbox) de video/imagen/pdf/audio servido por
    `GET /__raw?root=&path=` (content-type por extension). Badge en el nodo
    (`AssetsBadge`, claqueta cyan, a la izq de file/tests). `buildDevPrompt` lo emite
    como `- evidencia/avance: ...` (el modelo no ve el contenido del video pero sabe que
    el nodo tiene avance + su status). Subir/preview es DEV-ONLY (endpoints del plugin);
    en prod el panel es solo-lectura. Helpers en `repo/files.ts`: `uploadAsset`,
    `rawUrl`, `assetKind`/`AssetKind`. `/progreso/` esta en `.gitignore`.
  - **Nodo "buzon de progreso" (`shape: upload`)**: tipo de nodo con interfaz propia
    (`components/UploadNodeModal`) para que el MODELO pida archivos y el USUARIO los suba.
    El modelo lista los pedidos en `items:` (un pedido por `;`); el usuario hace
    **doble-click** sobre el nodo -> abre el modal: muestra los pedidos (`items`), los
    archivos subidos (`assets`) con thumbnail/preview, y una dropzone (drag&drop o click)
    que sube via `POST /__upload` y vincula a `assets:` (`handleSetAssets`). El nodo se ve
    como card dashed con icono de subida + contador "N subidos · M pedidos"
    (`UploadContents` en `Node.tsx`, sizing en `layout.ts`). Crear: tool **Buzon** en la
    Palette, pestania **"buzon (progreso)"** del CustomBlockMenu (Shift+3,
    `CustomBlockApply` kind `upload`), o DSL directo. `handleNodeDoubleClick` detecta
    `shape==='upload'` y abre `uploadNodeId` en vez de editar el label.
  - **Indicador de sync** (`syncStatus` + `.sync-badge`, fixed top-center): muestra si el
    diagrama esta guardado en su .txt (`✓ x.txt` / `guardando…` / `sin vincular` / error).
    Lo maneja el effect de auto-guardado (match por title).
  - **Prompt del diff** (`SnapshotPanel` boton "copiar prompt de lo nuevo"): genera el
    dev-prompt SOLO de los nodos agregados respecto a un snapshot (`handleDiffPrompt` ->
    `buildDevPrompt(..., onlyIds)`).
    Parseados en `parse.ts`, en `DiagramNode`/`LayoutNode`, render en `Node.tsx`
    (StatusPill = pill con texto+color DEBAJO del nodo / RequestRibbon / FileBadge),
    emitidos por `buildDevPrompt`.
  - **Prompt incremental** (`PromptGenPanel`, Shift+G): selector de scope
    todo/seleccion/pedidos/pendientes. `buildDevPrompt(ast, src, labelPrompts, onlyIds?)`
    filtra a esos nodos (`buildScopedPrompt` en App arma el set por scope).
  - **Auto-reload en vivo**: el dev server (plugin en `vite.config`) watchea `/diagrams`
    y manda WS `diagrams:changed`; App escucha por `import.meta.hot` y si la pestania de
    biblioteca esta activa recarga su .txt SOLO (Claude edita el archivo -> canvas se
    actualiza sin tocar nada). `libraryFileRef` sabe que archivo recargar.
  - **Auto-guardado** (espejo del auto-reload): un effect con debounce matchea el
    diagrama actual con un archivo de /diagrams **por `title:`** y hace `POST /__diagrams/push`
    del DSL a ese .txt, asi TUS ediciones llegan al archivo que Claude lee (sin exportar
    nada). IMPORTANTE: matchea por title (no por refs en memoria) para SOBREVIVIR a recargas
    de la pagina — antes usaba `libraryTabIdRef`/`libraryFileRef` (useRef) que se reseteaban
    al reload y el auto-save no corria. El guard `match.source === source` evita escrituras
    redundantes y el loop push->watcher->reload. (Requiere que el diagrama tenga `title:`.)
  - **Endpoints dev** (mismo plugin): `POST /__diagrams/push` {name,source} escribe un
    .txt (Claude Code actualiza el diagrama por HTTP); `POST /__design` {content,file}
    escribe la "spec viva". (resolver root con `resolve()` por el mix de separadores Win.)
  - **Export spec viva** (`handleExportSpec`, FileMenu "exportar spec (design.md)"):
    escribe el dev-prompt a `design.md` via `/__design`. Toggle "spec auto-export" en
    FileMenu re-escribe con debounce al cambiar el DSL.
  - **Linter** (`lint/lintDiagram.ts` puro + `LinterPanel`, boton en ShortcutBar):
    nodos aislados, sin label, bloqueados, goals sin features, ciclos. Click -> selecciona.
  - **Snapshots + diff** (`snapshots/snapshots.ts` localStorage `diagrama:snapshots` +
    `SnapshotPanel`, boton en ShortcutBar): guarda versiones nombradas, carga, y diff
    (nodos/edges +/-) vs el estado actual.
  - La guia `public/prompt-to-diagram.txt` documenta los attrs nuevos + el loop (push/design).
  - **Guia para otro proyecto** (`public/loop-claude-code.md`): instrucciones para pegar
    en el CLAUDE.md de OTRO repo, para que su Claude Code use el diagrama como spec viva
    via HTTP (GET /__diagrams, POST /__diagrams/push). El ImportModal tiene el boton
    "guía loop (Claude Code)" (`handleCopyLoopGuide`) que la copia.

- **Prompt -> diagrama (import)**: `public/prompt-to-diagram.txt` es la guia del DSL
  escrita PARA que un LLM la siga y devuelva un diagrama en texto. En la app desktop,
  `components/ImportModal` (boton "importar (prompt)..." en `FileMenu`, atajo **Ctrl+I**)
  deja pegar/cargar ese texto: `source/importText.cleanImport` saca los cercos ``` que
  a veces mete el modelo, muestra una preview del parseo (nodos/conexiones/errores) y
  con "generar" crea una **pestania nueva** (`useDocStore.addTab(source?)`) sin pisar el
  doc actual. El modal tambien copia/descarga la guia (`fetch('/prompt-to-diagram.txt')`).
  - **Biblioteca**: carpeta `diagrams/` en la raiz. `src/diagrams/library.ts` carga todos
    los `*.txt` con `import.meta.glob('/diagrams/**/*.txt', {query:'?raw', eager:true})`.
    El ImportModal los lista (nombre = `title:` del DSL o el filename) y un click los abre
    en pestania nueva. El modelo guarda ahi sus archivos (la guia lo indica).
    El modal trae un boton **recargar** que relee la carpeta en vivo via el endpoint
    dev `/__diagrams` (plugin `diagramsLibraryPlugin` en `vite.config`, lee el fs con
    `server.middlewares`) -> `fetchDiagramLibrary()`; asi toma archivos nuevos SIN
    recargar la pagina. Fallback al glob bundleado si no hay dev server (prod).
    Ademas hay un boton **"↻ refrescar"** en el menu principal (header + controles
    flotantes, `handleRefreshCurrent`) que recarga el diagrama de la pestania ACTUAL
    desde su archivo, SIN abrir ningun menu. Resuelve el archivo por el vinculo
    (`libraryFileRef` si la pestania activa es la vinculada) o matcheando el `title:`
    del diagrama actual contra /diagrams (y vincula la pestania). Si no hay archivo,
    solo toast. Al lado hay un boton **"biblioteca"** (`handleReloadLibrary`) que SI
    abre el menu: 1 diagrama lo abre directo, varios abre el import para elegir.
    (El click en la lista del import usa `onPickLibrary` -> `openLibraryDiagram`.)

- **DOS apps** (`src/Root.tsx` decide cual montar; `main.tsx` monta `<Root/>`):
  - `App.tsx` = app **desktop** original (keyboard-first), SIN tocar.
  - `MobileApp.tsx` = app **movil tactil** separada. Reusa store/parser/layout/
    renderer/PanZoom y los menus (`ContextMenu`, `LabelPicker`, `Editor`, `TabBar`),
    con su propia interaccion touch: tap=seleccionar, drag=mover, connector "+",
    barra de acciones inferior (`components/MobileActionBar`: nodo, editar, estilo,
    labels, conectar, borrar, undo, redo, fit, code, mas), editor Monaco en sheet,
    sheet "mas" (tema/ejemplos/ayuda/compartir/export SVG/reset/ver desktop).
  - Seleccion de app: `useIsMobile()` (`hooks/useIsMobile`, media query
    `max-width:760` o `pointer:coarse`+`max-width:1024`). Override manual via
    `?view=mobile|desktop` (persistido en `diagrama:view`); el boton "ver desktop"
    de la movil setea el override. Ambas comparten el MISMO documento (store).
  - Gestos: PanZoom ya maneja pan (pointer events) + pinch (touchstart/move) — sirve
    para ambas. CSS movil al final de `App.css` (`.mobile-app`, `.mobile-action-bar`,
    `.mobile-sheet`, conectores "+" mas grandes, safe-area insets).
  - Shortcuts de escritorio: `Diagrama.lnk` -> `diagrama-web.cmd`/`.ps1` (desktop) y
    `Diagrama Movil.lnk` -> `diagrama-mobile.cmd`/`.ps1` (abre `?view=mobile` en ventana
    420x900 con user-data-dir `DiagramaMobile`). Ambos arrancan el dev server si hace falta.

- **Tabs**: el store es MULTI-documento. `useDocStore` tiene `tabs[]`/`activeId`/`docs{}`;
  cada tab = source/positions/sizes/history propios. Persiste en `diagrama:tabs`.
  Barra de tabs arriba (`TabBar`). Settings (tema, autoFocus, etc.) son globales.
- **App.tsx descompuesto** en hooks (`src/hooks/`): `useNodeMenu` (estado UNICO de los
  menus anclados al nodo — antes eran 8 booleanos sueltos), `useClipboard`
  (copy/paste/dup), `useFileOps` (open/save/recientes/auto-save/titulo/archivo-por-tab).
- **Constraints** (`components/ConstraintMenu`, Shift+R): un nodo con label `constraint`
  ES un constraint; aplicarlo a otro guarda attr `constraints: <ids>` y el prompt
  generator lo incluye. El menu es un carrusel de 3 (A/D mueve, Enter aplica el central,
  S/W va al boton "hacer constraint este nodo").
- **Contenido interno** (attr `content`, base64): texto que NO se dibuja en el nodo.
  Shift+T edita (`ContentEditor`), F lo ve (`ContentView`), iconito en nodos con contenido.
- **Prompt generator** (`promptgen/buildDevPrompt`, Shift+G): traduce el AST a markdown
  para pegar en Claude Code (arquitectura, flujo, constraints resueltos, orden topo, DSL).
- **ShortcutBar** (`components/ShortcutBar`): columna a la derecha de la Palette con
  accesos (buscar, solver, prompt, ejemplos, editar, labels, constraints, contenido).
- **Enabler de prompt** (`noPrompt`/`promptHidden`): tecla **N** sobre el nodo
  seleccionado lo excluye/incluye del prompt generator (buildDevPrompt filtra esos nodos
  y sus edges). Simbolo rojo de prohibido + atenuado. El prompt generator ademas refleja
  **todas** las labels usadas: las que no tienen seccion propia (idea, blocked, custom)
  salen en `## Otras labels (semantica)` con su descripcion (override incluido).
- **Connect condicional** (`conditional` en DiagramEdge/LayoutEdge; DSL `[conditional: true]`):
  edge que "solo transiciona al hacer una accion" (el label = la condicion). Se dibuja
  dashed + un diamante (gate) cerca del origen (`Edge.tsx` `edge-conditional-gate`).
  Atajo **Shift + / + WASD**: abre una barra (`conditional-input`) para escribir la
  condicion; Enter materializa. Si hay vecino en esa direccion (pickNeighbor cono ±45),
  solo crea el edge condicional (no toca los nodos); si no, crea nodo nuevo + edge.
  `handleCreateConditional` en App. `appendEdge(source, from, to, {label, conditional})`.
  El prompt generator lo emite como `A ?> B: cond (condicional...)`.
- **Invertir direccion de edge** (`EdgeMenu` boton **⇄** en la fila arrow): swap origen/
  destino (`A > B` -> `B > A`) conservando label/style/color (`reverseEdgeInPlace` en
  edit.ts, reusa parseEdgeLine/buildEdgeLine; ignora cartesianos). Re-selecciona el edge
  invertido (`handleReverseEdge` en App).
- **Atajos cambiados**: Shift+R = constraints (antes era el attr value editor, que se
  movio a **Shift+5**). Nuevos: Shift+T (contenido), F (ver contenido), Shift+G (prompt).
- **Crear nodo conectado (Shift+WASD)**: el nuevo SIEMPRE es child (edge seleccionado→nuevo)
  en las 4 direcciones. Ya NO hay reversal en left/up.
- **Copy snippet**: ya NO lleva el marcador `// __diagrama_copy__`. El paste acepta
  cualquier DSL valido o la copia interna.
- **Labels editables** (`renderer/labels.ts`): dos presets de decision por IA:
  `ai-decision` ("Ai decision (auto)", el modelo decide y el sistema actua solo) y
  `ai-decision-user` ("Ai decision (user)", la IA propone pero el usuario decide).
  En el LabelPicker (Shift+F), **R** (label enfocada) o **Shift+click** abre un
  editor del "prompt" de esa label (su `description`). Se guarda en `useDocStore.labelPrompts`
  (global, persistido en `diagrama:labelPrompts`; texto vacio = reset al default). El prompt
  generator (`buildDevPrompt`) y la ontologia del solver (`buildSystemPrompt`) leen la
  descripcion via `resolveLabelDescription(key, labelPrompts)`, asi editarla se refleja en
  TODOS los nodos que llevan esa label. El prompt gen emite la descripcion como blockquote
  bajo cada heading de seccion. Las labels con override muestran un punto en su celda.
- **Tests**: `*.test.ts` junto al codigo (parser, edit, buildDevPrompt, labels, url, store).
  Excluidos del build (`tsconfig.app` exclude). Para el store hay que mockear
  localStorage + `vi.resetModules()` (corre migracion/loadInitial al importar).

## Estructura

```
src/
  parser/
    types.ts      # DiagramAST = FlowchartAST | SequenceAST | ErAST (discriminated union)
                  # Shape: rectangle|ellipse|diamond|cylinder|hexagon|circle|list|note
                  # DiagramNode con: color, textColor, strokeColor, strokeWidth,
                  # icon, items, listStyle, content, progress, quantity, width/height
    common.ts     # stripComment, indexOfOutsideBrackets, splitOutsideBrackets,
                  # findArrowOperator, parseAttrs, detectDiagramType
    parse.ts     # dispatch por `type:` keyword + parsers de flowchart/sequence/er
                  # content se guarda base64 en el DSL (encodeURIComponent + btoa)
  layout/
    layout.ts    # dispatch a layoutFlowchart/Sequence/Er
                  # Acepta manualPositions, manualSizes, labelOverrides, expandedNoteIds
                  # Post-procesa bbox de grupos desde posiciones FINALES (incluyendo
                  # nodos pinneados) en 3 pases para soportar grupos anidados.
                  # Edges con endpoints manual usan straightLinePoints (clip a caja).
                  # `note` ignora manualSize (siempre se calcula desde estado collapsed/expanded).
  renderer/
    Diagram.tsx   # dispatcher por layout.kind, forwards props al renderer especifico
    Flowchart.tsx # forwardRef SVG, renderiza groups/edges/nodes + ConnectorButtons + label input
                  # ConnectorButtons = 4 botones "+" alrededor del nodo seleccionado
    Node.tsx      # 8 shapes + ListContents + NoteContents (collapsed/expanded con foreignObject)
                  # ProgressBadge (clickeable, data-resize-handle="true") + QuantityBadge
                  # ResizeHandles 4 esquinas (no en notes)
                  # CSS vars override: --node-fill-override / --node-text-override /
                  # --node-stroke-override / --node-stroke-width-override
    Edge.tsx      # path + invisible edge-hit de 14px para captura de click
                  # markerEnd / markerStart segun arrow type (directed/bidirectional/undirected)
                  # dasharray segun style (solid/dashed/dotted) + stroke override
    Group.tsx     # rect dashed + label esquina
    Sequence.tsx  # actores, lifelines, mensajes, notas (display only)
    ErView.tsx    # tablas con columns + relations con cardinalidad (markers er-many/er-one)
    PanZoom.tsx   # forwardRef. centerOn(x, y, opts) anima con cubic ease-out 220ms.
                  # fittedRef garantiza solo 1 auto-fit por mount.
                  # Wheel: pinch (ctrlKey) zooma; deltaX!=0 o |deltaY|<50 panea (trackpad).
                  # Mouse wheel grande (>=50): zoom centrado en cursor.
                  # Skip pan si target esta dentro de [data-node] o [data-resize-handle].
  editor/
    Editor.tsx   # Monaco wrapper con forwardRef. revealLine NO llama focus (key fix
                  # para que Ctrl+C/V/D vayan al canvas tras click en nodo).
                  # Monarch tokens + dos temas (diagrama-light, diagrama-dark) + autocomplete
                  # contextual (direction, shape, style, attrs, snippets).
  store/
    useDocStore.ts  # zustand. Source/positions/sizes/theme/editorWidth/showEditor/
                    # autoFocus/canvasOnly + undo/redo (history stack, 100 entries).
                    # Migration system: CURRENT_MIGRATION='3'. Si done!=='3', aplica:
                    # - source nulo/vacio/legacy welcome -> DEFAULT_SOURCE ('Node1\n')
                    # - canvasOnly nulo -> 'true'
                    # - autoFocus nulo -> 'true'
                    # Persiste todo en localStorage. Lee URL hash al boot (prioridad sobre LS).
  source/
    edit.ts      # appendNode/Edge, updateNodeAttrInPlace, removeNodeAttrInPlace,
                  # removeNodeFromSource (drop pure decl + edge lines referencing id),
                  # removeEdgeFromSource (handles cartesian A,B>C,D — keeps surviving),
                  # buildCopySnippet (sintetiza decls desde AST, no extrae texto),
                  # renameSnippetIds (suffix _1, _2 para evitar colisiones), appendSnippet.
  components/
    Palette.tsx       # Floating toolbar TL: select + 8 shapes + connect
    Resizer.tsx       # Divisor draggable entre editor y canvas
    ContextMenu.tsx   # Floating menu sobre el nodo seleccionado.
                      # 4 tabs: fill | text | stroke | shape.
                      # Translucido (backdrop-filter blur). Clamp al viewport con
                      # placement=top|bottom segun espacio disponible.
                      # Tab shape: 6 shape tiles + icon input + 12 presets chips
                      # + reset size + auto-contrast (calc luminance del fill).
                      # Tab stroke: color + slider width 0-6px.
                      # Cada color tab: usados (extrae del AST) + recientes (sesion) +
                      # 3 paletas (pastels visible, tailwind/grays detras de toggle).
                      # Hex input + native color picker + clear.
    ExamplesModal.tsx  # Modal con 6 templates (flujo, cloud arch, sequence, ER, decision, state)
    HelpModal.tsx     # Atajos + sintaxis por tipo. Open with Ctrl+/
    CustomBlockMenu.tsx  # Open with Shift+3. 2 tabs internos: lista / note.
                          # Lista: textarea + toggle bullets/numbered. Ctrl+Enter aplica.
                          # Note: textarea grande. Contenido se codifica base64 al guardar.
                          # Boton "quitar bloque" si ya es list/note (vuelve a rectangle).
  share/
    url.ts       # base64url encode/decode DSL en hash. buildShareUrl + readSourceFromUrl
  export/
    export.ts    # buildPortableSvgString: clona SVG, getComputedStyle resuelve CSS vars
                  # a colores concretos, los aplica como atributos inline en el clon,
                  # strip class, inserta bg rect del tema. exportSvg + exportPng (canvas
                  # 2x retina, fondo del tema). FIX critico: antes el SVG perdia todos
                  # los estilos al ser standalone porque dependia de vars del documento.
  App.tsx       # Wiring. State: tool, connectFromId, editingNodeId, editingValue,
                # selectedIds, selectedEdgeKey, expandedNoteIds, menuFocused, customBlockOpen,
                # transform (PanZoom callback), recentColors, internalClipboardRef.
                # didInitialSelectRef: select first node on mount.
                # Auto-focus useEffect con lastCenteredRef (evita re-center en drag).
                # lockOtherPositions(exceptId): snapshot todas las posiciones renderizadas
                # como manualPositions para que resize/edit/connect no muevan otros nodos.
                # startLabelEdit(id, clearText): centraliza entry a edit mode +
                # pin de posiciones.
  App.css       # 60+ CSS vars con light/dark theme. Variables clave:
                # --node-fill (con -override fallback), --node-stroke (idem),
                # --palette-bg-translucent (rgba 0.78), --highlight-stroke (azul),
                # --selected-stroke (verde, edges seleccionadas).
  index.css     # box-sizing reset, body fonts
  main.tsx      # createRoot estandar
```

## Features completas

**Tipos de diagrama** (detectados por `type:` en linea 1):
- `flowchart` (default): nodes + edges + groups, con todas las features visuales abajo
- `sequence`: actores + lifelines + mensajes + notas (display-only, no edicion visual)
- `er`: tablas con columnas (pk, fk) + relations con cardinalidad

**Shapes flowchart** (8 total):
- rectangle / ellipse / circle / diamond / hexagon / cylinder (los clasicos)
- `list`: header + divider + items con prefix bullets `•` o `1. 2. 3.` segun `listStyle`
- `note`: tiny por default (120x40 con esquina doblada). Enter expande con foreignObject
  + `<div class="note-content">` para texto multiline real. Contenido en base64 en el DSL.

**Atributos de edge** (en el bracket despues del label):
- `style: solid|dashed|dotted`
- `color: <hex>`

**Tipos de arrow**:
- `>` directed (default)
- `<>` bidirectional (marker en ambas puntas)
- `--` undirected (sin marker)

**Atributos de nodo**:
- `label`, `shape`, `color`, `textColor`, `strokeColor`, `strokeWidth` (0-6px)
- `icon` (texto libre o uno de los 12 presets: user, database, server, globe, lock,
  api, code, file, aws-ec2, aws-rds, aws-s3, aws-lambda)
- `items` (separados por `;` para shape=list)
- `listStyle` (`bullets` | `numbered`)
- `content` (base64 para shape=note)
- `progress` (`true`/`false`/`done`/`pending`/`1`/`0`) → checkbox clickeable
- `quantity` (numero) → badge azul
- `noPrompt` (`true`/`1`) → excluye el nodo (y sus edges) del prompt generator.
  Tecla `N` togglea. Muestra simbolo rojo (prohibido) en el nodo. `promptHidden` en el AST.
- `file` (rutas separadas por `;`) → archivos del repo que implementan el nodo (badge clip)
- `tests` (rutas separadas por `;`) → archivos de test del nodo (badge matraz)
- `assets` (rutas separadas por `;`) → evidencia/avance subido (videos/imagenes/docs);
  badge claqueta. Se sube/ve desde el panel "Archivos / Progreso" (ShortcutBar)
- `width`, `height` (override manual)

**Sintaxis DSL completa**:
```
type: flowchart | sequence | er          # tipo de diagrama
title: Mi Diagrama                       # titulo (renderiza arriba del SVG)
direction TB|LR|BT|RL                    # orientacion (flowchart, ER)

# nodos
A                                        # nodo simple rectangle
A [Custom Label]                         # legacy: bracket sin `:` es el label
A [shape: cylinder, color: #fef3c7, textColor: #fff, icon: aws-rds]
A [shape: list, items: one; two, listStyle: numbered]
A [shape: note, content: SGVsbG8=]       # base64 encoded
A [progress: true, quantity: 42]

# edges
A > B                                    # directed
A <> B                                   # bidirectional
A -- B                                   # undirected
A > B: label                             # con label
A, B > C, D                              # cartesian (4 edges)
A > B: label [style: dashed, color: red] # edge attrs en label section
A > B [shape: cylinder]                  # node attrs inline para B

# grupos / clusters
group "Nombre" {
  X
  X > Y
}

# sequence diagram
type: sequence
Alice > Bob: hola
Bob --> Alice: hi
note over Alice, Bob: comentario

# ER diagram (las tablas son MULTILINEA: `Nombre {` y columnas en lineas aparte)
type: er
User {
  id uuid pk
  name string
  email string
}
Post {
  id uuid pk
  user_id uuid fk
}
User.id > Post.user_id                   # 1:N
A.x <> B.y                               # N:M
A.x -- B.y                               # 1:1
```

## Atajos de teclado

**Navegacion + edicion**:
- `W A S D` (sin modificador) → mover seleccion al vecino mas cercano en esa direccion
  (cone angular ±45°). Si nada seleccionado, agarra el primer nodo.
- `Shift+W A S D` → crear nuevo nodo conectado (up/left/down/right)
  - right/down: edge va DEL seleccionado al nuevo
  - left/up: edge va DEL nuevo al seleccionado (semantica de flujo natural)
- `Shift+Q` → editar label (mantiene texto actual, cursor adentro)
- `Shift+E` → editar label (borra texto, empieza vacio)
- `Shift+1` → toggle auto-focus
- `Shift+2` → entrar/salir del context menu con keyboard. WASD navega items via
  pickFocusableInDirection (DOM rect proximity por direccion). Enter activa.
- `Shift+3` → abrir CustomBlockMenu (lista/note configurator)
- `Enter` (canvas, nodo note seleccionado) → expand/collapse note
- `Esc` → cancela edit, salida de menus/modals, deselect, fall-through

**Clipboard**:
- `Ctrl+C` → copia seleccion. Snippet sintetizado desde AST (no extrae texto crudo).
  Marker `// __diagrama_copy__` para round-trip. Tambien guarda en `internalClipboardRef`
  como fallback si clipboard API falla.
- `Ctrl+V` → pega snippet. Renombra IDs con `_1`, `_2` para evitar colisiones.
- `Ctrl+D` → duplicate (mismo flujo que copy+paste, sin tocar el clipboard del SO)

**Otros**:
- `Ctrl+S` / `Ctrl+Shift+S` → export SVG / PNG
- `Ctrl+Z` / `Ctrl+Y` (o `Ctrl+Shift+Z`) → undo / redo
- `Ctrl+0` / `Ctrl+=` / `Ctrl+-` → fit / zoom in / zoom out
- `Ctrl+/` → abrir HelpModal
- `Delete` / `Cmd+Backspace` → eliminar nodo(s) seleccionado(s) o edge seleccionada
- `Shift+click nodo` → multi-select toggle
- `Shift+drag` (durante drag/resize) → desactiva snap a grid 20px

**Trackpad**:
- 2-finger swipe → pan
- pinch → zoom centrado en cursor

## UI / interacciones

- Click en nodo → selecciona + saltea el cursor del editor a su linea (sin focus)
  + blur de cualquier input activo (asi Ctrl+C/V/D van al canvas)
- Doble-click en nodo → entra a edit label
- Cursor en linea del editor → highlightea nodos referenciados en esa linea
- Drag nodo → mueve + snap a grid 20 (Shift desactiva)
- Drag esquina del nodo seleccionado → resize. lockOtherPositions previo asi
  los demas no se reorganizan.
- 4 botones "+" alrededor del nodo seleccionado → crear nodo conectado en esa
  direccion
- Click edge → selecciona (outline verde). Delete elimina solo esa conexion del
  line cartesian.
- Click progress checkbox → toggle done/pending. Stop propagation para que no
  inicie drag o pan.

## Defaults / migracion

Migration v3 corre 1 sola vez:
- Si `localStorage['diagrama:source']` es null, vacio, o empieza con `// Bienvenido a diagrama`
  → setea a `DEFAULT_SOURCE = 'Node1\n'`
- Si `canvasOnly` es null → `'true'`
- Si `autoFocus` es null → `'true'`
- Marca `migration='3'` para no repetir

Por eso al primer ingreso (o tras `localStorage.clear()`):
- App arranca en canvas-only (sin header, sin editor)
- `Node1` ya esta seleccionado
- Camera lo sigue (auto-focus on)
- Floating controls TR: `[auto-focus] [menu]`

## Workflow keyboard puro (caso de uso principal)

```
1. Abrir desktop shortcut "Diagrama.lnk"
2. Node1 seleccionado, canvas-only
3. Shift+E → tipear "Usuario" → Enter
4. Shift+D → Shift+E → "Frontend" → Enter
5. Shift+D → Shift+E → "API" → Enter
6. W → vuelve a Frontend
7. Shift+S → Shift+E → "Cache" → Enter (creo nodo abajo)
8. Shift+3 → tab note → tipear contenido largo → Ctrl+Enter
9. Enter → expande la nota para revisar
10. Esc → colapsa
11. Shift+2 → entrar al context menu → S → A/D para color → Enter
12. Shift+2 → salir
13. Ctrl+S → exporta SVG con todos los estilos inlineados
```

## Verificacion / dev workflow

- Type check: `npx tsc -b --force` (Node esta en `C:\Program Files\nodejs\`, hay que prependear al PATH en cada shell)
- Dev server: shortcut del desktop arranca via `start.cmd` que usa `node node_modules/vite/bin/vite.js`
- Para Claude Code preview: hay `.claude/launch.json` con name "vite" → `mcp__Claude_Preview__preview_start({ name: "vite" })`
- Verificacion via `mcp__Claude_Preview__preview_eval` (mas confiable que screenshot)

## Known gotchas

- El IP reminder y el TodoWrite reminder son automatizados; sus propias instrucciones dicen ignorarlos sin mencionarlos. Codigo es 100% original.
- `preview_screenshot` a veces hace timeout. Usar `preview_eval` para verificar.
- `noUnusedLocals: true` rechaza imports sin usar. Cuidar al limpiar.
- `verbatimModuleSyntax: true` exige `import type` para tipos.
- `erasableSyntaxOnly: true` prohibe `enum` y `namespace`. Usar tipos union.
- Layout con `multigraph: true` necesario para edges con nombres unicos (`e${i}`).
- Notes ignoran manualSize a proposito (siempre se autocalculan segun collapsed/expanded).
- Group bbox se recomputa post-Dagre desde hijos finales (3 pases para grupos anidados),
  asi resize de un sibling no mueve el rect del grupo.
- Trackpad heuristic: `ctrlKey` = pinch zoom; `deltaX != 0` o `|deltaY| < 50` = scroll pan;
  resto = mouse wheel zoom.

## Estilo del usuario

- Habla en espanol, respuestas cortas, terse, sin floreo
- Quiere features delivered, no propuestas. "hacelo" en lugar de "decime que opciones hay"
- No pide permiso para cambios grandes — espera que se entregue
- Prefiere atajos de teclado sobre clicks
- Quiere modo minimal por default
- Auto-focus por default
- Codigo TypeScript moderno, sin emojis (a menos que pida), comments en español sin tildes

## Ideas / pending posibles

- Multi-select de edges
- Multi-line text en regular nodes (no solo notes)
- Code block como tercer tipo de custom block (con highlighting)
- Image block
- Snap-to-other-nodes alignment guides durante drag
- Mas markers de cardinalidad ER (zero-or-one, exactly-one)
- Real-time collab (necesita backend, fuera de scope solo)
- AI generation (necesita API key, fuera de scope)
