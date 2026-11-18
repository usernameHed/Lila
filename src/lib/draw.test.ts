import { describe, expect, it } from 'vitest';
import { DENSITY_SHARE, pathDensity } from './draw';

describe('pathDensity', () => {
  it('makes the busiest corridor equally bright whatever the number of matches', () => {
    const brightest = (n: number) => 1 - Math.pow(1 - pathDensity(n), DENSITY_SHARE * n);
    expect(brightest(566)).toBeCloseTo(0.9); // Ambrose Valley, every match
    expect(brightest(59)).toBeCloseTo(0.9); // Grand Rift, every match
    expect(pathDensity(566)).toBeLessThan(pathDensity(59)); // so each line is fainter where there are more
  });
});
