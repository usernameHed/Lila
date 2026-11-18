import { describe, expect, it } from 'vitest';
import { matchEnd, positionAt, samplesUntil } from './timeline';

// Three samples: t=0 at (0,0), t=5000 at (100,50), t=10000 at (200,50)
const path = [0, 0, 0, 5000, 100, 50, 10000, 200, 50];

describe('timeline', () => {
  it('counts the samples reached at time t', () => {
    expect(samplesUntil(path, -1)).toBe(0);
    expect(samplesUntil(path, 0)).toBe(1);
    expect(samplesUntil(path, 4999)).toBe(1);
    expect(samplesUntil(path, 5000)).toBe(2);
    expect(samplesUntil(path, 99999)).toBe(3);
  });

  it('interpolates between samples, holds the last one, is null before the first', () => {
    expect(positionAt(path, -1)).toBeNull();
    expect(positionAt(path, 2500)).toEqual({ u: 50, v: 25 });
    expect(positionAt(path, 7500)).toEqual({ u: 150, v: 50 });
    expect(positionAt(path, 20000)).toEqual({ u: 200, v: 50 });
  });

  it('does not divide by zero on two samples at the same time', () => {
    expect(positionAt([0, 1, 1, 0, 2, 2, 1000, 3, 3], 0)).toEqual({ u: 2, v: 2 });
  });

  it('ends the match at its last sample or event', () => {
    expect(matchEnd([path, []], [12000, 3000])).toBe(12000);
    expect(matchEnd([path], [])).toBe(10000);
  });
});
