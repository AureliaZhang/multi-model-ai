import { describe, it, expect, vi } from 'vitest';
import zh from './locales/zh';
import en from './locales/en';
// 源码原文：用来发现「同一个键写了两遍」。Vite 的 `?raw` 已由 vite/client 声明类型，
// 不需要为此引入 @types/node。
import zhSource from './locales/zh.ts?raw';
import enSource from './locales/en.ts?raw';

/**
 * i18n 词条契约（v0.7.98，§10.11 ① 客户端测试补齐）
 *
 * 为什么值得测：词条错了不会报错，只会让用户看到英文、看到 `settings.foo`
 * 这样的原始 key，或者看到 "已加载 {count} 条" 里的占位符没被替换。
 * 这类问题只能靠人眼发现——正是 §10.10 里说的「前端问题只能靠人肉发现」。
 *
 * 覆盖四件事：两边键对齐、源文件里没有重复键、占位符一致、值非空。
 */

type Dict = Record<string, string | string[]>;
const ZH = zh as Dict;
const EN = en as Dict;

/** 从源文件抓取顶层键，用来发现「同一个键写了两遍」——JS 对象字面量会静默保留后一个 */
function sourceKeys(src: string): string[] {
  return [...src.matchAll(/^\s{2}'([^']+)':/gm)].map((m) => m[1]);
}

