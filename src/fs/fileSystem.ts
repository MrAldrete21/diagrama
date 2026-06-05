// Native-feeling file save/open using the File System Access API.
// Works in Chromium (Edge / Chrome). Falls back to download / <input type=file>
// on Firefox / Safari.

export type FileHandle = unknown; // FileSystemFileHandle, kept opaque

export type OpenedFile = {
  handle: FileHandle | null;
  content: string;
  name: string;
};

const FS_AVAILABLE =
  typeof window !== 'undefined' &&
  'showOpenFilePicker' in window &&
  'showSaveFilePicker' in window;

const PICKER_TYPES = [
  {
    description: 'Diagrama',
    accept: { 'text/plain': ['.dgr', '.txt'] },
  },
];

export function isNativeFsAvailable(): boolean {
  return FS_AVAILABLE;
}

export async function openFileDialog(): Promise<OpenedFile | null> {
  if (FS_AVAILABLE) {
    try {
      const [handle] = await (
        window as unknown as {
          showOpenFilePicker: (opts: {
            types: typeof PICKER_TYPES;
            multiple: boolean;
          }) => Promise<Array<{
            getFile: () => Promise<File>;
            name: string;
          }>>;
        }
      ).showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
      const file = await handle.getFile();
      const content = await file.text();
      return { handle, content, name: file.name };
    } catch (err) {
      // User cancelled — DOMException AbortError
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      throw err;
    }
  }
  return openViaInput();
}

async function openViaInput(): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dgr,.txt,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const content = await file.text();
      resolve({ handle: null, content, name: file.name });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function saveToHandle(
  handle: FileHandle | null,
  content: string,
  suggestedName = 'diagram.dgr',
): Promise<{ handle: FileHandle; name: string } | null> {
  if (!handle) {
    return saveAsDialog(content, suggestedName);
  }
  try {
    const h = handle as {
      createWritable: () => Promise<{
        write: (s: string) => Promise<void>;
        close: () => Promise<void>;
      }>;
      name?: string;
    };
    const writable = await h.createWritable();
    await writable.write(content);
    await writable.close();
    return { handle, name: h.name ?? suggestedName };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      // Permission was revoked — fall back to Save As so user re-picks.
      return saveAsDialog(content, suggestedName);
    }
    throw err;
  }
}

export async function saveAsDialog(
  content: string,
  suggestedName = 'diagram.dgr',
): Promise<{ handle: FileHandle; name: string } | null> {
  if (FS_AVAILABLE) {
    try {
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (opts: {
            suggestedName: string;
            types: typeof PICKER_TYPES;
          }) => Promise<{
            createWritable: () => Promise<{
              write: (s: string) => Promise<void>;
              close: () => Promise<void>;
            }>;
            name: string;
          }>;
        }
      ).showSaveFilePicker({ suggestedName, types: PICKER_TYPES });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { handle, name: handle.name };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      throw err;
    }
  }
  // Fallback: trigger download
  downloadFile(content, suggestedName);
  return { handle: null as unknown as FileHandle, name: suggestedName };
}

function downloadFile(content: string, name: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
