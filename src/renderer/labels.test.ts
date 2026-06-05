import { describe, it, expect } from 'vitest';
import {
  PRESET_LABELS,
  labelDef,
  resolveLabelDescription,
  hasLabelOverride,
} from './labels';

describe('labels', () => {
  it('incluye las dos labels preset ai-decision (auto y user)', () => {
    const auto = labelDef('ai-decision');
    expect(auto.display).toBe('Ai decision (auto)');
    expect(auto.description.length).toBeGreaterThan(0);
    const user = labelDef('ai-decision-user');
    expect(user.display).toBe('Ai decision (user)');
    expect(user.description.length).toBeGreaterThan(0);
    expect(PRESET_LABELS.some((l) => l.key === 'ai-decision')).toBe(true);
    expect(PRESET_LABELS.some((l) => l.key === 'ai-decision-user')).toBe(true);
  });

  it('resolveLabelDescription devuelve el default sin override', () => {
    expect(resolveLabelDescription('feature')).toBe(labelDef('feature').description);
  });

  it('resolveLabelDescription usa el override cuando existe', () => {
    const ov = { feature: 'texto custom' };
    expect(resolveLabelDescription('feature', ov)).toBe('texto custom');
  });

  it('un override vacio (o whitespace) cae al default', () => {
    expect(resolveLabelDescription('feature', { feature: '   ' })).toBe(
      labelDef('feature').description,
    );
  });

  it('resuelve la key case-insensitive', () => {
    expect(resolveLabelDescription('Feature', { feature: 'x' })).toBe('x');
  });

  it('hasLabelOverride detecta overrides no vacios', () => {
    expect(hasLabelOverride('feature', { feature: 'x' })).toBe(true);
    expect(hasLabelOverride('feature', { feature: '  ' })).toBe(false);
    expect(hasLabelOverride('feature', {})).toBe(false);
    expect(hasLabelOverride('feature', undefined)).toBe(false);
  });
});
