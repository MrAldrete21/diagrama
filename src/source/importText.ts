// Normaliza texto pegado/importado para "prompt -> diagrama". Los modelos a
// veces envuelven la salida en un bloque de codigo markdown pese a pedirles que
// no; esto lo tolera quitando los cercos ``` (con o sin lenguaje) del principio
// y el final, y normaliza saltos de linea CRLF.

export function cleanImport(raw: string): string {
  let text = raw.replace(/\r\n?/g, '\n').trim();

  // Cerco de apertura: ``` o ```lang en la primera linea.
  const fenceOpen = text.match(/^```[^\n]*\n/);
  if (fenceOpen) {
    text = text.slice(fenceOpen[0].length);
    // Cerco de cierre al final.
    const fenceClose = text.match(/\n```\s*$/);
    if (fenceClose) text = text.slice(0, text.length - fenceClose[0].length);
    else text = text.replace(/```\s*$/, '');
  }

  return text.trim();
}
