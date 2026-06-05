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
