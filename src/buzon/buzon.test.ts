import { describe, it, expect } from 'vitest';
import {
  encodeBuzon,
  decodeBuzon,
  computeBuzonStatus,
  buzonProgress,
  listComplete,
  itemComplete,
  seedBuzon,
  emptyBuzon,
} from './buzon';
import type { BuzonData } from '../parser/types';

const sample: BuzonData = {
  lists: [
    {
      id: 'l1',
      name: 'Senas',
      items: [
        { id: 'i1', name: 'HOLA', files: ['progreso/x/hola.mp4'] },
        { id: 'i2', name: 'GRACIAS', files: [] },
      ],
    },
    {
      id: 'l2',
      name: 'Capturas',
      items: [{ id: 'i3', name: 'player', files: ['progreso/x/p.png'] }],
    },
  ],
};

describe('buzon: encode/decode', () => {
  it('round-trip base64-JSON', () => {
    expect(decodeBuzon(encodeBuzon(sample))).toEqual(sample);
  });

  it('decode invalido -> vacio', () => {
    expect(decodeBuzon('@@no-base64@@')).toEqual(emptyBuzon());
  });

  it('normaliza datos parciales', () => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify({ lists: [{ name: 'A' }] }))));
    const d = decodeBuzon(enc);
    expect(d.lists).toHaveLength(1);
    expect(d.lists[0].name).toBe('A');
    expect(d.lists[0].items).toEqual([]);
    expect(typeof d.lists[0].id).toBe('string');
  });
});

describe('buzon: completitud', () => {
  it('itemComplete = tiene archivos o texto (buzon de texto)', () => {
    expect(itemComplete({ id: 'a', name: 'x', files: [] })).toBe(false);
    expect(itemComplete({ id: 'a', name: 'x', files: ['f'] })).toBe(true);
    expect(itemComplete({ id: 'a', name: 'x', files: [], text: 'respuesta' })).toBe(true);
    expect(itemComplete({ id: 'a', name: 'x', files: [], text: '   ' })).toBe(false);
  });

  it('normalize conserva el texto de la respuesta', () => {
    const enc = btoa(
      unescape(
        encodeURIComponent(
          JSON.stringify({ lists: [{ id: 'l', name: 'Q', items: [{ id: 'i', name: 'p', files: [], text: 'hola' }] }] }),
        ),
      ),
    );
    expect(decodeBuzon(enc).lists[0].items[0].text).toBe('hola');
  });

  it('listComplete = no vacia y todos los items con archivo', () => {
    expect(listComplete(sample.lists[0])).toBe(false); // GRACIAS sin archivo
    expect(listComplete(sample.lists[1])).toBe(true);
    expect(listComplete({ id: 'z', name: 'z', items: [] })).toBe(false);
  });

  it('progreso cuenta items y listas', () => {
    const p = buzonProgress(sample);
    expect(p).toEqual({ totalItems: 3, doneItems: 2, totalLists: 2, doneLists: 1 });
  });
});

describe('buzon: status derivado', () => {
  it('todo si vacio', () => {
    expect(computeBuzonStatus(emptyBuzon())).toBe('todo');
  });

  it('wip si hay algun archivo pero falta', () => {
    expect(computeBuzonStatus(sample)).toBe('wip');
  });

  it('done si todas las listas completas', () => {
    const all: BuzonData = {
      lists: [
        { id: 'l1', name: 'A', items: [{ id: 'i1', name: 'x', files: ['f'] }] },
        { id: 'l2', name: 'B', items: [{ id: 'i2', name: 'y', files: ['g'] }] },
      ],
    };
    expect(computeBuzonStatus(all)).toBe('done');
  });
});

describe('buzon: seed desde items viejos', () => {
  it('migra items: a una lista "Pedidos"', () => {
    const seeded = seedBuzon(undefined, ['video', 'foto']);
    expect(seeded.lists).toHaveLength(1);
    expect(seeded.lists[0].name).toBe('Pedidos');
    expect(seeded.lists[0].items.map((i) => i.name)).toEqual(['video', 'foto']);
  });

  it('si ya hay buzon con listas, no re-siembra', () => {
    expect(seedBuzon(sample, ['x'])).toBe(sample);
  });
});
