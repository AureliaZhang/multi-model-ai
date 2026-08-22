/**
 * 流式 tool_calls 增量累加（v0.7.98，§10.11 ②）
 *
 * 上游把一次工具调用拆成多个 SSE 增量发回来：第一个增量带 `id` 和
 * `function.name`，后续增量只带 `function.arguments` 的片段，靠 `index`
 * 认领是哪一次调用。并行调用多个工具时，多个 index 会交错到达。
 *
 * 这段推演原先内联在 `routes/chat.ts` 的 697 行处理函数里、一个测试都没有 ——
 * 而它恰恰是最容易出错的那类代码：按下标认领、跨 chunk 拼接、还要容忍
 * 字段缺失。抽成纯函数之后可以把交错、乱序、缺字段这些情况穷举掉。
 */

/** 上游一个 tool_call 增量片段（字段全都可能缺）。 */
export interface ToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

/** 累加完成后的一次工具调用。 */
export interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * 把一批增量并进累加表（原地修改 `acc`）。
 *
 * 关于 `name` 用 `+=` 而不是赋值：OpenAI 风格的流式响应允许把函数名也切片发送，
 * 所以必须拼接。代价是万一某个上游在后续增量里**重发完整函数名**，就会拼成
 * `get_weatherget_weather`。这里保持原有行为（v0.7.98 抽取时未改语义），
 * 但把这个前提写下来 —— 真遇到这种站，改的是这一行，不是整个处理函数。
 */
export function accumulateToolCalls(
  acc: Map<number, AccumulatedToolCall>,
  deltas: readonly ToolCallDelta[],
): void {
  for (const tc of deltas) {
    const idx = tc.index ?? 0;
    let entry = acc.get(idx);
    if (!entry) {
      entry = { id: '', name: '', arguments: '' };
      acc.set(idx, entry);
    }
    if (tc.id) entry.id = tc.id;
    if (tc.function?.name) entry.name += tc.function.name;
    if (tc.function?.arguments) entry.arguments += tc.function.arguments;
  }
}

/**
 * 累加表 → 按 index 升序的数组。
 *
 * 顺序很重要：后面要把 `tool_calls` 连同对应的 `tool` 结果消息一起发回上游，
 * 顺序错了就会把结果配到别的调用上。Map 的插入序取决于增量到达顺序，
 * 并行调用时并不等于 index 序，所以这里显式排序。
 */
export function orderedToolCalls(acc: Map<number, AccumulatedToolCall>): AccumulatedToolCall[] {
  return [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}
