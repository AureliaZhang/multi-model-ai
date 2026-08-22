import { describe, it, expect } from 'vitest';
import { accumulateToolCalls, orderedToolCalls, type AccumulatedToolCall, type ToolCallDelta } from './toolCallStream';

/**
 * 流式 tool_calls 累加（v0.7.98，§10.11 ②）
 *
 * 原先内联在 routes/chat.ts 的 697 行处理函数里、零测试。
 * 这里把「切片到达、并行交错、字段缺失」这几类情况穷举掉。
 */

function fold(...batches: ToolCallDelta[][]): Map<number, AccumulatedToolCall> {
  const acc = new Map<number, AccumulatedToolCall>();
  for (const b of batches) accumulateToolCalls(acc, b);
  return acc;
}

describe('accumulateToolCalls', () => {
  it('典型情形：首个增量带 id + 函数名，后续只带参数片段', () => {
    const acc = fold(
      [{ index: 0, id: 'call_1', function: { name: 'get_weather' } }],
      [{ index: 0, function: { arguments: '{"ci' } }],
      [{ index: 0, function: { arguments: 'ty":"北' } }],
      [{ index: 0, function: { arguments: '京"}' } }],
    );
    expect(orderedToolCalls(acc)).toEqual([
      { id: 'call_1', name: 'get_weather', arguments: '{"city":"北京"}' },
    ]);
  });

  it('并行调用交错到达也能各归各位', () => {
    const acc = fold(
      [{ index: 0, id: 'a', function: { name: 'f0' } }, { index: 1, id: 'b', function: { name: 'f1' } }],
      [{ index: 1, function: { arguments: '{"x":1}' } }],
      [{ index: 0, function: { arguments: '{"y":2}' } }],
    );
    expect(orderedToolCalls(acc)).toEqual([
      { id: 'a', name: 'f0', arguments: '{"y":2}' },
      { id: 'b', name: 'f1', arguments: '{"x":1}' },
    ]);
  });

  it('缺 index 时按 0 处理（有些上游单调用时不带 index）', () => {
    const acc = fold([{ id: 'x', function: { name: 'solo' } }], [{ function: { arguments: '{}' } }]);
    expect(orderedToolCalls(acc)).toEqual([{ id: 'x', name: 'solo', arguments: '{}' }]);
  });

  it('函数名分片到达要拼起来', () => {
    const acc = fold(
      [{ index: 0, id: 'i', function: { name: 'get_' } }],
      [{ index: 0, function: { name: 'weather' } }],
    );
    expect(orderedToolCalls(acc)[0].name).toBe('get_weather');
  });

  it('id 后到也能补上，且不会被空 id 覆盖掉', () => {
    const acc = fold(
      [{ index: 0, function: { name: 'f' } }],
      [{ index: 0, id: 'late_id' }],
      [{ index: 0, id: '', function: { arguments: '{}' } }],
    );
    expect(orderedToolCalls(acc)[0].id).toBe('late_id');
  });

  it('空批次 / 全是空字段的增量不产生垃圾条目内容', () => {
    const acc = fold([], [{ index: 0 }]);
    expect(orderedToolCalls(acc)).toEqual([{ id: '', name: '', arguments: '' }]);
  });

  it('原地修改传入的 Map（调用方在循环里复用同一个累加表）', () => {
    const acc = new Map<number, AccumulatedToolCall>();
    accumulateToolCalls(acc, [{ index: 0, id: 'a' }]);
    expect(acc.size).toBe(1);
    accumulateToolCalls(acc, [{ index: 1, id: 'b' }]);
    expect(acc.size).toBe(2);
  });
});

describe('orderedToolCalls', () => {
  it('⚠ 按 index 升序，而不是按到达顺序 —— 顺序错了工具结果会配错调用', () => {
    const acc = fold([
      { index: 2, id: 'c', function: { name: 'third' } },
      { index: 0, id: 'a', function: { name: 'first' } },
      { index: 1, id: 'b', function: { name: 'second' } },
    ]);
    expect(orderedToolCalls(acc).map((t) => t.name)).toEqual(['first', 'second', 'third']);
  });

  it('index 不连续时仍按大小排（上游没保证从 0 连续编号）', () => {
    const acc = fold([{ index: 7, id: 'x' }, { index: 3, id: 'y' }]);
    expect(orderedToolCalls(acc).map((t) => t.id)).toEqual(['y', 'x']);
  });

  it('空表返回空数组', () => {
    expect(orderedToolCalls(new Map())).toEqual([]);
  });
});
