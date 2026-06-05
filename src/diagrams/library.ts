// Biblioteca de diagramas: carga todos los .txt de la carpeta /diagrams (raiz
// del proyecto) usando import.meta.glob de Vite. Los modelos dejan ahi sus
// archivos y aparecen en el modal de import para abrirlos con un click.
//
// `eager` los embebe como string en el bundle. En dev, agregar un archivo nuevo
// requiere recargar la pagina (Vite re-evalua el glob al recargar).
const modules = import.meta.glob('/diagrams/**/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export type LibraryDiagram = {
  id: string;
  /** Nombre de archivo sin extension. */
  name: string;
  /** title: del DSL si existe (nombre mas lindo para mostrar). */
  title: string | null;
  source: string;
};

function deriveTitle(src: string): string | null {
  const m = src.match(/^\s*title:\s*(.+)$/m);
  return m && m[1].trim() ? m[1].trim() : null;
}

export function loadDiagramLibrary(): LibraryDiagram[] {
  return Object.entries(modules)
    .map(([path, source]) => {
      const file = path.split('/').pop() ?? path;
      const name = file.replace(/\.txt$/i, '');
      return { id: path, name, title: deriveTitle(source), source };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Lee la carpeta /diagrams en vivo via el endpoint del dev server (plugin
// diagrams-library). Permite refrescar la lista sin recargar la pagina. Si el
// endpoint no existe (build de produccion), cae al glob bundleado.
export async function fetchDiagramLibrary(): Promise<LibraryDiagram[]> {
  try {
    const res = await fetch('/__diagrams', { cache: 'no-store' });
    if (!res.ok) throw new Error('sin endpoint');
    const raw = (await res.json()) as { name: string; source: string }[];
    return raw
      .map((d) => ({ id: d.name, name: d.name, title: deriveTitle(d.source), source: d.source }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return loadDiagramLibrary();
  }
}
