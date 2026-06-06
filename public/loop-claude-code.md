# diagrama = spec viva (para Claude Code)

Hay una app "diagrama" corriendo en http://localhost:5173 que es el mapa de este
proyecto. Mantenela al dia mientras codeas. El diagrama se llama `<PROYECTO>`
(reemplaza por un nombre fijo).

## Leer (antes de codear)
    curl -s http://localhost:5173/__diagrams
Devuelve `[{name, source}]`. Toma el de `<PROYECTO>` y lee su `source`: ahi esta
la arquitectura y el estado de cada nodo. Sintaxis del DSL si la necesitas:
`curl -s http://localhost:5173/prompt-to-diagram.txt`.

## Atributos de cada nodo
- `status: todo|wip|done|blocked`
- `request: true`  -> tarea que el usuario pide (tu lista de pendientes)
- `file: src/a.ts; src/b.ts`  -> archivos que implementan el nodo
- `assets: ...`  -> archivos que el usuario SUBIO como evidencia/avance (no los
  edites; son suyos). Si estan, el nodo ya tiene progreso real.

## Pedir archivos al usuario (buzon de progreso)
Si necesitas que el usuario te de algo (un video, una captura, un doc), crea o usa
un nodo `shape: upload` y pone tus pedidos en `items:` (un pedido por `;`):

    Evidencia [shape: upload, label: Subir progreso, items: video de la seña HOLA; captura de la pantalla X]

El usuario hace doble-click en ese nodo: es un CHECKLIST (listas -> elementos ->
archivos). Tus `items:` aparecen como una lista para que suba contenido a cada uno.
Cuando completa todo, el nodo pasa solo a `status: done`. El detalle del progreso
queda en el attr `buzon` (base64-JSON, no lo edites). Cuando vuelvas a leer el
diagrama vas a ver el progreso de cada elemento -> sabes que ya subio.

## Escribir (al implementar)
En el nodo: pone `status: done`, agrega `file:` con lo que tocaste, y quita
`request` si era un pedido. Manda el DSL COMPLETO (trae, edita, reenvia):

    curl -s -X POST http://localhost:5173/__diagrams/push \
      -H "Content-Type: application/json" \
      -d '{"name":"<PROYECTO>","source":"<DSL COMPLETO>"}'

Si la app tiene ese diagrama abierto, el canvas se actualiza solo.

## Reglas
- Ids estables y cortos; una sentencia por linea; nivel arquitectura (no un nodo
  por funcion).
- Si el server no responde, segui con tu tarea y avisa al usuario.
