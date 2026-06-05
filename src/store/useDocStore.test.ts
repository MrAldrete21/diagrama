import { describe, it, expect, vi } from 'vitest';

// Mock minimo de localStorage (in-memory) — el store lo lee al importar.
function makeLocalStorage(initial: Record<string, string> = {}) {
  let store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
    dump: () => ({ ...store }),
  };
}

type StoreModule = typeof import('./useDocStore');

// Carga una instancia FRESCA del store con un localStorage dado (re-evalua los
// side-effects de import: runMigration + loadInitial).
async function loadStore(initial: Record<string, string> = {}) {
  const ls = makeLocalStorage(initial);
  vi.stubGlobal('localStorage', ls);
  vi.resetModules();
  const mod: StoreModule = await import('./useDocStore');
  return { mod, store: mod.useDocStore, DEFAULT_SOURCE: mod.DEFAULT_SOURCE, ls };
}

describe('useDocStore: migracion', () => {
  it('localStorage vacio: bootstrap a default + canvasOnly/autoFocus on + 1 tab', async () => {
    const { store, DEFAULT_SOURCE, ls } = await loadStore({});
    const s = store.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.source).toBe(DEFAULT_SOURCE);
    expect(s.canvasOnly).toBe(true);
    expect(s.autoFocus).toBe(true);
    expect(ls.getItem('diagrama:migration')).toBe('3');
  });

  it('doc unico legacy (sin blob de tabs) se migra a 1 tab con su contenido', async () => {
    const { store } = await loadStore({
      'diagrama:source': 'A > B\nB > C\n',
      'diagrama:migration': '3',
    });
    const s = store.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.source).toBe('A > B\nB > C\n');
  });

  it('source legacy "Bienvenido" se reemplaza por default', async () => {
    const { store, DEFAULT_SOURCE } = await loadStore({
      'diagrama:source': '// Bienvenido a diagrama\nNodeX\n',
    });
    expect(store.getState().source).toBe(DEFAULT_SOURCE);
  });

  it('title del DSL se usa como nombre de la pestania al bootear', async () => {
    const { store } = await loadStore({
      'diagrama:source': 'title: Mi Proyecto\nA\n',
      'diagrama:migration': '3',
    });
    expect(store.getState().tabs[0].title).toBe('Mi Proyecto');
  });
});

describe('useDocStore: tabs', () => {
  it('addTab crea una pestania nueva en blanco y la activa', async () => {
    const { store, DEFAULT_SOURCE } = await loadStore({});
    store.getState().addTab();
    const s = store.getState();
    expect(s.tabs).toHaveLength(2);
    expect(s.activeId).toBe(s.tabs[1].id);
    expect(s.source).toBe(DEFAULT_SOURCE);
  });

  it('aislamiento: editar una pestania no afecta a la otra', async () => {
    const { store } = await loadStore({});
    const tab1 = store.getState().tabs[0].id;
    store.getState().setSource('A\n');
    store.getState().addTab();
    const tab2 = store.getState().activeId;
    store.getState().setSource('B\n');
    store.getState().switchTab(tab1);
    expect(store.getState().source).toBe('A\n');
    store.getState().switchTab(tab2);
    expect(store.getState().source).toBe('B\n');
  });

  it('closeTab con varias pasa el foco a la vecina', async () => {
    const { store } = await loadStore({});
    store.getState().addTab();
    const second = store.getState().activeId;
    store.getState().closeTab(second);
    const s = store.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.activeId).toBe(s.tabs[0].id);
  });

  it('closeTab de la ultima la vacia en vez de cerrarla', async () => {
    const { store, DEFAULT_SOURCE } = await loadStore({
      'diagrama:source': 'X\n',
      'diagrama:migration': '3',
    });
    const only = store.getState().tabs[0].id;
    store.getState().closeTab(only);
    const s = store.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.source).toBe(DEFAULT_SOURCE);
  });

  it('setSource con title: actualiza el titulo de la pestania activa', async () => {
    const { store } = await loadStore({});
    store.getState().setSource('title: Hola\nA\n');
    const s = store.getState();
    expect(s.tabs.find((t) => t.id === s.activeId)!.title).toBe('Hola');
  });
});

describe('useDocStore: persistencia (reload)', () => {
  it('2 tabs con contenido distinto sobreviven al recargar', async () => {
    const first = await loadStore({});
    first.store.getState().setSource('title: Uno\nA\n');
    first.store.getState().addTab();
    first.store.getState().setSource('title: Dos\nB\n');
    const activeBefore = first.store.getState().activeId;

    // "reload": instancia fresca con el localStorage que dejo la primera.
    const reloaded = await loadStore(first.ls.dump());
    const s = reloaded.store.getState();
    expect(s.tabs).toHaveLength(2);
    expect(s.tabs.map((t) => t.title).sort()).toEqual(['Dos', 'Uno']);
    expect(s.activeId).toBe(activeBefore);
    // El doc activo es el "Dos"
    expect(s.source).toBe('title: Dos\nB\n');
  });
});

describe('useDocStore: undo / redo', () => {
  it('undo y redo restauran el source', async () => {
    const { store } = await loadStore({});
    store.getState().setSource('A\n');
    store.getState().setSource('B\n');
    expect(store.getState().canUndo()).toBe(true);
    store.getState().undo();
    expect(store.getState().source).toBe('A\n');
    expect(store.getState().canRedo()).toBe(true);
    store.getState().redo();
    expect(store.getState().source).toBe('B\n');
  });

  it('una edicion nueva limpia el redo', async () => {
    const { store } = await loadStore({});
    store.getState().setSource('A\n');
    store.getState().undo();
    store.getState().setSource('C\n');
    expect(store.getState().canRedo()).toBe(false);
  });
});
