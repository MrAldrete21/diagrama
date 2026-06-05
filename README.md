# diagrama

Editor de diagramas **diagram-as-code** estilo eraser.io: una DSL en Monaco
sincronizada con un canvas SVG editable visualmente. Pensado para uso
keyboard-first. Corre como web app / PWA (no necesita backend).

## Stack

- Vite 8 + React 19 + TypeScript (estricto: `verbatimModuleSyntax`, `noUnusedLocals`, `erasableSyntaxOnly`)
- Monaco Editor — DSL custom (Monarch + autocomplete contextual)
- Dagre — layout automatico (flowchart / ER)
- Zustand — estado (multi-documento con tabs, persist manual en localStorage)
- SVG nativo — export SVG/PNG; sin canvas/WebGL
- PWA via `vite-plugin-pwa` (manifest + service worker, offline)
- Vitest — tests de la logica pura (parser, edicion de source, prompt, store)

## Scripts

```bash
npm run dev        # dev server (localhost:5173)
npm test           # vitest run
npm run test:watch # vitest watch
npm run lint       # eslint
npm run build      # tsc -b && eslint . && vite build  (lint enforzado)
npm run preview    # sirve el build de produccion
```

Node esta en `C:\Program Files\nodejs\` — prependear al PATH en cada shell.

## Tipos de diagrama

Detectados por la 1a linea `type:` (default `flowchart`):

- **flowchart** — nodos + edges + grupos, con shapes, labels semanticos, iconos,
  constraints y contenido interno.
- **sequence** — actores + mensajes + notas (display only).
- **er** — tablas con columnas (pk/fk) + relaciones con cardinalidad.

## Features clave

- **Tabs** — varios diagramas a la vez (cada uno con su source/posiciones/undo).
- **Constraints** — marcar un nodo como constraint y aplicarlo a otros (Shift+R);
  se reflejan en el prompt generator.
- **Contenido interno** — texto oculto por nodo (Shift+T para editar, F para ver).
- **Prompt generator** — Shift+G: traduce el diagrama a un prompt markdown para
  pegar en Claude Code.
- **Solver LLM** — Shift+P: panel que muta el diagrama via Anthropic (API key propia).
- File open/save (File System Access API), recientes, URL share (hash base64).

## Atajos esenciales

- `W A S D` navegar · `Shift+W A S D` crear nodo hijo conectado
- `Shift+Q` editar label · `Shift+E` editar vaciando · `F` ver contenido interno
- `Shift+F` labels · `Shift+R` constraints · `Shift+T` contenido · `Shift+G` prompt
- `Shift+1..5` auto-focus / menu / bloque / atributos / editor de valores
- `Ctrl+C/V/D` copy/paste/duplicate · `Ctrl+Z/Y` undo/redo · `Ctrl+K` buscar
- `Ctrl+S` / `Ctrl+Shift+S` export SVG/PNG · `Ctrl+0` fit · `Ctrl+/` ayuda

## Deploy

`npm run build` → `/dist`. Servir en cualquier static host (Netlify drop, Vercel).
El service worker da offline; el share por URL funciona (hash routing).

Para acceso "desktop": `crear-acceso-directo.ps1 -Url "<deploy-url>"` crea un .lnk
que abre Chrome/Edge en modo `--app` (ventana standalone). Local: `diagrama-web.cmd`.

## Estructura

Ver [CLAUDE.md](CLAUDE.md) para el detalle de arquitectura, DSL y decisiones.
Resumen: `src/parser` (DSL→AST), `src/layout` (dagre), `src/renderer` (SVG),
`src/editor` (Monaco), `src/store` (zustand + tabs), `src/hooks`
(`useNodeMenu`/`useClipboard`/`useFileOps`), `src/components`, `src/promptgen`,
`src/solver`, `src/source` (transformaciones de texto), `src/share`, `src/export`.
Tests junto al codigo como `*.test.ts`.
