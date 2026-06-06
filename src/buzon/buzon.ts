import type { BuzonData, BuzonList, BuzonItem, NodeStatus } from '../parser/types';

// Logica pura del nodo "buzon de progreso" (shape: upload). El checklist se
// serializa como base64-JSON en el attr DSL `buzon`.

export function emptyBuzon(): BuzonData {
  return { lists: [] };
}

// base64-JSON (mismo esquema que content/src: utf8-safe).
export function encodeBuzon(data: BuzonData): string {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch {
    return '';
  }
}

export function decodeBuzon(s: string): BuzonData {
  try {
    const obj = JSON.parse(decodeURIComponent(escape(atob(s)))) as unknown;
    return normalizeBuzon(obj);
  } catch {
    return emptyBuzon();
  }
}

// Tolera datos parciales/viejos: garantiza la forma {lists:[{id,name,items:[{id,name,files}]}]}.
export function normalizeBuzon(obj: unknown): BuzonData {
  const rec = obj as { lists?: unknown };
  const lists = Array.isArray(rec?.lists) ? rec.lists : [];
  return {
    lists: lists.map((l): BuzonList => {
      const lr = l as { id?: unknown; name?: unknown; items?: unknown };
      const items = Array.isArray(lr?.items) ? lr.items : [];
      return {
        id: typeof lr?.id === 'string' ? lr.id : newId('l'),
        name: typeof lr?.name === 'string' ? lr.name : 'Lista',
        items: items.map((it): BuzonItem => {
          const ir = it as { id?: unknown; name?: unknown; files?: unknown };
          const files = Array.isArray(ir?.files) ? ir.files.filter((f): f is string => typeof f === 'string') : [];
          return {
            id: typeof ir?.id === 'string' ? ir.id : newId('i'),
            name: typeof ir?.name === 'string' ? ir.name : 'Elemento',
            files,
          };
        }),
      };
    }),
  };
}

let idCounter = 0;
// Id corto y unico (browser). No se usa en logica pura testeada por valor.
export function newId(prefix: string): string {
  idCounter += 1;
  const rnd = Math.floor(Math.random() * 1e6).toString(36);
  return `${prefix}${idCounter.toString(36)}${rnd}`;
}

export const itemComplete = (it: BuzonItem): boolean => it.files.length > 0;

// Lista completa = tiene elementos y todos tienen al menos un archivo.
export const listComplete = (l: BuzonList): boolean =>
  l.items.length > 0 && l.items.every(itemComplete);

export type BuzonProgress = {
  totalItems: number;
  doneItems: number;
  totalLists: number;
  doneLists: number;
};

export function buzonProgress(data: BuzonData): BuzonProgress {
  let totalItems = 0;
  let doneItems = 0;
  let doneLists = 0;
  for (const l of data.lists) {
    totalItems += l.items.length;
    doneItems += l.items.filter(itemComplete).length;
    if (listComplete(l)) doneLists += 1;
  }
  return { totalItems, doneItems, totalLists: data.lists.length, doneLists };
}

// Estado derivado del checklist: done si todas las listas completas; wip si hay
// algun archivo; todo si no hay nada.
export function computeBuzonStatus(data: BuzonData): NodeStatus {
  const p = buzonProgress(data);
  if (p.totalLists > 0 && p.doneLists === p.totalLists) return 'done';
  if (p.doneItems > 0) return 'wip';
  return 'todo';
}

// Migracion suave: si el nodo no tiene buzon pero tiene `items:` (pedidos viejos
// del modelo), arranca con una lista "Pedidos" con esos elementos vacios.
export function seedBuzon(existing: BuzonData | undefined, items: string[] | undefined): BuzonData {
  if (existing && existing.lists.length > 0) return existing;
  if (items && items.length > 0) {
    return {
      lists: [
        {
          id: newId('l'),
          name: 'Pedidos',
          items: items.map((name) => ({ id: newId('i'), name, files: [] })),
        },
      ],
    };
  }
  return existing ?? emptyBuzon();
}
