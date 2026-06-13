import { create } from 'zustand';
import type { ManualPositions } from '../layout/layout';
import { readSourceFromUrl } from '../share/url';

const SOURCE_KEY = 'diagrama:source';
const POSITIONS_KEY = 'diagrama:positions';
const SIZES_KEY = 'diagrama:sizes';
const THEME_KEY = 'diagrama:theme';
const EDITOR_WIDTH_KEY = 'diagrama:editorWidth';
const SHOW_EDITOR_KEY = 'diagrama:showEditor';
const AUTO_FOCUS_KEY = 'diagrama:autoFocus';
const CANVAS_ONLY_KEY = 'diagrama:canvasOnly';
const TABS_KEY = 'diagrama:tabs';
const LABEL_PROMPTS_KEY = 'diagrama:labelPrompts';
const MIGRATION_KEY = 'diagrama:migration';
const CURRENT_MIGRATION = '3';

export const DEFAULT_SOURCE = 'Node1\n';

// Anything that starts like the old verbose welcome stays out of new sessions
const LEGACY_DEFAULTS_PREFIXES = [
  '// Bienvenido a diagrama',
  '// Welcome to diagrama',
];

function isLegacyDefault(s: string | null): boolean {
  if (!s) return false;
  const trimmed = s.trimStart();
  return LEGACY_DEFAULTS_PREFIXES.some((p) => trimmed.startsWith(p));
}

// One-time migration: bootstrap a starter node and minimal mode for first-time
// (or previously-cleared) users. Runs once per version of CURRENT_MIGRATION.
function runMigration(): void {
  if (typeof localStorage === 'undefined') return;
  const done = localStorage.getItem(MIGRATION_KEY);
  if (done === CURRENT_MIGRATION) return;

  const storedSource = localStorage.getItem(SOURCE_KEY);
  if (storedSource === null || storedSource === '' || isLegacyDefault(storedSource)) {
    localStorage.setItem(SOURCE_KEY, DEFAULT_SOURCE);
  }
  if (localStorage.getItem(CANVAS_ONLY_KEY) === null) {
    localStorage.setItem(CANVAS_ONLY_KEY, 'true');
  }
  if (localStorage.getItem(AUTO_FOCUS_KEY) === null) {
    localStorage.setItem(AUTO_FOCUS_KEY, 'true');
  }
  localStorage.setItem(MIGRATION_KEY, CURRENT_MIGRATION);
}

runMigration();

export type Theme = 'light' | 'dark';
export type ManualSizes = Record<string, { width: number; height: number }>;

/**
 * History snapshot captures the full mutable state so undo restores not only
 * source edits but also drags, resizes, aligns, etc.
 */
export type Snapshot = {
  source: string;
  manualPositions: ManualPositions;
  manualSizes: ManualSizes;
};

type HistoryState = {
  past: Snapshot[];
  future: Snapshot[];
};

const MAX_HISTORY = 100;

export type TabMeta = { id: string; title: string };

// Per-document (per-tab) state. Settings (theme, autoFocus, etc.) are global.
type DocState = {
  source: string;
  manualPositions: ManualPositions;
  manualSizes: ManualSizes;
  history: HistoryState;
};

const safeRead = (key: string): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
};

const safeWrite = (key: string, value: string): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
};

let tabSeq = 0;
function newTabId(): string {
  return `t${Date.now().toString(36)}${(tabSeq++).toString(36)}`;
}

// Extrae el nombre de la pestania desde la linea `title:` del DSL. null si no hay.
function deriveTitle(source: string): string | null {
  const m = source.match(/^\s*title:\s*(.+)$/m);
  if (m && m[1].trim()) return m[1].trim().slice(0, 40);
  return null;
}

function emptyHistory(): HistoryState {
  return { past: [], future: [] };
}

function parseJsonObj<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ============================================================================
// Boot: reconstruye las tabs desde localStorage, o migra el doc unico legacy.
// ============================================================================

type InitShape = {
  tabs: TabMeta[];
  activeId: string;
  docs: Record<string, DocState>;
};

type PersistedDoc = {
  source: string;
  manualPositions?: ManualPositions;
  manualSizes?: ManualSizes;
};
type PersistedTabs = {
  tabs: TabMeta[];
  activeId: string;
  docs: Record<string, PersistedDoc>;
};

