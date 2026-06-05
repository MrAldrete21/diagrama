import { describe, it, expect } from 'vitest';
import {
  appendNode,
  appendEdge,
  updateNodeAttrInPlace,
  removeNodeAttrInPlace,
  setNodeConstraints,
  buildCopySnippet,
  renameSnippetIds,
  removeNodeFromSource,
  removeEdgeFromSource,
  reverseEdgeInPlace,
} from './edit';
import { parse } from '../parser/parse';
import type { FlowchartAST } from '../parser/types';

function flow(src: string): FlowchartAST {
  const r = parse(src);
  if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
  return r.ast;
}
const nodeLine = (src: string, id: string) =>
  parse(src).ast.type === 'flowchart'
    ? flow(src).nodes.find((n) => n.id === id)
    : undefined;

describe('edit: append', () => {
  it('appendNode rectangle agrega la linea', () => {
    expect(appendNode('A\n', 'B', 'rectangle')).toBe('A\nB\n');
  });
  it('appendNode con shape', () => {
    expect(appendNode('A\n', 'B', 'cylinder')).toBe('A\nB [shape: cylinder]\n');
  });
  it('appendEdge', () => {
    expect(appendEdge('A\nB\n', 'A', 'B')).toBe('A\nB\nA > B\n');
  });
  it('reverseEdgeInPlace invierte A > B a B > A', () => {
    expect(reverseEdgeInPlace('A\nB\nA > B\n', 'A', 'B', 3)).toBe('A\nB\nB > A\n');
  });
  it('reverseEdgeInPlace conserva label y attrs', () => {
    const src = 'A > B: hace login [style: dashed]\n';
    expect(reverseEdgeInPlace(src, 'A', 'B', 1)).toBe('B > A: hace login [style: dashed]\n');
  });
  it('reverseEdgeInPlace no toca cartesianos', () => {
    const src = 'A, B > C, D\n';
    expect(reverseEdgeInPlace(src, 'A', 'C', 1)).toBe(src);
  });

  it('appendEdge condicional con label', () => {
    expect(appendEdge('A\nB\n', 'A', 'B', { label: 'hacer login', conditional: true })).toBe(
      'A\nB\nA > B: hacer login [conditional: true]\n',
    );
  });
  it('appendEdge condicional sin label', () => {
    expect(appendEdge('A\nB\n', 'A', 'B', { conditional: true })).toBe(
      'A\nB\nA > B: [conditional: true]\n',
    );
  });
  it('appendEdge saca corchetes del label', () => {
    expect(appendEdge('A\nB\n', 'A', 'B', { label: 'a [x] b', conditional: true })).toBe(
      'A\nB\nA > B: a  x  b [conditional: true]\n',
    );
  });
});

describe('edit: attrs in place', () => {
  it('updateNodeAttrInPlace setea en la decl pura', () => {
    const out = updateNodeAttrInPlace('A\n', 'A', 1, 'color', '#fff');
    expect(nodeLine(out, 'A')!.color).toBe('#fff');
  });
  it('removeNodeAttrInPlace quita el attr', () => {
    const withColor = updateNodeAttrInPlace('A\n', 'A', 1, 'color', '#fff');
    const out = removeNodeAttrInPlace(withColor, 'A', 1, 'color');
    expect(nodeLine(out, 'A')!.color).toBeUndefined();
  });
});

describe('edit: constraints', () => {
  it('setNodeConstraints escribe ids', () => {
    const out = setNodeConstraints('A\n', 'A', 1, ['B', 'C']);
    expect(nodeLine(out, 'A')!.constraints).toEqual(['B', 'C']);
  });
  it('setNodeConstraints con lista vacia los quita', () => {
    const withC = setNodeConstraints('A\n', 'A', 1, ['B']);
    const out = setNodeConstraints(withC, 'A', 1, []);
    expect(nodeLine(out, 'A')!.constraints).toBeUndefined();
  });
});

describe('edit: copy snippet (sin marcador)', () => {
  it('NO incluye __diagrama_copy__', () => {
    const ast = flow('A [label: Uno]\nB\nA > B\n');
    const snip = buildCopySnippet(ast, new Set(['A', 'B']));
    expect(snip).not.toContain('__diagrama_copy__');
    expect(snip).toContain('A > B');
    expect(snip).toContain('label: Uno');
  });
  it('solo incluye edges con ambos extremos en la seleccion', () => {
    const ast = flow('A\nB\nC\nA > B\nB > C\n');
    const snip = buildCopySnippet(ast, new Set(['A', 'B']));
    expect(snip).toContain('A > B');
    expect(snip).not.toContain('B > C');
  });
});

describe('edit: renameSnippetIds', () => {
  it('renombra ids que colisionan con sufijo _N', () => {
    const { map, text } = renameSnippetIds('A\nA > B\nB\n', new Set(['A', 'B']));
    expect(map['A']).toBe('A_1');
    expect(map['B']).toBe('B_1');
    expect(text).toContain('A_1 > B_1');
  });
});

describe('edit: remove', () => {
  it('removeNodeFromSource quita decl + edges que lo referencian', () => {
    const out = removeNodeFromSource('A\nB\nA > B\n', 'B');
    const ast = flow(out);
    expect(ast.nodes.map((n) => n.id)).toEqual(['A']);
    expect(ast.edges).toHaveLength(0);
  });
  it('removeEdgeFromSource en cartesiano deja los sobrevivientes', () => {
    const out = removeEdgeFromSource('A, B > C, D\n', 'A', 'C', 1);
    const edges = flow(out).edges.map((e) => `${e.from}>${e.to}`).sort();
    expect(edges).toEqual(['A>D', 'B>C', 'B>D']);
  });
});
