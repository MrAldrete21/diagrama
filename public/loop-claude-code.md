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

## Pedir cosas al usuario (buzones + pestania Tareas)
Si necesitas algo del usuario, crea un nodo buzon con tus pedidos en `items:`
(un pedido por `;`). Hay dos tipos:

- `shape: upload` -> el usuario SUBE ARCHIVOS (videos, capturas, docs):

      Evidencia [shape: upload, label: Subir progreso, items: video de la seña HOLA; captura de la pantalla X]

- `shape: form` -> el usuario RESPONDE TEXTO (decisiones, preferencias, criterios):

      Decisiones [shape: form, label: Preguntas de diseño, items: que stack preferis; web o mobile primero]

Cada item puede llevar una DESCRIPCION de que se necesita exactamente, con el
formato `nombre | descripcion`:

      Evidencia [shape: upload, label: Subir señas, items: video HOLA | de frente y manos visibles; video GRACIAS | fondo claro]

Todos los buzones aparecen juntos en la pestania "Tareas" de la app: el usuario
avanza tarea por tarea (la camara salta al nodo) y completa cada elemento ahi
mismo. Cada buzon es un CHECKLIST (listas -> elementos): tus `items:` aparecen
como una lista "Pedidos". Cuando completa todo, el nodo pasa solo a
`status: done`. El detalle queda en el attr `buzon` (base64-JSON, no lo edites a
mano): al volver a leer el diagrama ves que archivos subio y que respondio.

## Ai decision -> planear en el diagrama ANTES de implementar (IMPORTANTE)
Si un nodo tiene la label `ai-decision` (o `ai-decision-user`), es un punto donde
VOS (la IA) tenes que decidir el diseno. La regla es: **no escribas codigo
todavia**. Primero PROPONE los cambios EDITANDO el diagrama:
1. Agrega/edita los nodos que reflejan tu propuesta (arquitectura, pasos, archivos).
2. A cada nodo que crees o edites como parte de la propuesta, ponele la label
   `review` (ej `labels: feature; review`). Esos nodos LATEN en la app para que el
   usuario los note.
3. Reenvia el DSL completo (POST /__diagrams/push) y AVISALE al usuario que revise
   el diagrama. No implementes nada hasta que el usuario apruebe.

Cuando el usuario aprueba, implementas y QUITAS la label `review` de esos nodos
(y pones `status: done` + `file:` como siempre). Resumen: ai-decision = pensar y
dibujar; review = pendiente de aprobacion; sin review = aprobado, se puede codear.

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
