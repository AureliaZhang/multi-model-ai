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
