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
