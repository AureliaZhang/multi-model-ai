import { describe, it, expect } from 'vitest';
import {
  orderSystemContext,
  formatFileContext,
  formatMemoryContext,
  SYSTEM_CONTEXT_ORDER,
} from './chatContext';

/**
 * system 上下文的格式化与排序（v0.7.99，§10.11 ②）
 *
 * 重点是**顺序**：原先五段各自 unshift，最终顺序靠调用次序倒推，
 * 只写在一句注释里、零测试。挪动任何一段都不会报错，只会让提示词的
 * 层次悄悄变掉。这组测试把那句注释变成会失败的断言。
 */

describe('orderSystemContext · 顺序', () => {
  const all = {
    persona: '你是一个严谨的助理',
    webSearch: '联网结果……',
    lorebook: '世界书条目……',
    memory: '记忆片段……',
    fileRag: '文件片段……',
  };

  it('⚠ 全部存在时，顺序必须是 人设 → 联网 → 世界书 → 记忆 → 文件库', () => {
    expect(orderSystemContext(all)).toEqual([
      '你是一个严谨的助理',
      '联网结果……',
      '世界书条目……',
      '记忆片段……',
      '文件片段……',
    ]);
  });

  it('人设永远排第一 —— 它要框住后面所有材料', () => {
    expect(orderSystemContext(all)[0]).toBe(all.persona);
    // 即使只剩人设和最靠后的一项
    expect(orderSystemContext({ fileRag: 'F', persona: 'P' })).toEqual(['P', 'F']);
  });

  it('顺序常量本身也钉住（有人改常量时测试要响）', () => {
    expect([...SYSTEM_CONTEXT_ORDER]).toEqual(['persona', 'webSearch', 'lorebook', 'memory', 'fileRag']);
  });

  it('顺序与传入对象的键序无关', () => {
    const shuffled = {
      fileRag: '文件片段……',
      memory: '记忆片段……',
      persona: '你是一个严谨的助理',
      lorebook: '世界书条目……',
      webSearch: '联网结果……',
    };
    expect(orderSystemContext(shuffled)).toEqual(orderSystemContext(all));
  });
});

describe('orderSystemContext · 空值', () => {
  it('缺席的段被跳过，剩下的保持相对顺序', () => {
    expect(orderSystemContext({ persona: 'P', memory: 'M' })).toEqual(['P', 'M']);
    expect(orderSystemContext({ memory: 'M', persona: 'P' })).toEqual(['P', 'M']);
  });

  it('null / undefined / 空串 / 纯空白都算没有', () => {
    expect(orderSystemContext({ persona: null, webSearch: undefined, lorebook: '', memory: '   ', fileRag: '\n\t' }))
      .toEqual([]);
  });

  it('全空时返回空数组（调用方据此一条都不插）', () => {
    expect(orderSystemContext({})).toEqual([]);
  });
});

describe('formatFileContext', () => {
  it('单个片段：带文件名前缀', () => {
    expect(formatFileContext([{ fileName: 'spec.pdf', content: '第一章' }]))
      .toBe('以下是从文件库中检索到的相关内容：\n[spec.pdf] 第一章\n\n请基于这些文件内容回答用户的问题。');
  });

  it('多个片段用空行分隔，顺序保持', () => {
    const out = formatFileContext([
      { fileName: 'a.md', content: 'AAA' },
      { fileName: 'b.md', content: 'BBB' },
    ])!;
    expect(out).toContain('[a.md] AAA\n\n[b.md] BBB');
    expect(out.indexOf('AAA')).toBeLessThan(out.indexOf('BBB'));
  });

  it('没有片段时返回 null，而不是一段空壳提示词', () => {
    expect(formatFileContext([])).toBeNull();
  });
});

describe('formatMemoryContext', () => {
  it('只取 summary，逐条列成 - 开头', () => {
    const out = formatMemoryContext([{ summary: '用户偏好简洁回答' }, { summary: '项目用 SQLite' }])!;
    expect(out).toContain('- 用户偏好简洁回答\n- 项目用 SQLite');
    expect(out.startsWith('以下是从记忆库中检索到的相关记忆')).toBe(true);
  });

  it('没有记忆时返回 null', () => {
    expect(formatMemoryContext([])).toBeNull();
  });

  it('⚠ 检索到了但全都没有 summary 也返回 null（摘要是异步蒸馏的，可能还没生成）', () => {
    expect(formatMemoryContext([{ summary: null }, { summary: undefined }, {}])).toBeNull();
  });

  it('部分有 summary 时只列有的那些', () => {
    const out = formatMemoryContext([{ summary: '有摘要' }, { summary: null }])!;
    expect(out).toContain('- 有摘要');
    expect(out.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(1);
  });
});

describe('端到端：注入顺序与旧实现一致', () => {
  it('模拟一轮全命中的对话，结果顺序等同于旧的五次 unshift', () => {
    // 旧实现：依次 unshift(fileRag) → unshift(memory) → unshift(lorebook)
    //         → unshift(webSearch) → unshift(persona)
    const legacy: string[] = [];
    legacy.unshift(formatFileContext([{ fileName: 'f.pdf', content: 'FC' }])!);
    legacy.unshift(formatMemoryContext([{ summary: 'MEM' }])!);
    legacy.unshift('LORE');
    legacy.unshift('WEB');
    legacy.unshift('PERSONA');

    const next = orderSystemContext({
      persona: 'PERSONA',
      webSearch: 'WEB',
      lorebook: 'LORE',
      memory: formatMemoryContext([{ summary: 'MEM' }]),
      fileRag: formatFileContext([{ fileName: 'f.pdf', content: 'FC' }]),
    });

    expect(next).toEqual(legacy);
  });
});
