/**
 * Knowledge-base AI digest (v0.7.65, owner request 2026-07-26).
 *
 * After a KB upload finishes text extraction, this service asks a chat model
 * for a structured digest — document TYPE, KEYWORDS and a plain-language
 * SUMMARY of the key points — and stores it on the file row. That digest is
 * what makes the knowledge base searchable ("搜关键词出现所有相关文件") and
 * skimmable (long policy documents collapse to a card of essentials).
 *
 * Model choice: `KB_SUMMARY_MODEL` env when set, otherwise the first enabled
 * station model. Status lifecycle on the row: none → pending → ready | error
 * (error rows show a retry button in the UI).
 */

import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { invokeModel, type InvokeModelResult } from './modelInvocation';
import { normalizeModelName } from './normalizeModelName';
import { logApiUsage } from './usageLog';
import { getErrorMessage } from '../utils/errors';

/** Max characters of extracted text sent to the model (long docs are truncated). */
const MAX_INPUT_CHARS = 9000;
const MAX_KEYWORDS = 10;

export interface KbDigest {
  docType: string;
  keywords: string[];
  summary: string;
}

/** Pick the model that writes digests. Pure given (db, env) — unit-tested. */
export function pickSummaryModel(db: Database.Database, env: NodeJS.ProcessEnv = process.env): string | null {
  const envModel = env.KB_SUMMARY_MODEL?.trim();
  if (envModel) return normalizeModelName(envModel);
  const row = db.prepare(`
    SELECT sm.model_id FROM station_models sm
    JOIN stations s ON sm.station_id = s.id
    WHERE sm.enabled = 1 AND s.enabled = 1
    ORDER BY sm.created_at ASC LIMIT 1
  `).get() as { model_id: string } | undefined;
  return row ? normalizeModelName(row.model_id) : null;
}

/**
 * Parse the model's digest reply. Tolerates markdown fences and prose around
 * the JSON (models love both). Returns null when nothing usable is found.
 * Pure — unit-tested.
 */
export function parseDigestResponse(text: string): KbDigest | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as {
      docType?: unknown; type?: unknown; keywords?: unknown; summary?: unknown;
    };
    const docType = typeof obj.docType === 'string' ? obj.docType : typeof obj.type === 'string' ? obj.type : '';
    const summary = typeof obj.summary === 'string' ? obj.summary : '';
    const keywords = Array.isArray(obj.keywords)
      ? obj.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k) => k.trim()).slice(0, MAX_KEYWORDS)
      : [];
    if (!summary.trim()) return null;
    return { docType: docType.trim() || '其他', keywords, summary: summary.trim() };
  } catch {
    return null;
  }
}

const DIGEST_PROMPT = `你是团队知识库的文档整理助手。请阅读下面的文档内容，输出一个 JSON 对象（不要输出任何其他文字），字段如下：
- "docType": 文档类型，用 2-6 个字概括（例如：政策文件、行业报告、会议纪要、技术文档、新闻资讯、合同协议、操作指南、其他）
- "keywords": 5-10 个检索关键词的数组，覆盖主题、涉及领域、关键实体（机构/地区/项目名等），方便同事日后按关键词搜索
- "summary": 200 字以内的要点总结，去掉套话和废话，直接讲：这份文档说了什么、关键结论/数字/时间节点是什么、和谁有关

文档标题：{title}
文档内容（可能被截断）：
{content}`;

/** Injectable seams for tests (invoke = model call; log = usage logging, which
 *  touches the real DB via getDb and must be stubbed in unit tests). */
export interface KbSummarizerDeps {
  invoke?: (opts: Parameters<typeof invokeModel>[0]) => Promise<InvokeModelResult>;
  log?: typeof logApiUsage;
}

/**
 * Generate + persist the digest for one KB file. Reads extracted text from the
 * file's chunks; safe to re-run (regenerates in place). Never throws — all
 * failure paths land in summary_status='error'.
 */
export async function summarizeKbFile(
  fileId: string,
  db: Database.Database = getDb(),
  deps: KbSummarizerDeps = {}
): Promise<{ ok: boolean; reason?: string }> {
  const invoke = deps.invoke ?? invokeModel;
  const log = deps.log ?? logApiUsage;
  const fail = (reason: string): { ok: false; reason: string } => {
    db.prepare("UPDATE file_library SET summary_status = 'error', updated_at = datetime('now') WHERE id = ?").run(fileId);
    console.warn(`[kb] digest failed for ${fileId}: ${reason}`);
    return { ok: false, reason };
  };

  try {
    const file = db.prepare('SELECT id, original_name, uploaded_by FROM file_library WHERE id = ?').get(fileId) as
      | { id: string; original_name: string; uploaded_by: string | null }
      | undefined;
    if (!file) return { ok: false, reason: 'not_found' };

    db.prepare("UPDATE file_library SET summary_status = 'pending' WHERE id = ?").run(fileId);

    const chunks = db.prepare(
      'SELECT content FROM file_chunks WHERE file_id = ? ORDER BY chunk_index ASC'
    ).all(fileId) as Array<{ content: string }>;
    const fullText = chunks.map((c) => c.content).join('\n').trim();
    if (!fullText) return fail('no_text');

    const model = pickSummaryModel(db);
    if (!model) return fail('no_model');

    const prompt = DIGEST_PROMPT
      .replace('{title}', file.original_name)
      .replace('{content}', fullText.slice(0, MAX_INPUT_CHARS));

    const started = Date.now();
    const result = await invoke({
      modelNormalizedName: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      timeoutMs: 90_000,
    });

    log({
      userId: file.uploaded_by,
      kind: 'other',
      modelNormalized: model,
      modelUsed: result.ok ? result.modelUsed : null,
      stationId: result.ok ? result.stationId : null,
      stationName: result.ok ? result.stationName : null,
      status: result.ok ? 'ok' : 'error',
      errorMessage: result.ok ? null : result.error,
      latencyMs: Date.now() - started,
    });

    if (!result.ok) return fail(`invoke: ${result.error}`);

    const digest = parseDigestResponse(result.content);
    if (!digest) return fail('unparseable_digest');

    db.prepare(`
      UPDATE file_library
      SET summary = ?, doc_type = ?, ai_keywords = ?, summary_status = 'ready', updated_at = datetime('now')
      WHERE id = ?
    `).run(digest.summary, digest.docType, JSON.stringify(digest.keywords), fileId);
    console.log(`[kb] digest ready for "${file.original_name}" (${digest.docType}, ${digest.keywords.length} keywords)`);
    return { ok: true };
  } catch (err) {
    return fail(getErrorMessage(err));
  }
}
