import type { ParseError } from './types';

export function stripComment(line: string): string {
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}

export function indexOfOutsideBrackets(s: string, ch: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === ch) return i;
  }
  return -1;
}

export function splitOutsideBrackets(s: string, ch: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === ch) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

export type ArrowMatch = {
  idx: number;
  len: number;
  type: 'directed' | 'bidirectional' | 'undirected';
};

export function findArrowOperator(s: string): ArrowMatch | null {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '[') {
      depth++;
      continue;
    }
    if (c === ']') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;
    if (c === '<' && s[i + 1] === '>') {
      return { idx: i, len: 2, type: 'bidirectional' };
    }
    if (c === '-' && s[i + 1] === '-') {
      return { idx: i, len: 2, type: 'undirected' };
    }
    if (c === '>') {
      return { idx: i, len: 1, type: 'directed' };
    }
  }
  return null;
}

export function parseAttrs(
  s: string,
  lineNum: number,
  errors: ParseError[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of splitOutsideBrackets(s, ',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      errors.push({
        line: lineNum,
        message: `Atributo "${trimmed}" debe tener formato "clave: valor"`,
      });
      continue;
    }
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (!key) {
      errors.push({ line: lineNum, message: 'Clave vacia en atributo' });
      continue;
    }
    result[key] = value;
  }
  return result;
}

export function detectDiagramType(source: string): 'flowchart' | 'sequence' | 'er' {
  for (const rawLine of source.split('\n')) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    const m = line.match(/^type\s*:\s*(\w+)$/i);
    if (m) {
      const v = m[1].toLowerCase();
      if (v === 'sequence' || v === 'er' || v === 'flowchart') return v;
    }
    // Don't keep scanning if we hit something that isn't type/title/comment
    if (!/^(title|comment)/i.test(line)) break;
  }
  return 'flowchart';
}

export function parseTitle(source: string): string | undefined {
  for (const rawLine of source.split('\n')) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    const m = line.match(/^title\s*:?\s*(.+)$/i);
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    if (!/^(type|comment)/i.test(line)) break;
  }
  return undefined;
}
