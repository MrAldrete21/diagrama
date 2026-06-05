import { useEffect, useRef, useState } from 'react';
import { useDocStore, DEFAULT_SOURCE } from '../store/useDocStore';
import { openFileDialog, saveToHandle, saveAsDialog } from '../fs/fileSystem';
import type { FileHandle } from '../fs/fileSystem';
import {
  forgetRecent,
  getRecentList,
  rememberRecent,
  reopenRecent,
} from '../fs/recentFiles';
import type { RecentMeta } from '../fs/recentFiles';

type CurrentFile = { handle: FileHandle | null; name: string } | null;

// Maneja la persistencia en disco (File System Access API): archivo actual,
// dirty flag, recientes, auto-save con debounce, titulo de la pestania y la
// asociacion de archivo por pestania (cada tab recuerda su archivo).
export function useFileOps(opts: {
  activeTabId: string;
  showToast: (msg: string) => void;
}) {
  const { activeTabId, showToast } = opts;
  const setSource = useDocStore((s) => s.setSource);
  const clearManualPositions = useDocStore((s) => s.clearManualPositions);
  const source = useDocStore((s) => s.source);

  const [currentFile, setCurrentFile] = useState<CurrentFile>(null);
  const [savedSource, setSavedSource] = useState<string>(() => useDocStore.getState().source);
  const [recentFiles, setRecentFiles] = useState<RecentMeta[]>(() => getRecentList());
  const isDirty = currentFile !== null && source !== savedSource;

  // Auto-save: 2s de quietud tras editar guarda al handle actual. No-op sin
  // archivo o sin cambios. Falla en silencio (queda el dirty mark).
  const handleFileSaveRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!currentFile?.handle) return;
    if (source === savedSource) return;
    const id = setTimeout(() => {
      void handleFileSaveRef.current();
    }, 2000);
    return () => clearTimeout(id);
  }, [source, savedSource, currentFile]);

  // Refleja el archivo actual en el titulo de la pestania del browser.
  useEffect(() => {
    const name = currentFile?.name ?? 'untitled';
    const dirty = isDirty ? '•' : '';
    const title = `${dirty}${dirty ? ' ' : ''}${name} — Diagrama`;
    if (typeof document !== 'undefined') document.title = title;
  }, [currentFile, isDirty]);

  // Asociacion de archivo por pestania: al cambiar de tab guarda el archivo del
  // anterior y restaura el del nuevo (los handles viven solo en sesion).
  const prevTabRef = useRef(activeTabId);
  const fileByTabRef = useRef<Record<string, { file: CurrentFile; savedSource: string }>>({});
  useEffect(() => {
    const prev = prevTabRef.current;
    if (prev === activeTabId) return;
    fileByTabRef.current[prev] = { file: currentFile, savedSource };
    const restored = fileByTabRef.current[activeTabId];
    setCurrentFile(restored?.file ?? null);
    setSavedSource(restored ? restored.savedSource : useDocStore.getState().source);
    prevTabRef.current = activeTabId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const confirmDiscard = () =>
    !isDirty ||
    typeof window === 'undefined' ||
    window.confirm('Hay cambios sin guardar. Descartar?');

  const handleFileNew = () => {
    if (!confirmDiscard()) return;
    setSource(DEFAULT_SOURCE);
    clearManualPositions();
    setCurrentFile(null);
    setSavedSource(DEFAULT_SOURCE);
    showToast('Nuevo archivo');
  };

  const handleFileOpen = async () => {
    if (!confirmDiscard()) return;
    try {
      const opened = await openFileDialog();
      if (!opened) return;
      setSource(opened.content);
      clearManualPositions();
      setCurrentFile({ handle: opened.handle, name: opened.name });
      setSavedSource(opened.content);
      if (opened.handle) {
        await rememberRecent(opened.handle, opened.name);
        setRecentFiles(getRecentList());
      }
      showToast(`Abierto: ${opened.name}`);
    } catch (err) {
      showToast(`Error al abrir: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleFileSave = async () => {
    try {
      const cur = useDocStore.getState().source;
      const result = await saveToHandle(
        currentFile?.handle ?? null,
        cur,
        currentFile?.name ?? 'diagram.dgr',
      );
      if (!result) return;
      setCurrentFile({ handle: result.handle, name: result.name });
      setSavedSource(cur);
      if (result.handle) {
        await rememberRecent(result.handle, result.name);
        setRecentFiles(getRecentList());
      }
      showToast(`Guardado: ${result.name}`);
    } catch (err) {
      showToast(`Error al guardar: ${err instanceof Error ? err.message : err}`);
    }
  };

  // Ref siempre apuntando al ultimo closure para que el timer de auto-save lo
  // llame sin reiniciarse cuando cambia la identidad de la funcion.
  handleFileSaveRef.current = async () => {
    await handleFileSave();
  };

  const handleFileSaveAs = async () => {
    try {
      const cur = useDocStore.getState().source;
      const result = await saveAsDialog(cur, currentFile?.name ?? 'diagram.dgr');
      if (!result) return;
      setCurrentFile({ handle: result.handle, name: result.name });
      setSavedSource(cur);
      if (result.handle) {
        await rememberRecent(result.handle, result.name);
        setRecentFiles(getRecentList());
      }
      showToast(`Guardado: ${result.name}`);
    } catch (err) {
      showToast(`Error al guardar: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handlePickRecent = async (id: string) => {
    if (!confirmDiscard()) return;
    try {
      const opened = await reopenRecent(id);
      if (!opened) {
        showToast('No se pudo abrir (movido o permiso denegado)');
        setRecentFiles(getRecentList());
        return;
      }
      setSource(opened.content);
      clearManualPositions();
      setCurrentFile({ handle: opened.handle, name: opened.name });
      setSavedSource(opened.content);
      await rememberRecent(opened.handle, opened.name);
      setRecentFiles(getRecentList());
      showToast(`Abierto: ${opened.name}`);
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleForgetRecent = async (id: string) => {
    await forgetRecent(id);
    setRecentFiles(getRecentList());
  };

  return {
    currentFile,
    isDirty,
    recentFiles,
    handleFileNew,
    handleFileOpen,
    handleFileSave,
    handleFileSaveAs,
    handlePickRecent,
    handleForgetRecent,
  };
}
