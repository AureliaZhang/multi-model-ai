import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateMessagesTokens,
  extractUsageReceipt,
  addReceipts,
  resolveUsage,
} from './usageAccounting';

/**
 * 用量记账口径（v0.8.0，§10.12）
 *
 * 这些数字最终决定「谁被配额卡住」和「看板上花了多少钱」，原先整段内联在
 * routes/chat.ts 里、零测试，而且只数了用户那一句话。
 */

describe('estimateTokens', () => {
  it('约 4 个字符 1 个 token，向上取整', () => {
    expect(estimateTokens('12345678')).toBe(2);
    expect(estimateTokens('123456789')).toBe(3); // 8.x → 3，不是 2
  });

  it('空的 / 不是字符串的一律算 0，不抛异常', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
    expect(estimateTokens(123)).toBe(0);
    expect(estimateTokens({})).toBe(0);
  });
});

describe('estimateMessagesTokens', () => {
  it('⚠ 数的是整个数组 —— 这正是原先漏掉的部分', () => {
    const msgs = [
      { role: 'system', content: 'a'.repeat(400) },   // 人设
      { role: 'system', content: 'b'.repeat(800) },   // 记忆库
      { role: 'user', content: 'c'.repeat(40) },      // 用户这一句
    ];
    // 原实现只会数最后那 40 个字符 = 10
    expect(estimateMessagesTokens(msgs)).toBe(100 + 200 + 10);
  });

  it('多模态 content 只数得出字数的 text 部分', () => {
    const msgs = [{
      content: [
        { type: 'text', text: 'x'.repeat(40) },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA…' } },
      ],
    }];
    // 图片开销各家算法不同，估不出就不假装能估，留给真实回执纠正
    expect(estimateMessagesTokens(msgs)).toBe(10);
  });

  it('缺 content / content 是奇怪东西的消息不影响别人计数', () => {
    expect(estimateMessagesTokens([{}, { content: null }, { content: 'aaaa' }])).toBe(1);
  });

  it('不是数组时返回 0', () => {
    expect(estimateMessagesTokens(null)).toBe(0);
    expect(estimateMessagesTokens(undefined)).toBe(0);
  });
});

describe('extractUsageReceipt', () => {
  it('正常取出三项', () => {
    expect(extractUsageReceipt({ usage: { prompt_tokens: 128, completion_tokens: 64, total_tokens: 192 } }))
      .toEqual({ promptTokens: 128, completionTokens: 64, totalTokens: 192 });
  });

  it('⚠ 缺项不作废整张回执（不少中转站只回 total）', () => {
    expect(extractUsageReceipt({ usage: { total_tokens: 192 } }))
      .toEqual({ promptTokens: null, completionTokens: null, totalTokens: 192 });
  });

  it('三项全缺算「没有回执」，返回 null 而不是一张空回执', () => {
    expect(extractUsageReceipt({ usage: {} })).toBeNull();
    expect(extractUsageReceipt({ usage: { foo: 1 } })).toBeNull();
  });

  it('没有 usage 字段 / 结构残缺时返回 null', () => {
    expect(extractUsageReceipt(null)).toBeNull();
    expect(extractUsageReceipt(undefined)).toBeNull();
    expect(extractUsageReceipt({})).toBeNull();
    expect(extractUsageReceipt({ usage: null })).toBeNull();
    expect(extractUsageReceipt({ usage: 'nope' })).toBeNull();
  });

  it('不合法的数值当作「这一项没有」，不会写进账里', () => {
    const r = extractUsageReceipt({ usage: { prompt_tokens: -5, completion_tokens: '64', total_tokens: 192 } });
    expect(r).toEqual({ promptTokens: null, completionTokens: null, totalTokens: 192 });
    expect(extractUsageReceipt({ usage: { total_tokens: NaN } })).toBeNull();
  });

  it('流式最后一个 chunk 与非流式响应是同一形状，走同一条路', () => {
    const chunk = { id: 'x', object: 'chat.completion.chunk', choices: [], usage: { total_tokens: 7 } };
    expect(extractUsageReceipt(chunk)?.totalTokens).toBe(7);
  });
});

describe('addReceipts', () => {
  it('逐项相加（工具调用多轮）', () => {
    const a = { promptTokens: 100, completionTokens: 10, totalTokens: 110 };
    const b = { promptTokens: 150, completionTokens: 20, totalTokens: 170 };
    expect(addReceipts(a, b)).toEqual({ promptTokens: 250, completionTokens: 30, totalTokens: 280 });
  });

  it('⚠ 某一轮没给回执时，不抹掉另一轮真实的数字', () => {
    const a = { promptTokens: 100, completionTokens: null, totalTokens: 110 };
    const b = { promptTokens: null, completionTokens: 20, totalTokens: 170 };
    expect(addReceipts(a, b)).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 280 });
  });

  it('两边都没有的项保持 null，不会凭空变成 0', () => {
    const a = { promptTokens: null, completionTokens: null, totalTokens: 110 };
    const b = { promptTokens: null, completionTokens: null, totalTokens: 170 };
    expect(addReceipts(a, b)?.promptTokens).toBeNull();
  });

  it('null 参与时返回另一边（累加的起点是 null）', () => {
    const a = { promptTokens: 1, completionTokens: 2, totalTokens: 3 };
    expect(addReceipts(null, a)).toBe(a);
    expect(addReceipts(a, null)).toBe(a);
    expect(addReceipts(null, null)).toBeNull();
  });
});

describe('resolveUsage', () => {
  const fallback = { promptTokens: 90, completionTokens: 9, totalTokens: 99 };

  it('有真实回执时真实的赢', () => {
    const r = { promptTokens: 128, completionTokens: 64, totalTokens: 192 };
    expect(resolveUsage(r, fallback)).toEqual(r);
  });

  it('完全没有回执时整份用估算', () => {
    expect(resolveUsage(null, fallback)).toEqual(fallback);
  });

  it('⚠ 逐字段取舍：只回了 total 的站，prompt/completion 用估算', () => {
    const r = { promptTokens: null, completionTokens: null, totalTokens: 192 };
    expect(resolveUsage(r, fallback)).toEqual({ promptTokens: 90, completionTokens: 9, totalTokens: 192 });
  });

  it('⚠ total 缺失时补成定稿后两项之和 —— 配额按 SUM(total_tokens) 算，这列不能空', () => {
    const r = { promptTokens: 128, completionTokens: 64, totalTokens: null };
    expect(resolveUsage(r, fallback)).toEqual({ promptTokens: 128, completionTokens: 64, totalTokens: 192 });
  });

  it('回执里的 0 是真实的 0，不会被估算顶掉', () => {
    const r = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    expect(resolveUsage(r, fallback)).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });
});
