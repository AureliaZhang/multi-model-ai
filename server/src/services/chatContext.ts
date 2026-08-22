/**
 * 对话的 system 上下文：格式化 + 排序（v0.7.99，§10.11 ② 上下文注入段）
 *
 * 处理函数在发请求前会往消息列表最前面塞若干条 system 消息：人设、联网搜索结果、
 * 世界书条目、记忆库检索、文件库 RAG。这里收的是其中**纯粹的那一半** ——
 * 格式化和排序；检索本身（向量搜索、数据库、联网）留在路由里。
 *
 * ## 为什么排序值得单独抽出来
 *
 * 原先五段各自调用 `apiMessages.unshift()`。unshift 每次都插到最前面，
 * 于是**最后 unshift 的那段排到最前**，最终顺序完全由调用次序倒着决定：
 *
 * ```
 * 调用次序：文件RAG → 记忆 → 世界书 → 联网 → 人设
 * 实际顺序：人设 → 联网 → 世界书 → 记忆 → 文件RAG
 * ```
 *
 * 这个顺序是有意的（人设要框定整场对话，检索来的上下文跟在后面），
 * 但它此前**只写在一句注释里，没有任何测试保护**：谁挪动了五段的先后，
 * 提示词的层次就悄悄变了，不报错、不失败，只是模型的行为慢慢不对劲。
 *
 * 现在顺序是这个模块里一个写明的常量，并且有测试盯着。
 */

/** 五种 system 上下文来源。缺席的用 null / undefined 表示。 */
export interface SystemContextParts {
  /** 会话自带的人设（system prompt）。 */
  persona?: string | null;
  /** 本轮联网搜索的结果摘要。 */
  webSearch?: string | null;
  /** 被关键词触发的世界书条目。 */
  lorebook?: string | null;
  /** 记忆库向量检索的结果。 */
  memory?: string | null;
  /** 文件库 RAG 检索到的片段。 */
  fileRag?: string | null;
}

/**
 * system 上下文的最终顺序 —— 越靠前越先被模型读到。
 *
 * 人设排第一：它定的是「你是谁、怎么说话」，必须框住后面所有材料。
 * 检索来的材料跟在后面，由「时效性最强」到「最静态」：
 * 联网（此刻的）→ 世界书（项目设定）→ 记忆（跨会话的旧事）→ 文件库（参考资料）。
 */
export const SYSTEM_CONTEXT_ORDER = ['persona', 'webSearch', 'lorebook', 'memory', 'fileRag'] as const;

/** 按 `SYSTEM_CONTEXT_ORDER` 排好、并丢掉空值的 system 消息内容。 */
export function orderSystemContext(parts: SystemContextParts): string[] {
  const out: string[] = [];
  for (const key of SYSTEM_CONTEXT_ORDER) {
    const v = parts[key];
    if (typeof v === 'string' && v.trim()) out.push(v);
  }
  return out;
}

/** 文件库 RAG 检索出的一个片段。 */
export interface FileChunkLike {
  fileName: string;
  content: string;
}

/**
 * 文件库 RAG → system 文本。没有片段就返回 null（调用方据此跳过注入）。
 * 文案与 v0.7.98 之前内联在 routes/chat.ts 里的完全一致。
 */
export function formatFileContext(chunks: readonly FileChunkLike[]): string | null {
  if (!chunks.length) return null;
  const body = chunks.map((c) => `[${c.fileName}] ${c.content}`).join('\n\n');
  return `以下是从文件库中检索到的相关内容：\n${body}\n\n请基于这些文件内容回答用户的问题。`;
}

/** 记忆库检索出的一条记忆（只有 summary 会被用上）。 */
export interface MemoryLike {
  summary?: string | null;
}

/**
 * 记忆库 → system 文本。
 *
 * 注意两层「空」：一条记忆都没检索到，或者检索到了但**全都没有 summary**
 * （摘要是后台异步蒸馏出来的，可能还没生成）。两种情况都返回 null ——
 * 原实现也是这个语义，只是藏在嵌套的 if 里。
 */
export function formatMemoryContext(memories: readonly MemoryLike[]): string | null {
  const body = memories
    .filter((m) => m.summary)
    .map((m) => `- ${m.summary}`)
    .join('\n');
  if (!body) return null;
  return `以下是从记忆库中检索到的相关记忆，可能对回答用户问题有帮助：\n${body}\n\n请根据这些记忆信息来更好地回答用户的问题。如果记忆中没有相关信息，请正常回答。`;
}
