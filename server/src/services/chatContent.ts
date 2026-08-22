/**
 * 把一条消息的正文 + 附件拼成上游要的 content（v0.7.98，§10.11 ②）
 *
 * 为什么抽出来：`routes/chat.ts` 的 697 行处理函数里，这段拼装逻辑写了**两遍** ——
 * 一份给「本轮刚发出的消息」（附件还在内存里，需要现场解析），
 * 一份给「历史消息」（附件从预取的 map 里读，文本走提取缓存）。
 * 两份的差别只在「文本从哪来」，而拼装规则完全相同，却各自维护了一套
 * `contentParts` / `textContent` / `hasImages` 的推演。
 *
 * 现在 I/O 留在路由里（解析 PDF、读缓存），**拼装规则收在这里且是纯函数**，
 * 于是可以直接单测：有图/无图、多图、解析失败、空正文这些分支都能穷举。
 */

/** OpenAI 风格的多模态 content 片段。 */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/**
 * 一个附件在拼装阶段的形态 —— 已经过 I/O，只剩「是图片还是文本」。
 * `extracted` 为 null / 空串表示这个文件没能解析出内容（不支持的格式、
 * 空文件、解析失败），此时它对模型不可见。
 */
export type AttachmentPiece =
  | { kind: 'image'; url: string }
  | { kind: 'file'; filename?: string | null; extracted: string | null };

/** 文件内容在正文里的包裹格式 —— 让模型能分清哪段是附件、附件到哪结束。 */
export function wrapFileText(filename: string | null | undefined, extracted: string): string {
  const name = filename || 'file';
  return `\n\n--- [Attached File: ${name}] ---\n${extracted}\n--- [End of ${name}] ---`;
}

/**
 * 拼出这条消息最终的 content。
 *
 * 规则：
 *  - 文件的解析文本**追加进正文**（模型按纯文本读）
 *  - 图片必须走 `image_url` 片段，所以只要有图，content 就得是数组形式，
 *    且第一个片段是完整正文（含所有文件文本）
 *  - 没有图时退回普通字符串 —— 不是所有上游都接受数组形式的 content，
 *    能用字符串就别用数组
 */
export function buildMessageContent(
  baseText: string,
  pieces: AttachmentPiece[],
): string | ChatContentPart[] {
  let text = baseText;
  const images: ChatContentPart[] = [];

  for (const p of pieces) {
    if (p.kind === 'image') {
      images.push({ type: 'image_url', image_url: { url: p.url } });
    } else if (p.extracted) {
      text += wrapFileText(p.filename, p.extracted);
    }
    // 解析不出内容的文件：静默跳过。路由层已经就此打了 warn 日志。
  }

  if (images.length === 0) return text;
  return [{ type: 'text', text }, ...images];
}
