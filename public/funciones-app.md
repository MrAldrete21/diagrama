# Funciones de la app "diagrama" (para el proyecto externo / Claude Code)

La app corre en `http://localhost:5173` (dev server). Es la spec viva del proyecto:
el diagrama refleja arquitectura, estado de implementacion y, ahora, los tests.
Este reporte lista lo que PODES usar por HTTP + los attrs de nodo del DSL.

## Endpoints HTTP (dev server)
- `GET  /__diagrams`                 -> `[{ name, source }]`. El `source` es el DSL.
- `POST /__diagrams/push`            -> body `{ name, source }`. Crea/actualiza el .txt.
- `GET  /__files?root=<path>`        -> `{ root, files: string[] }`. Archivos reales del
                                        repo (relativos a root; default = cwd del server).
- `POST /__design`                   -> body `{ content, file? }`. Escribe design.md.
- `GET  /prompt-to-diagram.txt`      -> guia del DSL.

Auto-sync: si editas un .txt de /diagrams, la app que lo tiene abierto se actualiza
sola (WS). Y si el usuario edita en la app, sus cambios se guardan al .txt
(match por `title:`), asi `GET /__diagrams` siempre da lo ultimo.

## Attrs de nodo del DSL (relevantes para el loop)
    Nodo [label: Texto, attrs...]
- `status: todo | wip | done | blocked`   estado de implementacion (pill de color).
- `request: true`                          el usuario PIDE esto (tu lista de tareas).
- `file: src/a.ts; src/b.ts`               archivos que IMPLEMENTAN el nodo.
- `tests: src/a.test.ts; src/b.test.ts`    archivos de TEST que cubren el nodo. (NUEVO)
- `labels: feature | goal | constraint | ...`

Sintaxis completa del DSL: `GET /prompt-to-diagram.txt`.

## Flujo TDD recomendado (con lo que HAY hoy)
1. Lee el diagrama (`GET /__diagrams`). Prioriza nodos `request: true` o `status != done`.
2. Construi cada feature **test-first**: escribi primero el test que falla, despues el
   minimo para pasar, despues refactor.
3. Al terminar un nodo: en el DSL pone `status: done`, vincula el codigo con `file:` y
   los tests con `tests:`. Quita `request`.
4. Guarda con `POST /__diagrams/push` (DSL completo, read-modify-write).
   Regla del linter de la app: una `feature` con `status: done` y SIN `tests:` se marca
   como warning. O sea: no marques done sin dejar los tests vinculados.

## IMPORTANTE: lo que pediste de TDD y NO esta implementado (no lo asumas)
Se implemento solo la parte conservadora y de uso general (attr `tests:` + render +
prompt + regla de linter). NO existe (todavia):
- `tdd: red|green|refactor` (anillo de color) — no parsea ni se dibuja.
- `criteria:` (criterios de aceptacion) — no existe; usa el texto del `label`/`content`.
- `POST /__tests` / `GET /__tests` + WS "tests:changed" — NO hay endpoint de resultados
  de tests. No postees resultados ahi: no existe. (Si lo necesitan, el usuario lo
  evaluara aparte por la saturacion visual del nodo y la relacion con `status`.)
- Reporter de jest/vitest que postee resultados — no incluido.
- Scope "rojo" en el prompt generator — no existe.

Si tu plan dependia de `/__tests` o `tdd:`, frena y avisale al usuario: por ahora el
estado de tests se refleja marcando `status` y vinculando `tests:` en el DSL, no con
resultados en vivo.
