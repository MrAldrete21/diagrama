import { describe, it, expect } from 'vitest';
import { buildDevPrompt } from './buildDevPrompt';
import { parse } from '../parser/parse';
import type { FlowchartAST } from '../parser/types';

const SRC = [
  'title: MiApp',
  'Login [label: Login, constraints: Auth]',
  'Auth [label: Auth JWT, labels: constraint]',
  'Feat [label: Una feature, labels: feature]',
  'Login > Feat',
  '',
].join('\n');

function build(): string {
  const r = parse(SRC);
  if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
  return buildDevPrompt(r.ast as FlowchartAST, SRC);
}

describe('buildDevPrompt', () => {
  it('usa el title como encabezado', () => {
    expect(build()).toContain('# Construir: MiApp');
  });

  it('incluye las secciones principales', () => {
    const out = build();
    expect(out).toContain('## Arquitectura');
    expect(out).toContain('## Flujo de datos');
    expect(out).toContain('## Features a construir');
    expect(out).toContain('## Requisitos / constraints');
    expect(out).toContain('## Orden de build sugerido');
    expect(out).toContain('## Instrucciones');
  });

  it('resuelve los constraints aplicados al texto del nodo', () => {
    expect(build()).toContain('constraints: Auth JWT');
  });

  it('el flujo usa los labels de los nodos, no los ids', () => {
    expect(build()).toContain('Login -> Una feature');
  });

  it('embebe el DSL fuente en un code block', () => {
    const out = build();
    expect(out).toContain('## Diagrama (DSL fuente)');
    expect(out).toContain('```');
    expect(out).toContain('Login [label: Login, constraints: Auth]');
  });

  it('emite la descripcion default de la label como blockquote', () => {
    // El label feature tiene descripcion default en labels.ts.
    expect(build()).toContain('> A capability the system provides.');
  });

  it('refleja el override de la descripcion de la label (labelPrompts)', () => {
    const r = parse(SRC);
    if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
    const out = buildDevPrompt(r.ast as FlowchartAST, SRC, {
      feature: 'Descripcion editada por el usuario.',
    });
    expect(out).toContain('> Descripcion editada por el usuario.');
    expect(out).not.toContain('> A capability the system provides.');
  });

  it('emite status, request y archivos del nodo', () => {
    const src = ['Api [label: API, status: wip, request: true, file: src/api.ts]', ''].join('\n');
    const r = parse(src);
    if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
    const out = buildDevPrompt(r.ast as FlowchartAST, src);
    expect(out).toContain('estado: wip');
    expect(out).toContain('PEDIDO');
    expect(out).toContain('archivos: src/api.ts');
  });

  it('emite los archivos de test (tests:) del nodo', () => {
    const src = ['Api [label: API, tests: src/api.test.ts]', ''].join('\n');
    const r = parse(src);
    if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
    const out = buildDevPrompt(r.ast as FlowchartAST, src);
    expect(out).toContain('tests: src/api.test.ts');
  });

  it('prompt incremental: onlyIds restringe a esos nodos', () => {
    const src = ['A\nB\nC\nA > B\nB > C\n'].join('');
    const r = parse(src);
    if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
    const out = buildDevPrompt(r.ast as FlowchartAST, src, undefined, new Set(['A', 'B']));
    expect(out).toContain('A -> B');
    // el edge B>C se omite porque C no esta en el scope
    expect(out).not.toContain('B -> C');
  });

  it('marca el connect condicional con ?> en el flujo', () => {
    const src = ['A\nB\nA > B: hacer login [conditional: true]\n'].join('');
    const r = parse(src);
    if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
    const out = buildDevPrompt(r.ast as FlowchartAST, src);
    expect(out).toContain('A ?> B: hacer login (condicional');
  });

  it('excluye nodos con noPrompt (y sus edges) del prompt', () => {
    const src = [
      'Visible [label: Visible, labels: feature]',
      'Oculto [label: Oculto, labels: feature, noPrompt: true]',
      'Visible > Oculto',
      '',
    ].join('\n');
    const r = parse(src);
    if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
    const out = buildDevPrompt(r.ast as FlowchartAST, src);
    expect(out).toContain('Visible');
    // el nodo oculto no aparece en arquitectura ni en las secciones
    expect(out).not.toContain('- Oculto');
    expect(out).not.toContain('**Oculto**');
    // el edge hacia el nodo oculto se omite
    expect(out).not.toContain('Visible -> Oculto');
  });

  it('refleja labels sin seccion propia en "Otras labels" (con override)', () => {
    const src = ['X [label: Una idea, labels: idea]', ''].join('\n');
    const r = parse(src);
    if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
    const out = buildDevPrompt(r.ast as FlowchartAST, src, { idea: 'Mi prompt de idea editado.' });
    expect(out).toContain('## Otras labels (semantica)');
    expect(out).toContain('Mi prompt de idea editado.');
    expect(out).toContain('Una idea');
  });

  it('soporta las dos labels ai-decision (auto y user) con secciones separadas', () => {
    const src = [
      'Bot [label: Router, labels: ai-decision]',
      'Rev [label: Aprobar pago, labels: ai-decision-user]',
      '',
    ].join('\n');
    const r = parse(src);
    if (r.ast.type !== 'flowchart') throw new Error('expected flowchart');
    const out = buildDevPrompt(r.ast as FlowchartAST, src);
    expect(out).toContain('## Decisiones por IA (automaticas)');
    expect(out).toContain('Router');
    expect(out).toContain('## Decisiones por IA (decision final del usuario)');
    expect(out).toContain('Aprobar pago');
  });
});