/** 取出 {param} 形式的占位符集合 */
function placeholders(v: string | string[]): Set<string> {
  const text = Array.isArray(v) ? v.join('\n') : v;
  return new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

describe('i18n 词条对齐', () => {
  it('中英文键完全一致（漏翻会让用户看到英文）', () => {
    const zhKeys = Object.keys(ZH).sort();
    const enKeys = Object.keys(EN).sort();
    expect(zhKeys.filter((k) => !(k in EN))).toEqual([]);
    expect(enKeys.filter((k) => !(k in ZH))).toEqual([]);
    expect(zhKeys).toEqual(enKeys);
  });

  it('源文件里没有重复定义的键（重复会被静默覆盖，不报错）', () => {
    for (const [file, src] of [['zh.ts', zhSource], ['en.ts', enSource]] as const) {
      const keys = sourceKeys(src);
      expect(keys.length, `${file} 没抓到键，正则可能失配`).toBeGreaterThan(100);
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(dupes, `${file} 存在重复键`).toEqual([]);
    }
  });

  it('没有空词条（空字符串在界面上就是一片空白）', () => {
    for (const [name, dict] of [['zh', ZH], ['en', EN]] as const) {
      const empty = Object.entries(dict)
        .filter(([, v]) => (Array.isArray(v) ? v.length === 0 : !String(v).trim()))
        .map(([k]) => k);
      expect(empty, `${name} 存在空词条`).toEqual([]);
    }
  });

  it('同一个键的占位符两边必须一致（否则 {count} 会原样显示给用户）', () => {
    const mismatched: string[] = [];
    for (const key of Object.keys(ZH)) {
      if (!(key in EN)) continue;
      // `{s}` 是英文复数标记，由 t() 从 count 自动推导，中文本来就不需要它
      const a = placeholders(ZH[key]); a.delete('s');
      const b = placeholders(EN[key]); b.delete('s');
      if (a.size !== b.size || [...a].some((p) => !b.has(p))) {
        mismatched.push(`${key}: zh{${[...a]}} en{${[...b]}}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('{s} 只能出现在同时带 {count} 的词条里（否则推导不出单复数）', () => {
    const orphaned: string[] = [];
    for (const [name, dict] of [['zh', ZH], ['en', EN]] as const) {
      for (const [key, v] of Object.entries(dict)) {
        const p = placeholders(v);
        if (p.has('s') && !p.has('count')) orphaned.push(`${name}/${key}`);
      }
    }
    expect(orphaned).toEqual([]);
  });

  it('数组型词条两边都得是数组、且长度相同', () => {
    const bad: string[] = [];
    for (const key of Object.keys(ZH)) {
      if (!(key in EN)) continue;
      const a = ZH[key], b = EN[key];
      if (Array.isArray(a) !== Array.isArray(b)) bad.push(`${key}: 一边是数组一边不是`);
      else if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) {
        bad.push(`${key}: 长度 ${a.length} vs ${b.length}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('t() 取词逻辑', () => {
  /**
   * i18n store 在模块加载时就会读 localStorage / navigator（detectLocale），
   * node 环境下没有这两个东西，所以先打桩再动态 import。
   */
  async function loadStore(locale: 'zh' | 'en') {
    const store: Record<string, string> = { locale };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    });
    vi.stubGlobal('navigator', { language: locale === 'zh' ? 'zh-CN' : 'en-US' });
    vi.resetModules();
    const mod = await import('./index');
    return mod.useI18nStore.getState();
  }

  it('替换 {param} 占位符', async () => {
    const s = await loadStore('zh');
    expect(s.t('chat.loadMore', { count: 7 })).toBe('加载 7 条更多消息');
    // 多占位符一次全换
    expect(s.t('sidebar.importDone', { convs: 2, msgs: 30 })).toBe('已导入 2 个对话、30 条消息');
  });

  it('未提供的占位符原样保留，不会变成 undefined', async () => {
    const s = await loadStore('zh');
    expect(s.t('chat.loadMore')).toBe('加载 {count} 条更多消息');
  });

  it('英文环境取英文词条', async () => {
    const s = await loadStore('en');
    expect(s.t('chat.loadMore', { count: 3 })).toBe(EN['chat.loadMore'].toString().replace('{count}', '3'));
  });

  /**
   * v0.7.98 —— 这组是修 bug 时补的。原先 `{s}` 要靠调用点自己传，
   * 六个调用点里有四个忘了，英文界面真的会显示 "3 script{s}"、
   * "2 file{s} selected"；而站点数那处传成了 `count > 1`，
   * 0 个站点会显示 "0 station available"。现在由 t() 从 count 推导。
   */
  it('{s} 按 count 自动变单复数，调用点不用管', async () => {
    const s = await loadStore('en');
    expect(s.t('files.chunks', { count: 1 })).toBe('1 chunk');
    expect(s.t('files.chunks', { count: 5 })).toBe('5 chunks');
    expect(s.t('regex.scriptsCount', { count: 1 })).toBe('1 script');
    expect(s.t('files.selectedFiles', { count: 2 })).toBe('2 files selected');
  });

  it('0 用复数形式（英文语法，也是原先站点数那处的 bug）', async () => {
    const s = await loadStore('en');
    expect(s.t('model.stations', { count: 0 })).toBe('0 stations available');
    expect(s.t('users.count', { count: 0 })).toBe('0 users');
  });

  it('中文不受 {s} 影响', async () => {
    const s = await loadStore('zh');
    expect(s.t('files.chunks', { count: 1 })).toBe('1 个分块');
    expect(s.t('model.stations', { count: 0 })).toBe('0 个站点可用');
  });

  it('调用点若显式传了 s 仍然生效（不破坏既有写法）', async () => {
    const s = await loadStore('en');
    expect(s.t('files.chunks', { count: 5, s: '' })).toBe('5 chunk');
  });

  it('中文缺键时回落到英文，两边都没有才返回 key 本身', async () => {
    const s = await loadStore('zh');
    expect(s.t('绝对不存在的键')).toBe('绝对不存在的键');
  });

  it('数组型词条用换行拼接', async () => {
    const s = await loadStore('zh');
    const arrayKey = Object.keys(ZH).find((k) => Array.isArray(ZH[k]));
    if (!arrayKey) return; // 当前没有数组型词条时跳过
    expect(s.t(arrayKey)).toBe((ZH[arrayKey] as string[]).join('\n'));
  });
});
