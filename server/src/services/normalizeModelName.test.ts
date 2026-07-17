import { describe, it, expect } from 'vitest';
import { normalizeModelName } from './normalizeModelName';

describe('normalizeModelName', () => {
  it.each([
    ['  DeepSeek Chat  ', 'deepseek-chat'],
    ['DeepSeek_Chat', 'deepseek-chat'],
    ['GPT-4o', 'gpt-4o'],
    ['foo---bar', 'foo-bar'],
    ['-edge-', 'edge'],
    ['A B_C', 'a-b-c'],
    ['!!!', ''],
    ['already-ok', 'already-ok'],
    ['', ''],
    ['  ', ''],
    ['Claude 3.5 Sonnet', 'claude-35-sonnet'],
    ['vendor/model@v1', 'vendormodelv1'],
  ] as const)('normalizes %j → %j', (input, expected) => {
    expect(normalizeModelName(input)).toBe(expected);
  });
});
