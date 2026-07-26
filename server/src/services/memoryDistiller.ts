/**
 * Auto-distill learning (v0.7.73, owner batch #2 — "越聊越懂" / an AI that
 * learns from chat history). The memory store's auto_save keeps RAW messages;
 * this service periodically asks a model to REFINE a conversation's recent
 * turns into durable facts — conclusions, decisions, preferences, project
 * facts — and stores those as first-class memory entries (with embeddings, so
 * the existing RAG injection retrieves them in later chats).
 *
 * Cadence: after every `summarize_threshold` new messages in a conversation
 * (the long-dormant memory_config knob, now wired for real; switch =
 * auto_summarize). Watermark = conversations.distilled_message_count.
 * Fire-and-forget from the chat path; never throws.
 */

import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { invokeModel, type InvokeModelResult } from './modelInvocation';
import { pickSummaryModel } from './kbSummarizer';
import { logApiUsage } from './usageLog';
import { generateEmbedding, serializeEmbedding } from './embeddings';
import { getErrorMessage } from '../utils/errors';

const MAX_INPUT_CHARS = 9000;
const MAX_FACTS = 5;
const MAX_FACT_CHARS = 400;
const MAX_FACT_KEYWORDS = 8;
export const DISTILL_TAG = 'distilled';
const DEFAULT_THRESHOLD = 20;

export interface DistilledFact {
  content: string;
  keywords: string[];
  importance: number; // 0..1
}

/** Does this conversation have enough un-distilled messages? Pure. */
export function shouldDistill(
  cfg: { autoSummarize: boolean; summarizeThreshold: number },
  totalMessages: number,
  distilledCount: number
): boolean {
  if (!cfg.autoSummarize) return false;
  const threshold = cfg.summarizeThreshold > 0 ? cfg.summarizeThreshold : DEFAULT_THRESHOLD;
  return totalMessages - distilledCount >= threshold;
}

/**
 * Parse the model's reply into facts. Tolerates fences/prose around the JSON
 * array; drops malformed items; clamps sizes. [] when nothing usable. Pure.
 */
export function parseDistillResponse(text: string): DistilledFact[] {
  if (!text) return [];
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: DistilledFact[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as { content?: unknown; fact?: unknown; keywords?: unknown; importance?: unknown };
    const raw = typeof o.content === 'string' ? o.content : typeof o.fact === 'string' ? o.fact : '';
    const content = raw.trim().slice(0, MAX_FACT_CHARS);
    if (!content) continue;
    const keywords = Array.isArray(o.keywords)
      ? o.keywords
          .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k) => k.trim())
          .slice(0, MAX_FACT_KEYWORDS)
      : [];
    let importance = typeof o.importance === 'number' && Number.isFinite(o.importance) ? o.importance : 0.5;
    if (importance > 1) importance = importance <= 5 ? importance / 5 : 1; // tolerate a 1-5 scale
    importance = Math.min(1, Math.max(0, importance));
    out.push({ content, keywords, importance });
    if (out.length >= MAX_FACTS) break;
  }
  return out;
}

const DISTILL_PROMPT = `你是团队 AI 助手的"记忆整理员"。下面是一段对话的最近内容。请从中提炼出【值得长期记住】的信息——结论、决定、用户/团队的偏好、项目事实、重要时间节点。只输出一个 JSON 数组（不要输出任何其他文字），每个元素：
- "content": 一条独立完整的事实陈述（50 字左右，不超过 150 字；要脱离对话也能看懂，写明主语）
- "keywords": 2-6 个检索关键词
- "importance": 重要性 0~1（一般 0.5，影响后续工作的决定/偏好 0.8 以上）

规则：没有值得长期记住的内容就输出 []；不要提炼寒暄、一次性的问答、AI 的百科式解释；同一件事只写一条。

对话标题：{title}
对话内容：
{transcript}`;

export interface DistillerDeps {
  invoke?: (opts: Parameters<typeof invokeModel>[0]) => Promise<InvokeModelResult>;
  log?: typeof logApiUsage;
  /** Embedding step; stubbed in tests (real one needs the network). */
  embed?: (text: string) => Promise<number[] | null>;
}

export type DistillResult =
  | { ok: true; facts: number }
  | { ok: false; reason: string };

/**
 * Distill one conversation's un-distilled tail into refined memory entries.
 * Advances the watermark even when the model finds nothing (otherwise a
 * chatty-but-shallow conversation would re-submit the same tail forever).
 * Never throws.
 */
