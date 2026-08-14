import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage (client)', () => {
  it('reads Error.message', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns string throws as-is', () => {
    expect(getErrorMessage('plain')).toBe('plain');
  });

  it('reads .message / .error on plain objects', () => {
    expect(getErrorMessage({ message: 'm' })).toBe('m');
    expect(getErrorMessage({ error: 'e' })).toBe('e');
  });

  it('falls back for null/undefined', () => {
    expect(getErrorMessage(null, 'fb')).toBe('fb');
    expect(getErrorMessage(undefined, 'fb')).toBe('fb');
  });
});

// v0.7.64: friendly error mapping (§10.9 P2 #7)
import { friendlyErrorKey } from './errors';
import { describe as d2, it as it2, expect as e2 } from 'vitest';

d2('friendlyErrorKey', () => {
  it2('maps the common failure families to actionable keys', () => {
    e2(friendlyErrorKey('No healthy stations available for model "gpt"')).toBe('error.noStation');
    e2(friendlyErrorKey('Monthly token quota exceeded')).toBe('error.quota');
    e2(friendlyErrorKey('Too Many Requests')).toBe('error.rateLimit');
    e2(friendlyErrorKey('Network error: Failed to fetch')).toBe('error.network');
    e2(friendlyErrorKey('Request timed out after 30s')).toBe('error.timeout');
    e2(friendlyErrorKey('Invalid token')).toBe('error.auth');
  });
  it2('unknown messages pass through as null (caller shows the raw text)', () => {
    e2(friendlyErrorKey('Something exotic happened')).toBeNull();
    e2(friendlyErrorKey('')).toBeNull();
  });

  // v0.7.89 — the other half of the contract in server noStationMessage().
  // These strings are copied verbatim from it; if it changes, this fails.
  it2('tells the three no-station causes apart', () => {
    e2(friendlyErrorKey('Model "gpt-4o" is not enabled for use — an admin must enable it in Settings'))
      .toBe('error.modelNotEnabled');
    e2(friendlyErrorKey('Every station providing model "gpt-4o" is disabled'))
      .toBe('error.stationDisabled');
    e2(friendlyErrorKey('No station provides model "gpt-4o" — it may have been renamed or removed'))
      .toBe('error.modelUnknown');
  });

  // v0.7.90 — upstream refusals, copied verbatim from upstreamFailureMessage().
  // These are the "not your config, or your key" family, as opposed to the
  // pool-state family above.
  it2('tells the upstream refusal causes apart', () => {
    e2(friendlyErrorKey('Upstream rejected the credentials (401/403)')).toBe('error.upstreamAuth');
    e2(friendlyErrorKey('Upstream endpoint or model not found (404)')).toBe('error.upstreamNotFound');
    e2(friendlyErrorKey('Upstream rate limited the request (429)')).toBe('error.upstreamRateLimited');
    e2(friendlyErrorKey('Upstream returned a server error (5xx)')).toBe('error.upstreamServerError');
    e2(friendlyErrorKey('Could not reach any station')).toBe('error.upstreamUnreachable');
    e2(friendlyErrorKey('All stations failed')).toBe('error.allStationsFailed');
  });
});
