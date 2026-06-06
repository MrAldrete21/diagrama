// Lista archivos de un repo via el dev server (endpoint /__files). El picker de
// archivos del nodo los usa para vincular con su path real (no solo el nombre).

export type RepoFiles = { root: string; files: string[]; truncated?: boolean };

export async function fetchRepoFiles(root: string): Promise<RepoFiles> {
  try {
    const url = root ? `/__files?root=${encodeURIComponent(root)}` : '/__files';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { root, files: [] };
    return (await res.json()) as RepoFiles;
  } catch {
    return { root, files: [] };
  }
}

export type UploadResult = { ok: boolean; path?: string; bytes?: number };

// Sube un archivo (evidencia/avance) al repo del proyecto, bajo `dir`. Devuelve
// la ruta relativa al root (la que se vincula al nodo). Dev-only (endpoint del
// plugin de vite); en prod no hay server -> ok:false.
export async function uploadAsset(root: string, dir: string, file: File): Promise<UploadResult> {
  try {
    const params = new URLSearchParams();
    if (root) params.set('root', root);
    params.set('dir', dir);
    params.set('name', file.name);
    const res = await fetch(`/__upload?${params.toString()}`, { method: 'POST', body: file });
    if (!res.ok) return { ok: false };
    return (await res.json()) as UploadResult;
  } catch {
    return { ok: false };
  }
}

// URL para servir un archivo del repo (preview de video/imagen/pdf).
export function rawUrl(root: string, path: string): string {
  const params = new URLSearchParams();
  if (root) params.set('root', root);
  params.set('path', path);
  return `/__raw?${params.toString()}`;
}

export type AssetKind = 'video' | 'image' | 'pdf' | 'audio' | 'code' | 'doc' | 'other';

const EXT_KIND: Record<string, AssetKind> = {
  mp4: 'video', m4v: 'video', webm: 'video', mov: 'video', ogv: 'video', avi: 'video', mkv: 'video',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', avif: 'image', bmp: 'image',
  pdf: 'pdf',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio',
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code', py: 'code', go: 'code', rs: 'code', java: 'code',
  c: 'code', cpp: 'code', h: 'code', css: 'code', html: 'code', json: 'code', sh: 'code',
  md: 'doc', txt: 'doc', csv: 'doc', xlsx: 'doc', docx: 'doc',
};

export function assetKind(path: string): AssetKind {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return EXT_KIND[ext] ?? 'other';
}