export async function distillConversation(
  conversationId: string,
  db: Database.Database = getDb(),
  deps: DistillerDeps = {}
): Promise<DistillResult> {
  const invoke = deps.invoke ?? invokeModel;
  const log = deps.log ?? logApiUsage;
  const embed =
    deps.embed ??
    (async (text: string) => {
      try {
        return await generateEmbedding(text);
      } catch {
        return null;
      }
    });

  try {
    const conv = db
      .prepare('SELECT id, user_id, title, distilled_message_count FROM conversations WHERE id = ?')
      .get(conversationId) as
      | { id: string; user_id: string | null; title: string | null; distilled_message_count: number }
      | undefined;
    if (!conv) return { ok: false, reason: 'not_found' };

    const msgs = db
      .prepare('SELECT id, role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(conversationId) as Array<{ id: string; role: string; content: string }>;
    const fresh = msgs.slice(conv.distilled_message_count);
    if (fresh.length === 0) return { ok: false, reason: 'no_new_messages' };

    const model = pickSummaryModel(db);
    if (!model) return { ok: false, reason: 'no_model' };

    const transcript = fresh
      .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n')
      .slice(-MAX_INPUT_CHARS); // recent tail matters most

    const prompt = DISTILL_PROMPT.replace('{title}', conv.title || '(未命名对话)').replace(
      '{transcript}',
      transcript
    );

    const started = Date.now();
    const result = await invoke({
      modelNormalizedName: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      timeoutMs: 90_000,
    });

    log({
      userId: conv.user_id,
      kind: 'other',
      modelNormalized: model,
      modelUsed: result.ok ? result.modelUsed : null,
      stationId: result.ok ? result.stationId : null,
      stationName: result.ok ? result.stationName : null,
      status: result.ok ? 'ok' : 'error',
      errorMessage: result.ok ? null : result.error,
      promptTokens: result.ok ? result.usage.promptTokens : null,
      completionTokens: result.ok ? result.usage.completionTokens : null,
      totalTokens: result.ok ? result.usage.totalTokens : null,
      latencyMs: Date.now() - started,
    });

    if (!result.ok) return { ok: false, reason: `invoke: ${result.error}` };

    const facts = parseDistillResponse(result.content);
    const anchorMessageId = fresh[fresh.length - 1].id;
    const now = new Date().toISOString();

    for (const fact of facts) {
      const embedding = await embed(fact.content);
      db.prepare(
        `INSERT INTO memory_entries (id, conversation_id, message_id, role, content, summary, keywords, tags, model_used, importance, embedding, user_id, created_at, updated_at)
         VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        uuidv4(),
        conversationId,
        anchorMessageId,
        fact.content,
        fact.content, // summary = the fact itself → the RAG injection picks it up
        JSON.stringify(fact.keywords),
        JSON.stringify([DISTILL_TAG]),
        result.modelUsed ?? model,
        fact.importance,
        embedding ? serializeEmbedding(embedding) : null,
        conv.user_id,
        now,
        now
      );
    }
    if (facts.length > 0) {
      db.prepare(
        `INSERT INTO memory_tags (id, name, entry_count, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET entry_count = entry_count + ?`
      ).run(uuidv4(), DISTILL_TAG, facts.length, now, facts.length);
    }

    // Advance the watermark regardless of fact count (see docstring).
    db.prepare('UPDATE conversations SET distilled_message_count = ? WHERE id = ?').run(msgs.length, conversationId);

    if (facts.length > 0) {
      console.log(`[distill] ${facts.length} fact(s) refined from conversation ${conversationId}`);
    }
    return { ok: true, facts: facts.length };
  } catch (err) {
    console.warn(`[distill] failed for ${conversationId}: ${getErrorMessage(err)}`);
    return { ok: false, reason: getErrorMessage(err) };
  }
}

/**
 * Chat-path hook: check the cadence and fire the distiller in the background
 * when due. Cheap when not due (two tiny queries). Never throws.
 */
export function maybeDistillConversation(conversationId: string, db: Database.Database = getDb()): void {
  try {
    const cfg = db
      .prepare('SELECT auto_summarize, summarize_threshold FROM memory_config WHERE id = 1')
      .get() as { auto_summarize: number; summarize_threshold: number } | undefined;
    const conv = db
      .prepare('SELECT distilled_message_count FROM conversations WHERE id = ?')
      .get(conversationId) as { distilled_message_count: number } | undefined;
    if (!cfg || !conv) return;
    const total = (
      db.prepare('SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?').get(conversationId) as { n: number }
    ).n;
    if (
      !shouldDistill(
        { autoSummarize: cfg.auto_summarize === 1, summarizeThreshold: cfg.summarize_threshold },
        total,
        conv.distilled_message_count
      )
    ) {
      return;
    }
    void distillConversation(conversationId, db);
  } catch (err) {
    console.warn(`[distill] trigger check failed: ${getErrorMessage(err)}`);
  }
}
