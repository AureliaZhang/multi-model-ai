import { describe, it, expect } from 'vitest';
import { getErrorMessage, isAbortError } from './errors';

describe('getErrorMessage', () => {
  it('reads Error.message', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('uses fallback for empty Error.message', () => {
    expect(getErrorMessage(new Error(''), 'fb')).toBe('fb');
  });

  it('returns string throws as-is', () => {
    expect(getErrorMessage('plain')).toBe('plain');
  });

  it('reads .message / .error on plain objects', () => {
    expect(getErrorMessage({ message: 'm' })).toBe('m');
    expect(getErrorMessage({ error: 'e' })).toBe('e');
  });

  it('falls back for unhelpful values', () => {
    expect(getErrorMessage(null, 'fb')).toBe('fb');
    expect(getErrorMessage(undefined, 'fb')).toBe('fb');
  });
});

describe('isAbortError', () => {
  it('detects AbortError / TimeoutError by name', () => {
    expect(isAbortError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isAbortError(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(true);
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError('nope')).toBe(false);
  });
});
