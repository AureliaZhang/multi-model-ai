import { describe, it, expect } from 'vitest';
import { normalizeMarkdown } from './markdown';

describe('normalizeMarkdown', () => {
  it('returns empty-ish content unchanged', () => {
    expect(normalizeMarkdown('')).toBe('');
    expect(normalizeMarkdown('hello')).toBe('hello');
  });

  it('inserts a separator row for pipe tables missing one', () => {
    const input = ['| Name | Age |', '| Alice | 30 |', '| Bob | 25 |'].join('\n');
    const out = normalizeMarkdown(input);
    const lines = out.split('\n');
    expect(lines[0]).toBe('| Name | Age |');
    expect(lines[1]).toMatch(/---/);
    expect(lines[2]).toContain('Alice');
  });

  it('does not double-insert when separator already present', () => {
    const input = ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n');
    const out = normalizeMarkdown(input);
    expect(out.split('\n').filter((l) => l.includes('---')).length).toBe(1);
    expect(out).toContain('| 1 | 2 |');
  });

  it('leaves fenced code blocks alone (even if they contain pipes)', () => {
    const input = ['```', '| not | a | table |', '```'].join('\n');
    expect(normalizeMarkdown(input)).toBe(input);
  });

  it('ignores single-pipe prose', () => {
    const input = 'use the | operator carefully';
    expect(normalizeMarkdown(input)).toBe(input);
  });
});
