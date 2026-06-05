import { describe, it, expect } from 'vitest';
import { cleanImport } from './importText';
import { parse } from '../parser/parse';

describe('cleanImport', () => {
  it('deja el texto plano intacto (solo trim)', () => {
    expect(cleanImport('A > B\n')).toBe('A > B');
  });

  it('quita el cerco ``` simple', () => {
    expect(cleanImport('```\nA > B\n```')).toBe('A > B');
  });

  it('quita el cerco con lenguaje (```dsl)', () => {
    expect(cleanImport('```dsl\nA > B\nB > C\n```')).toBe('A > B\nB > C');
  });

  it('normaliza CRLF', () => {
    expect(cleanImport('A > B\r\nB > C\r\n')).toBe('A > B\nB > C');
  });

  it('tolera cerco de apertura sin cierre', () => {
    expect(cleanImport('```\nA > B')).toBe('A > B');
  });

  it('el resultado parsea como flowchart valido', () => {
    const r = parse(cleanImport('```\ntype: flowchart\nA > B: ok\n```'));
    expect(r.ast.type).toBe('flowchart');
    expect(r.errors).toHaveLength(0);
    if (r.ast.type === 'flowchart') {
      expect(r.ast.nodes.map((n) => n.id).sort()).toEqual(['A', 'B']);
      expect(r.ast.edges).toHaveLength(1);
    }
  });
});
