import { describe, expect, it } from 'vitest';
import { installWay, offerPopup, platformOf } from './install';

describe('install as an app', () => {
  it('knows how each browser installs', () => {
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari', 5)).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 0)).toBe('mac-safari');
    expect(platformOf('Mozilla/5.0 (Macintosh) Chrome/131.0 Safari/537.36', 0)).toBe('other');
    expect(installWay({ installed: false, canPrompt: true, platform: 'other' })).toBe('prompt');
    expect(installWay({ installed: false, canPrompt: false, platform: 'mac-safari' })).toBe('safari');
    expect(installWay({ installed: true, canPrompt: true, platform: 'other' })).toBeNull();
    expect(installWay({ installed: false, canPrompt: false, platform: 'other' })).toBeNull();
  });

  it('offers the popup on a computer only, and not for 30 days after "Not now"', () => {
    const now = 1_000_000_000_000;
    expect(offerPopup({ phone: false, way: 'prompt', laterAt: null, now })).toBe(true);
    expect(offerPopup({ phone: true, way: 'prompt', laterAt: null, now })).toBe(false);
    expect(offerPopup({ phone: false, way: 'prompt', laterAt: now - 86_400_000, now })).toBe(false);
    expect(offerPopup({ phone: false, way: 'prompt', laterAt: now - 31 * 86_400_000, now })).toBe(true);
    expect(offerPopup({ phone: false, way: null, laterAt: null, now })).toBe(false);
  });
});
