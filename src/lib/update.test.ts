import { describe, expect, it } from 'vitest';
import { isNewer } from './update';

describe('isNewer', () => {
  it('is true only for a different, well-formed live build', () => {
    expect(isNewer('m3x9k2a1\n', 'm3x9k0zz')).toBe(true);
    expect(isNewer('m3x9k2a1', 'm3x9k2a1')).toBe(false);
    expect(isNewer(null, 'm3x9k2a1')).toBe(false);
    expect(isNewer('', 'm3x9k2a1')).toBe(false);
    expect(isNewer('<!doctype html>', 'm3x9k2a1')).toBe(false); // a fallback page is not a build name
    expect(isNewer('m3x9k2a1', '')).toBe(false);
  });
});
