import { describe, it, expect } from 'vitest';
import { encodeSourceToHash, decodeHashSource } from './url';

describe('share/url base64url', () => {
  it('round-trips ASCII', () => {
    const src = 'type: flowchart\nA > B\n';
    expect(decodeHashSource(encodeSourceToHash(src))).toBe(src);
  });

  it('round-trips unicode y saltos de linea', () => {
    const src = 'título: año ñandú 🚀\nNodo [label: café]\n';
    expect(decodeHashSource(encodeSourceToHash(src))).toBe(src);
  });

  it('usa alfabeto url-safe (sin + / =)', () => {
    const encoded = encodeSourceToHash('?'.repeat(40));
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('decodifica basura sin tirar (best-effort)', () => {
    // atob tolera algunas cadenas; lo que importa es que no lance.
    expect(() => decodeHashSource('***no-base64***')).not.toThrow();
  });
});
