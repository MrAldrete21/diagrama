const HASH_KEY = 'dsl';

export function encodeSourceToHash(source: string): string {
  const bytes = new TextEncoder().encode(source);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeHashSource(hashValue: string): string | null {
  try {
    const padded = hashValue.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function readSourceFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const dsl = params.get(HASH_KEY);
  if (!dsl) return null;
  return decodeHashSource(dsl);
}

export function buildShareUrl(source: string): string {
  if (typeof window === 'undefined') return '';
  const encoded = encodeSourceToHash(source);
  return `${window.location.origin}${window.location.pathname}#${HASH_KEY}=${encoded}`;
}

export function updateUrlHash(source: string): void {
  if (typeof window === 'undefined') return;
  const encoded = encodeSourceToHash(source);
  history.replaceState(null, '', `#${HASH_KEY}=${encoded}`);
}

export function clearUrlHash(): void {
  if (typeof window === 'undefined') return;
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
