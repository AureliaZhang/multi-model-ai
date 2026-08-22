/**
 * 自审一遍（self-review）—— 提示词与响应解析（v0.7.99，§10.11 ② C 段）
 *
 * 会话可以打开「自我审查」：拿到模型的回答之后，再用同一个模型跑一遍校对，
 * 修掉错别字和坏掉的表格，然后把修订版推给前端替换显示。
 *
 * 这里收的是纯粹的两头 —— 拼提示词、解析响应；中间那次网络请求留在路由里。
 */

/**
 * 校对提示词。
 *
 * 措辞是刻意的：明确要求「只返回修订后的正文」，因为返回值会**整条替换**
 * 用户已经看到的回答。模型要是加一句「好的，这是修订版：」，那句话就会
 * 出现在最终答案里。
 */
export function buildSelfReviewPrompt(content: string): string {
  return `You are a professional editor and proofreader. Review the following AI response for:
1. Grammar errors and typos
2. Table formatting issues (broken markdown tables, misaligned columns)
3. Formatting inconsistencies

If you find any issues, correct them and return ONLY the corrected version. If there are no issues, return the original text unchanged. Do NOT add any commentary, explanation, or meta-text. Just return the corrected content directly.

---BEGIN AI RESPONSE---
${content}
---END AI RESPONSE---`;
}

/**
 * 从上游响应里取出修订后的正文；拿不到就返回 null（调用方保留原回答）。
 *
 * 空白结果必须当作失败：自审的返回值会整条替换用户已经看到的回答，
 * 一个只回了空格的模型会把答案抹掉。返回的是**未 trim 的原文** ——
 * 只用 trim 判断「是不是空的」，不改内容本身（模型的换行和缩进是有意义的）。
 */
export function extractReviewedContent(data: unknown): string | null {
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> } | null | undefined)
    ?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) return null;
  return content;
}
