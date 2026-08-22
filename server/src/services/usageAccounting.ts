/**
 * 用量记账的口径（v0.8.0，§10.12）
 *
 * 一次聊天可能产生**多次**上游调用：正文一次、每一轮工具调用各一次、开了自审
 * 再加一次。每一次都要么带回一张真实的 `usage` 回执，要么只能估。这里收的是
 * 「怎么估」和「怎么用回执」，网络与数据库留在路由里。
 *
 * 原先 `routes/chat.ts` 的记账是 `Math.ceil(String(message).length / 4)` ——
 * 只数了用户那一句话，人设 / 世界书 / 联网 / 记忆 / 文件库 / 全部历史统统没算，
 * 而且从不去看上游回执。少算的量随用户挂的上下文增长。
 */

/** 上游回执里可能拿到的部分。任何一项都可能缺 —— 缺一项不该让整张回执作废。 */
export interface UsageReceipt {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

/** 最终写进 `api_usage_logs` 的三个数。 */
export interface ResolvedUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 一条要发给上游的消息（content 可能是字符串，也可能是多模态数组）。 */
export interface CountableMessage {
  content?: unknown;
}

/**
 * 兜底口径：约 4 个字符 1 个 token。
 *
 * 这个数是**估的**，中文尤其偏低。保留它只因为它是项目里一直在用的口径，
 * 换算系数改动会让新旧数据不可比 —— 真实回执优先，这里只在没回执时顶上。
 */
export function estimateTokens(text: unknown): number {
  if (typeof text !== 'string' || !text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * 数一条消息的 content。
 *
 * 多模态消息的 content 是 `[{type:'text',text},{type:'image_url',...}]` 这种数组。
 * 只数得出字数的部分（text）；图片的开销上游算法各家不同，估不出来就不假装能估，
 * 留给真实回执去纠正。
 */
function countContent(content: unknown): number {
  if (typeof content === 'string') return estimateTokens(content);
  if (!Array.isArray(content)) return 0;
  let n = 0;
  for (const part of content) {
    if (typeof part === 'string') { n += estimateTokens(part); continue; }
    if (part && typeof part === 'object') {
      const text = (part as { text?: unknown }).text;
      if (typeof text === 'string') n += estimateTokens(text);
    }
  }
  return n;
}

/**
 * 数**整个**请求的 messages —— 这是修掉「只数用户那一句」的地方。
 * 人设、世界书、联网、记忆、文件库、历史对话都在这个数组里，一并算进去。
 */
export function estimateMessagesTokens(messages: readonly CountableMessage[] | null | undefined): number {
  if (!Array.isArray(messages)) return 0;
  let n = 0;
  for (const m of messages) n += countContent(m?.content);
  return n;
}

/** 只接受有限的非负数；其余（null / 字符串 / NaN / 负数）当作「这一项没有」。 */
function num(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  return v;
}

/**
 * 从上游对象里取 `usage`。流式的最后一个 chunk 和非流式响应是同一个形状，
 * 所以两条路共用这一个函数。
 *
 * 三项全缺时返回 null（「没有回执」），而不是一张全 null 的空回执 ——
 * 调用方据此判断要不要继续等下一个 chunk。
 */
export function extractUsageReceipt(obj: unknown): UsageReceipt | null {
  const u = (obj as { usage?: Record<string, unknown> } | null | undefined)?.usage;
  if (!u || typeof u !== 'object') return null;
  const receipt: UsageReceipt = {
    promptTokens: num(u.prompt_tokens),
    completionTokens: num(u.completion_tokens),
    totalTokens: num(u.total_tokens),
  };
  if (receipt.promptTokens === null && receipt.completionTokens === null && receipt.totalTokens === null) {
    return null;
  }
  return receipt;
}

/**
 * 把多次上游调用的回执加起来（工具调用多轮时用）。
 *
 * 逐项相加，两边都没有的项保持 null。`null + 5 = 5` 而不是 5 —— 也就是说
 * 「有一轮没给回执」不会把另一轮真实的数字抹掉，但也不会替它编一个。
 */
export function addReceipts(a: UsageReceipt | null, b: UsageReceipt | null): UsageReceipt | null {
  if (!a) return b;
  if (!b) return a;
  const add = (x: number | null, y: number | null) => (x === null && y === null ? null : (x ?? 0) + (y ?? 0));
  return {
    promptTokens: add(a.promptTokens, b.promptTokens),
    completionTokens: add(a.completionTokens, b.completionTokens),
    totalTokens: add(a.totalTokens, b.totalTokens),
  };
}

/**
 * 定稿：**逐字段**取真实回执，缺的用估算补。
 *
 * 逐字段而不是整张取舍，是因为回执缺项很常见（不少中转站只回 total）。
 * `totalTokens` 两边都没有时用「定稿后的 prompt + completion」，保证这一列
 * 永远等于另外两列之和 —— 配额是按 `SUM(total_tokens)` 算的，这一列不能为空。
 */
export function resolveUsage(receipt: UsageReceipt | null, fallback: ResolvedUsage): ResolvedUsage {
  const promptTokens = receipt?.promptTokens ?? fallback.promptTokens;
  const completionTokens = receipt?.completionTokens ?? fallback.completionTokens;
  const totalTokens = receipt?.totalTokens ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}