function loadInitial(): InitShape {
  const fromUrl = readSourceFromUrl();
  const rawTabs = safeRead(TABS_KEY);
  const parsed = parseJsonObj<PersistedTabs | null>(rawTabs, null);

  if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0 && parsed.docs) {
    const docs: Record<string, DocState> = {};
    for (const t of parsed.tabs) {
      const d = parsed.docs[t.id] ?? { source: DEFAULT_SOURCE };
      docs[t.id] = {
        source: d.source ?? DEFAULT_SOURCE,
        manualPositions: d.manualPositions ?? {},
        manualSizes: d.manualSizes ?? {},
        history: emptyHistory(),
      };
    }
    let tabs = parsed.tabs;
    let activeId = parsed.activeId && docs[parsed.activeId] ? parsed.activeId : parsed.tabs[0].id;

    // Un diagrama compartido por URL se abre en una pestania nueva.
    if (fromUrl !== null) {
      const id = newTabId();
      docs[id] = { source: fromUrl, manualPositions: {}, manualSizes: {}, history: emptyHistory() };
      tabs = [...tabs, { id, title: deriveTitle(fromUrl) ?? 'Compartido' }];
      activeId = id;
    }
    return { tabs, activeId, docs };
  }

  // Sin blob de tabs: migrar el documento unico legacy (o el de la URL).
  const storedSource = safeRead(SOURCE_KEY);
  const source =
    fromUrl !== null
      ? fromUrl
      : isLegacyDefault(storedSource)
        ? DEFAULT_SOURCE
        : storedSource ?? DEFAULT_SOURCE;
  const manualPositions = parseJsonObj<ManualPositions>(safeRead(POSITIONS_KEY), {});
  const manualSizes = parseJsonObj<ManualSizes>(safeRead(SIZES_KEY), {});
  const id = newTabId();
  return {
    tabs: [{ id, title: deriveTitle(source) ?? 'Diagrama 1' }],
    activeId: id,
    docs: { [id]: { source, manualPositions, manualSizes, history: emptyHistory() } },
  };
}

const initialTheme: Theme = (() => {
  const raw = safeRead(THEME_KEY);
  if (raw === 'light' || raw === 'dark') return raw;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
})();

const initialEditorWidth: number = (() => {
  const raw = safeRead(EDITOR_WIDTH_KEY);
  const n = raw ? parseFloat(raw) : NaN;
  if (Number.isFinite(n) && n >= 20 && n <= 80) return n;
  return 50;
})();

const initialShowEditor: boolean = (() => {
  const raw = safeRead(SHOW_EDITOR_KEY);
  if (raw === 'false') return false;
  return true;
})();

const initialAutoFocus: boolean = (() => safeRead(AUTO_FOCUS_KEY) === 'true')();
const initialCanvasOnly: boolean = (() => safeRead(CANVAS_ONLY_KEY) === 'true')();
const initialLabelPrompts: Record<string, string> = parseJsonObj<Record<string, string>>(
  safeRead(LABEL_PROMPTS_KEY),
  {},
);

const init = loadInitial();
const initActive = init.docs[init.activeId];

type DocStore = {
  // Active document (mirror of docs[activeId]) — App reads these directly.
  source: string;
  manualPositions: ManualPositions;
  manualSizes: ManualSizes;
  history: HistoryState;
  // Tabs
  tabs: TabMeta[];
  activeId: string;
  docs: Record<string, DocState>;
  // Settings (global, shared across tabs)
  theme: Theme;
  editorWidthPercent: number;
  showEditor: boolean;
  autoFocus: boolean;
  canvasOnly: boolean;
  /** Override editable de la descripcion/prompt de cada label (key -> texto). */
  labelPrompts: Record<string, string>;
  // Per-document mutations
  setSource: (s: string, opts?: { skipHistory?: boolean }) => void;
  setManualPosition: (id: string, pos: { x: number; y: number }) => void;
  setManualPositionsBulk: (positions: ManualPositions) => void;
  setManualSize: (id: string, size: { width: number; height: number }) => void;
  clearManualPositions: () => void;
  clearManualSize: (id: string) => void;
  resetSource: () => void;
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  // Tabs
  addTab: (source?: string) => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  // Settings
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setEditorWidthPercent: (p: number) => void;
  toggleEditor: () => void;
  toggleAutoFocus: () => void;
  toggleCanvasOnly: () => void;
  /** Setea (o resetea, si text vacio) el prompt custom de una label. */
  setLabelPrompt: (key: string, text: string) => void;
};

