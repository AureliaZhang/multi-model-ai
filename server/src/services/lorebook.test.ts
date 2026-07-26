import { describe, it, expect } from 'vitest';
import {
  parseLorebookKeywords,
  lorebookValidationError,
  matchLorebookEntries,
  buildLorebookContext,
  canModifyLorebookEntry,
  type LorebookEntry,
} from './lorebook';

// Project lorebook (v0.7.72): pure keyword parsing / matching / rendering /
// permission logic. The route layer is a thin DB wrapper over these.

function entry(over: Partial<LorebookEntry>): LorebookEntry {
  return {
    id: 'e1',
    title: '条目',
    keywords: ['关键词'],
    content: '内容',
    enabled: true,
    priority: 0,
    createdBy: 'u1',
    createdAt: '2026-07-26T00:00:00.000Z',
    updatedAt: '2026-07-26T00:00:00.000Z',
    ...over,
  };
}

describe('parseLorebookKeywords', () => {
  it('accepts arrays and comma/、/newline separated strings, trims, dedupes case-insensitively', () => {
    expect(parseLorebookKeywords(['A', ' a ', 'B', ''])).toEqual(['A', 'B']);
    expect(parseLorebookKeywords('补贴, 政策、新能源\nEV')).toEqual(['补贴', '政策', '新能源', 'EV']);
    expect(parseLorebookKeywords(undefined)).toEqual([]);
    expect(parseLorebookKeywords(42)).toEqual([]);
  });
  it('caps count at 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => `k${i}`);
    expect(parseLorebookKeywords(many)).toHaveLength(20);
  });
});

describe('lorebookValidationError', () => {
  it('requires title, content and at least one keyword', () => {
    expect(lorebookValidationError({ title: '', content: 'x', keywords: ['k'] })).toBe('title_required');
    expect(lorebookValidationError({ title: 't', content: '  ', keywords: ['k'] })).toBe('content_required');
    expect(lorebookValidationError({ title: 't', content: 'x', keywords: [] })).toBe('keywords_required');
    expect(lorebookValidationError({ title: 't', content: 'x', keywords: ['k'] })).toBeNull();
  });
  it('rejects oversize title/content', () => {
    expect(lorebookValidationError({ title: 'x'.repeat(121), content: 'x', keywords: ['k'] })).toBe('title_too_long');
    expect(lorebookValidationError({ title: 't', content: 'x'.repeat(4001), keywords: ['k'] })).toBe('content_too_long');
  });
});

describe('matchLorebookEntries', () => {
  it('matches CJK substrings and is case-insensitive for latin keywords', () => {
    const entries = [
      entry({ id: 'a', keywords: ['新能源'] }),
      entry({ id: 'b', keywords: ['EV'] }),
      entry({ id: 'c', keywords: ['风电'] }),
    ];
    const hits = matchLorebookEntries('我们聊聊新能源车和 ev 补贴', entries);
    expect(hits.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('skips disabled entries and empty scan text', () => {
    const entries = [entry({ id: 'a', enabled: false, keywords: ['新能源'] })];
    expect(matchLorebookEntries('新能源', entries)).toEqual([]);
    expect(matchLorebookEntries('   ', [entry({})])).toEqual([]);
  });

  it('orders by priority then recency, and respects entry/char budgets', () => {
    const entries = [
      entry({ id: 'low', priority: 0, keywords: ['x'], updatedAt: '2026-07-26T01:00:00Z' }),
      entry({ id: 'high', priority: 5, keywords: ['x'] }),
      entry({ id: 'mid-new', priority: 1, keywords: ['x'], updatedAt: '2026-07-26T02:00:00Z' }),
      entry({ id: 'mid-old', priority: 1, keywords: ['x'], updatedAt: '2026-07-26T00:30:00Z' }),
    ];
    const hits = matchLorebookEntries('x', entries);
    expect(hits.map((e) => e.id)).toEqual(['high', 'mid-new', 'mid-old', 'low']);

    // maxEntries cap
    expect(matchLorebookEntries('x', entries, { maxEntries: 2 }).map((e) => e.id)).toEqual(['high', 'mid-new']);

    // char budget: the FIRST match always survives even when over budget alone;
    // later ones that do not fit are skipped without starving smaller ones.
    const big = entry({ id: 'big', priority: 9, keywords: ['x'], content: 'c'.repeat(500) });
    const small = entry({ id: 'small', priority: 1, keywords: ['x'], content: 'tiny' });
    const budgeted = matchLorebookEntries('x', [small, big], { budgetChars: 100 });
    expect(budgeted.map((e) => e.id)).toEqual(['big']); // big sorts first (priority), small no longer fits
    const roomy = matchLorebookEntries('x', [small, big], { budgetChars: 600 });
    expect(roomy.map((e) => e.id)).toEqual(['big', 'small']); // both fit a roomier budget
  });

  it('ignores whitespace-only keywords', () => {
    expect(matchLorebookEntries('anything', [entry({ keywords: ['  '] })])).toEqual([]);
  });
});

describe('buildLorebookContext', () => {
  it('renders matched entries as one framed block; null when empty', () => {
    expect(buildLorebookContext([])).toBeNull();
    const ctx = buildLorebookContext([
      entry({ title: '客户偏好', content: '客户 A 只接受周报形式汇报。' }),
      entry({ title: '项目黑话', content: '「丑猫」指内部测试中转站。' }),
    ]);
    expect(ctx).toContain('项目世界书');
    expect(ctx).toContain('【客户偏好】');
    expect(ctx).toContain('「丑猫」指内部测试中转站。');
  });
});

describe('canModifyLorebookEntry', () => {
  it('admin always; owner yes; others / anonymous / legacy-null no', () => {
    expect(canModifyLorebookEntry({ createdBy: 'u1' }, { id: 'x', role: 'admin' })).toBe(true);
    expect(canModifyLorebookEntry({ createdBy: 'u1' }, { id: 'u1', role: 'member' })).toBe(true);
    expect(canModifyLorebookEntry({ createdBy: 'u1' }, { id: 'u2', role: 'member' })).toBe(false);
    expect(canModifyLorebookEntry({ createdBy: null }, { id: 'u2', role: 'member' })).toBe(false);
    expect(canModifyLorebookEntry({ createdBy: 'u1' }, undefined)).toBe(false);
  });
});
