import { describe, it, expect } from 'vitest';
import { lintDiagram } from './lintDiagram';
import { parse } from '../parser/parse';
import type { FlowchartAST } from '../parser/types';

function lint(src: string) {
  const r = parse(src);
  if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
  return lintDiagram(r.ast as FlowchartAST);
}

describe('lintDiagram', () => {
  it('detecta nodo aislado', () => {
    const issues = lint('A > B\nC\n');
    expect(issues.some((i) => i.nodeId === 'C' && i.message.includes('aislado'))).toBe(true);
  });

  it('detecta nodo sin label descriptivo', () => {
    const issues = lint('A [label: Inicio]\nB\nA > B\n');
    expect(issues.some((i) => i.nodeId === 'B' && i.message.includes('label'))).toBe(true);
    expect(issues.some((i) => i.nodeId === 'A')).toBe(false);
  });

  it('detecta nodo bloqueado', () => {
    const issues = lint('A [status: blocked]\nB\nA > B\n');
    expect(issues.some((i) => i.nodeId === 'A' && i.level === 'warn' && i.message.includes('blocked'))).toBe(true);
  });

  it('avisa feature done sin tests', () => {
    const issues = lint('A [labels: feature, status: done]\nB\nA > B\n');
    expect(issues.some((i) => i.nodeId === 'A' && i.message.includes('sin tests'))).toBe(true);
  });

  it('no avisa si la feature done tiene tests', () => {
    const issues = lint('A [labels: feature, status: done, tests: a.test.ts]\nB\nA > B\n');
    expect(issues.some((i) => i.message.includes('sin tests'))).toBe(false);
  });

  it('avisa goals sin features', () => {
    const issues = lint('A [labels: goal]\nB [labels: goal]\nA > B\n');
    expect(issues.some((i) => i.message.includes('ninguna feature'))).toBe(true);
  });

  it('detecta ciclo', () => {
    const issues = lint('A > B\nB > C\nC > A\n');
    expect(issues.some((i) => i.message.includes('ciclo'))).toBe(true);
  });

  it('edge a nodo inexistente NO aparece (el parser crea el nodo)', () => {
    // el parser materializa nodos referenciados, asi que no deberia haber error.
    const issues = lint('A > B\n');
    expect(issues.some((i) => i.level === 'error')).toBe(false);
  });
});