export const useDocStore = create<DocStore>((set, get) => {
  // Persiste tabs + docs (sin history, igual que antes no se persistia) y
  // espeja el doc activo en las keys legacy por compatibilidad.
  const persist = () => {
    const s = get();
    const docs: Record<string, PersistedDoc> = {};
    for (const t of s.tabs) {
      const d =
        t.id === s.activeId
          ? { source: s.source, manualPositions: s.manualPositions, manualSizes: s.manualSizes }
          : {
              source: s.docs[t.id].source,
              manualPositions: s.docs[t.id].manualPositions,
              manualSizes: s.docs[t.id].manualSizes,
            };
      docs[t.id] = d;
    }
    safeWrite(TABS_KEY, JSON.stringify({ tabs: s.tabs, activeId: s.activeId, docs }));
    safeWrite(SOURCE_KEY, s.source);
    safeWrite(POSITIONS_KEY, JSON.stringify(s.manualPositions));
    safeWrite(SIZES_KEY, JSON.stringify(s.manualSizes));
  };

  // Snapshot del doc activo dentro del mapa docs (para preservarlo al cambiar).
  const syncActive = (s: DocStore): Record<string, DocState> => ({
    ...s.docs,
    [s.activeId]: {
      source: s.source,
      manualPositions: s.manualPositions,
      manualSizes: s.manualSizes,
      history: s.history,
    },
  });

  // Actualiza el titulo de la pestania activa desde la linea title: del DSL.
  const tabsWithTitle = (s: DocStore, source: string): TabMeta[] => {
    const t = deriveTitle(source);
    if (!t) return s.tabs;
    return s.tabs.map((tab) => (tab.id === s.activeId ? { ...tab, title: t } : tab));
  };

  return {
    source: initActive.source,
    manualPositions: initActive.manualPositions,
    manualSizes: initActive.manualSizes,
    history: initActive.history,
    tabs: init.tabs,
    activeId: init.activeId,
    docs: init.docs,
    theme: initialTheme,
    editorWidthPercent: initialEditorWidth,
    showEditor: initialShowEditor,
    autoFocus: initialAutoFocus,
    canvasOnly: initialCanvasOnly,
    labelPrompts: initialLabelPrompts,

    setSource: (s, opts) => {
      const state = get();
      if (opts?.skipHistory || s === state.source) {
        set({ source: s, tabs: tabsWithTitle(state, s) });
        persist();
        return;
      }
      const snapshot: Snapshot = {
        source: state.source,
        manualPositions: state.manualPositions,
        manualSizes: state.manualSizes,
      };
      const past = [...state.history.past, snapshot].slice(-MAX_HISTORY);
      set({ source: s, history: { past, future: [] }, tabs: tabsWithTitle(state, s) });
      persist();
    },
    pushSnapshot: () => {
      const state = get();
      const snapshot: Snapshot = {
        source: state.source,
        manualPositions: state.manualPositions,
        manualSizes: state.manualSizes,
      };
      const last = state.history.past[state.history.past.length - 1];
      if (
        last &&
        last.source === snapshot.source &&
        last.manualPositions === snapshot.manualPositions &&
        last.manualSizes === snapshot.manualSizes
      ) {
        return;
      }
      const past = [...state.history.past, snapshot].slice(-MAX_HISTORY);
      set({ history: { past, future: [] } });
    },
    setManualPosition: (id, pos) => {
      const next = { ...get().manualPositions, [id]: pos };
      set({ manualPositions: next });
      persist();
    },
    setManualPositionsBulk: (positions) => {
      const next = { ...get().manualPositions, ...positions };
      set({ manualPositions: next });
      persist();
    },
    setManualSize: (id, size) => {
      const next = { ...get().manualSizes, [id]: size };
      set({ manualSizes: next });
      persist();
    },
    clearManualPositions: () => {
      set({ manualPositions: {}, manualSizes: {} });
      persist();
    },
    clearManualSize: (id) => {
      const cur = get().manualSizes;
      if (!cur[id]) return;
      const next = { ...cur };
      delete next[id];
      set({ manualSizes: next });
      persist();
    },
    resetSource: () => {
      const state = get();
      const snapshot: Snapshot = {
        source: state.source,
        manualPositions: state.manualPositions,
        manualSizes: state.manualSizes,
      };
      const past = [...state.history.past, snapshot].slice(-MAX_HISTORY);
      set({
        source: DEFAULT_SOURCE,
        manualPositions: {},
        manualSizes: {},
        history: { past, future: [] },
        tabs: tabsWithTitle(state, DEFAULT_SOURCE),
      });
      persist();
    },
    undo: () => {
      const state = get();
      if (state.history.past.length === 0) return;
      const prev = state.history.past[state.history.past.length - 1];
      const past = state.history.past.slice(0, -1);
      const currentSnapshot: Snapshot = {
        source: state.source,
        manualPositions: state.manualPositions,
        manualSizes: state.manualSizes,
      };
      const future = [currentSnapshot, ...state.history.future].slice(0, MAX_HISTORY);
      set({
        source: prev.source,
        manualPositions: prev.manualPositions,
        manualSizes: prev.manualSizes,
        history: { past, future },
        tabs: tabsWithTitle(state, prev.source),
      });
      persist();
    },
    redo: () => {
      const state = get();
      if (state.history.future.length === 0) return;
      const nextSnap = state.history.future[0];
      const future = state.history.future.slice(1);
      const currentSnapshot: Snapshot = {
        source: state.source,
        manualPositions: state.manualPositions,
        manualSizes: state.manualSizes,
      };
      const past = [...state.history.past, currentSnapshot].slice(-MAX_HISTORY);
      set({
        source: nextSnap.source,
        manualPositions: nextSnap.manualPositions,
        manualSizes: nextSnap.manualSizes,
        history: { past, future },
        tabs: tabsWithTitle(state, nextSnap.source),
      });
      persist();
    },
    canUndo: () => get().history.past.length > 0,
    canRedo: () => get().history.future.length > 0,

    addTab: (source) => {
      const state = get();
      const docs = syncActive(state);
      const id = newTabId();
      // Guard: si nos pasan algo que no es string (ej el evento del onClick del
      // boton "+"), lo ignoramos y abrimos un diagrama en blanco.
      const validSource = typeof source === 'string' ? source : undefined;
      const src = validSource ?? DEFAULT_SOURCE;
      const fresh: DocState = {
        source: src,
        manualPositions: {},
        manualSizes: {},
        history: emptyHistory(),
      };
      docs[id] = fresh;
      const title = (validSource ? deriveTitle(validSource) : null) ?? `Diagrama ${state.tabs.length + 1}`;
      set({
        docs,
        tabs: [...state.tabs, { id, title }],
        activeId: id,
        source: fresh.source,
        manualPositions: fresh.manualPositions,
        manualSizes: fresh.manualSizes,
        history: fresh.history,
      });
      persist();
    },
    switchTab: (id) => {
      const state = get();
      if (id === state.activeId) return;
      const docs = syncActive(state);
      const target = docs[id];
      if (!target) return;
      set({
        docs,
        activeId: id,
        source: target.source,
        manualPositions: target.manualPositions,
        manualSizes: target.manualSizes,
        history: target.history,
      });
      persist();
    },
    closeTab: (id) => {
      const state = get();
      const idx = state.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;

      // Ultima pestania: en vez de cerrar, resetea a un doc en blanco.
      if (state.tabs.length === 1) {
        const fresh: DocState = {
          source: DEFAULT_SOURCE,
          manualPositions: {},
          manualSizes: {},
          history: emptyHistory(),
        };
        set({
          docs: { [id]: fresh },
          tabs: [{ id, title: 'Diagrama 1' }],
          activeId: id,
          source: fresh.source,
          manualPositions: fresh.manualPositions,
          manualSizes: fresh.manualSizes,
          history: fresh.history,
        });
        persist();
        return;
      }

      const tabs = state.tabs.filter((t) => t.id !== id);
      const docs = syncActive(state);
      delete docs[id];

      if (id === state.activeId) {
        const nextTab = tabs[Math.max(0, idx - 1)];
        const target = docs[nextTab.id];
        set({
          tabs,
          docs,
          activeId: nextTab.id,
          source: target.source,
          manualPositions: target.manualPositions,
          manualSizes: target.manualSizes,
          history: target.history,
        });
      } else {
        set({ tabs, docs });
      }
      persist();
    },

    setTheme: (t) => {
      safeWrite(THEME_KEY, t);
      set({ theme: t });
    },
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      safeWrite(THEME_KEY, next);
      set({ theme: next });
    },
    setEditorWidthPercent: (p) => {
      const clamped = Math.max(20, Math.min(80, p));
      safeWrite(EDITOR_WIDTH_KEY, String(clamped));
      set({ editorWidthPercent: clamped });
    },
    toggleEditor: () => {
      const next = !get().showEditor;
      safeWrite(SHOW_EDITOR_KEY, String(next));
      set({ showEditor: next });
    },
    toggleAutoFocus: () => {
      const next = !get().autoFocus;
      safeWrite(AUTO_FOCUS_KEY, String(next));
      set({ autoFocus: next });
    },
    toggleCanvasOnly: () => {
      const next = !get().canvasOnly;
      safeWrite(CANVAS_ONLY_KEY, String(next));
      set({ canvasOnly: next });
    },
    setLabelPrompt: (key, text) => {
      const k = key.toLowerCase();
      const next = { ...get().labelPrompts };
      if (text.trim()) {
        next[k] = text;
      } else {
        // Texto vacio = volver al default.
        delete next[k];
      }
      safeWrite(LABEL_PROMPTS_KEY, JSON.stringify(next));
      set({ labelPrompts: next });
    },
  };
});
