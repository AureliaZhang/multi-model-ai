import { describe, it, expect } from 'vitest';
import { isProbeJobEnabled } from './healthCheck';

/**
 * v0.7.97 — both probe jobs default OFF. The 60s sweep sent ~1,440 unsolicited
 * requests per station per day and a relay banned the owner's account for it,
 * so "unset means off" is the property that matters here, not a nicety.
 */
describe('isProbeJobEnabled (v0.7.97)', () => {
  it('is off when the variable is absent or blank — the case that matters', () => {
    expect(isProbeJobEnabled(undefined)).toBe(false);
    expect(isProbeJobEnabled('')).toBe(false);
    expect(isProbeJobEnabled('   ')).toBe(false);
  });

  it('stays off for every spelling of "no", so a stale falsy value cannot switch it on', () => {
    for (const v of ['0', 'false', 'no', 'off', 'FALSE', 'Off', ' no ']) {
      expect(isProbeJobEnabled(v)).toBe(false);
    }
  });

  it('turns on only when something affirmative is set', () => {
    for (const v of ['1', 'true', 'yes', 'on', 'TRUE']) {
      expect(isProbeJobEnabled(v)).toBe(true);
    }
  });
});
