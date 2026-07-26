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
});
