import { describe, it, expect } from 'vitest';
import { parse } from './parse';
import type { FlowchartAST, ErAST, SequenceAST } from './types';

function flow(src: string): FlowchartAST {
  const r = parse(src);
  if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
  return r.ast;
}

describe('parse: flowchart basico', () => {
  it('nodos + edge dirigido', () => {
    const ast = flow('A\nB\nA > B\n');
    expect(ast.nodes.map((n) => n.id).sort()).toEqual(['A', 'B']);
    expect(ast.nodes.find((n) => n.id === 'A')!.label).toBe('A');
    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]).toMatchObject({ from: 'A', to: 'B', arrow: 'directed' });
  });

  it('default sin type: es flowchart, direction TB', () => {
    const ast = flow('A\n');
    expect(ast.direction).toBe('TB');
  });

  it('direction LR', () => {
    expect(flow('direction LR\nA\n').direction).toBe('LR');
  });
});

describe('parse: atributos de nodo', () => {
  it('label explicito y legacy bracket', () => {
    expect(flow('A [label: Hola]\n').nodes[0].label).toBe('Hola');
    expect(flow('A [Custom]\n').nodes[0].label).toBe('Custom');
  });

  it('shape', () => {
    expect(flow('A [shape: cylinder]\n').nodes[0].shape).toBe('cylinder');
  });

  it('labels separados por ;', () => {
    expect(flow('A [labels: goal; feature]\n').nodes[0].labels).toEqual(['goal', 'feature']);
  });

  it('constraints separados por ;', () => {
    expect(flow('A [constraints: B; C]\n').nodes[0].constraints).toEqual(['B', 'C']);
  });

  it('content viene decodeado de base64', () => {
    // btoa(unescape(encodeURIComponent('Hola'))) === 'SG9sYQ=='
    expect(flow('A [content: SG9sYQ==]\n').nodes[0].content).toBe('Hola');
  });

  it('noPrompt: true setea promptHidden', () => {
    expect(flow('A [noPrompt: true]\n').nodes[0].promptHidden).toBe(true);
    expect(flow('A [noPrompt: 1]\n').nodes[0].promptHidden).toBe(true);
    expect(flow('A [noPrompt: false]\n').nodes[0].promptHidden).toBe(false);
    expect(flow('A\n').nodes[0].promptHidden).toBeUndefined();
  });

  it('status valido + alias', () => {
    expect(flow('A [status: wip]\n').nodes[0].status).toBe('wip');
    expect(flow('A [status: done]\n').nodes[0].status).toBe('done');
    expect(flow('A [status: pending]\n').nodes[0].status).toBe('todo');
    expect(flow('A [status: in-progress]\n').nodes[0].status).toBe('wip');
    expect(flow('A [status: nope]\n').nodes[0].status).toBeUndefined();
  });

  it('request flag', () => {
    expect(flow('A [request: true]\n').nodes[0].request).toBe(true);
    expect(flow('A\n').nodes[0].request).toBeUndefined();
  });

  it('file separados por ;', () => {
    expect(flow('A [file: src/a.ts; src/b.tsx]\n').nodes[0].files).toEqual([
      'src/a.ts',
      'src/b.tsx',
    ]);
  });

  it('tests separados por ; (gemelo de file)', () => {
    expect(flow('A [tests: src/a.test.ts; src/b.test.ts]\n').nodes[0].tests).toEqual([
      'src/a.test.ts',
      'src/b.test.ts',
    ]);
    expect(flow('A\n').nodes[0].tests).toBeUndefined();
  });
});

describe('parse: robustez de atributos', () => {
  it('coma dentro de parentesis no parte el label', () => {
    const r = parse('A [label: USD a glTF (Blender, reusa el converter), status: todo]\n');
    expect(r.errors).toEqual([]);
    expect((r.ast as FlowchartAST).nodes[0].label).toBe('USD a glTF (Blender, reusa el converter)');
    expect((r.ast as FlowchartAST).nodes[0].status).toBe('todo');
  });

  it('coma en label sin parentesis: separa solo cuando sigue clave:', () => {
    const r = parse('A [label: 1. Empeza aca, segui las flechas, color: #dbeafe]\n');
    expect(r.errors).toEqual([]);
    expect((r.ast as FlowchartAST).nodes[0].label).toBe('1. Empeza aca, segui las flechas');
    expect((r.ast as FlowchartAST).nodes[0].color).toBe('#dbeafe');
  });

  it('brackets anidados en una ruta ([id].tsx) no rompen el parseo', () => {
    const r = parse('A [label: Catalogo, file: app/leccion/[id].tsx; app/lib/x.ts]\n');
    expect(r.errors).toEqual([]);
    expect((r.ast as FlowchartAST).nodes[0].files).toEqual([
      'app/leccion/[id].tsx',
      'app/lib/x.ts',
    ]);
  });

  it('colon dentro del label no se confunde con otra clave', () => {
    const r = parse('A [label: Menu file: exportar spec, status: done]\n');
    expect(r.errors).toEqual([]);
    expect((r.ast as FlowchartAST).nodes[0].label).toBe('Menu file: exportar spec');
    expect((r.ast as FlowchartAST).nodes[0].status).toBe('done');
  });
});

describe('parse: edges', () => {
  it('tipos de arrow', () => {
    expect(flow('A <> B\n').edges[0].arrow).toBe('bidirectional');
    expect(flow('A -- B\n').edges[0].arrow).toBe('undirected');
  });

  it('label en el edge', () => {
    expect(flow('A > B: hola\n').edges[0].label).toBe('hola');
  });

  it('cartesiano A, B > C, D = 4 edges', () => {
    expect(flow('A, B > C, D\n').edges).toHaveLength(4);
  });

  it('connect condicional: attr conditional + label como condicion', () => {
    const e = flow('A > B: hacer login [conditional: true]\n').edges[0];
    expect(e.conditional).toBe(true);
    expect(e.label).toBe('hacer login');
  });

  it('connect condicional sin label', () => {
    const e = flow('A > B: [conditional: true]\n').edges[0];
    expect(e.conditional).toBe(true);
    expect(e.label).toBeUndefined();
  });

  it('edge normal no es condicional', () => {
    expect(flow('A > B\n').edges[0].conditional).toBeUndefined();
  });
});

describe('parse: grupos', () => {
  it('asigna groupId a los miembros', () => {
    const ast = flow('group "Modulo" {\n  Y\n}\n');
    expect(ast.groups).toHaveLength(1);
    expect(ast.groups[0].label).toBe('Modulo');
    const y = ast.nodes.find((n) => n.id === 'Y')!;
    expect(y.groupId).toBe(ast.groups[0].id);
  });
});

describe('parse: deteccion de tipo', () => {
  it('er', () => {
    const r = parse('type: er\nUser {\n  id uuid pk\n  name string\n}\n');
    expect(r.ast.type).toBe('er');
    const er = r.ast as ErAST;
    expect(er.tables).toHaveLength(1);
    expect(er.tables[0].columns).toHaveLength(2);
    expect(er.tables[0].columns[0]).toMatchObject({ name: 'id', type: 'uuid', isPk: true });
  });

  it('sequence', () => {
    const r = parse('type: sequence\nAlice > Bob: hola\n');
    expect(r.ast.type).toBe('sequence');
    expect((r.ast as SequenceAST).messages.length).toBeGreaterThan(0);
  });
});

describe('parse: sin errores en input valido', () => {
  it('no reporta errores', () => {
    expect(parse('A [shape: diamond]\nB\nA > B: si\n').errors).toEqual([]);
  });
});
