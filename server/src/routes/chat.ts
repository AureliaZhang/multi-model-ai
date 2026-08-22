import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { logApiUsage } from '../services/usageLog';
import type { AuthRequest } from '../types';
import type { ConversationRow, MessageRow, MemoryConfigRow } from '../dbRows';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number; numrender: number; info: unknown; metadata: unknown; version: string }>;
import { getDb } from '../database';
import { ApiResponse } from '../types';
import { loadEnabledMcpTools, resolveToolCall, executeToolCall } from '../services/mcpClient';
import { generateEmbedding, serializeEmbedding, vectorSearch } from '../services/embeddings';
import {
  getStationsForModel as getModelStations,
  diagnoseNoStation,
  noStationMessage,
  classifyUpstreamFailures,
  upstreamFailureMessage,
  sanitizeUpstreamDetail,
  type StationFailure,
} from '../services/modelInvocation';
import { checkUserQuota } from '../services/quota';
import { canModifyConversation } from '../services/conversationAccess';
import { getActiveScripts, applyRegexScripts } from '../services/regexEngine';
import { getErrorMessage } from '../utils/errors';
import { searchFileChunks } from '../services/fileProcessor';
import { filterVisibleFileIds } from './files';
import { matchLorebookEntries, buildLorebookContext } from '../services/lorebook';
import { maybeDistillConversation } from '../services/memoryDistiller';
import { searchWeb, buildWebSearchContext } from '../services/webSearch';
// content 拼装规则（含 ChatContentPart 定义）在这里，两套附件来源共用同一份纯函数。
import { buildMessageContent, type ChatContentPart, type AttachmentPiece } from '../services/chatContent';
// 流式 tool_calls 的累加与排序（同样是从这个处理函数里抽出来的纯逻辑）。
import { accumulateToolCalls, orderedToolCalls, type AccumulatedToolCall } from '../services/toolCallStream';
// system 上下文的格式化与**顺序**（顺序此前只靠一句注释维系，现在有测试盯着）。
import {
  orderSystemContext,
  formatFileContext,
  formatMemoryContext,
  type SystemContextParts,
} from '../services/chatContext';
import { buildSelfReviewPrompt, extractReviewedContent } from '../services/selfReview';

type ChatApiMessage =
  | { role: string; content: string | ChatContentPart[] | null; tool_calls?: unknown }
  | { role: 'tool'; tool_call_id: string; content: string };

type ChatRequestBody = {
  model: string;
  messages: ChatApiMessage[];
  stream: boolean;
  tools?: unknown;
  temperature?: number;
};

type MemoryContextRow = {
  summary?: string | null;
  content?: string;
  keywords?: string;
  created_at?: string;
  role?: string;
};

import type Database from 'better-sqlite3';


/**
 * History LIMIT (§10.8 TC2 #2 — owner decision 2026-07-26: default 20 turns,
 * admin-tunable, 0 = unlimited). Keep only the LAST `maxTurns` turns (1 turn =
 * user + assistant = 2 messages) of verbatim history; the memory store's RAG
 * injection covers anything older. Pure — exported for tests. The newest
 * message (the just-inserted current user message) is always inside the window.
 */
export function limitHistory<T>(rows: T[], maxTurns: number): T[] {
  if (!Number.isFinite(maxTurns) || maxTurns <= 0) return rows;
  const maxMessages = Math.floor(maxTurns) * 2;
  return rows.length > maxMessages ? rows.slice(rows.length - maxMessages) : rows;
}

/** Read the configured recent-turns window (memory_config.history_max_turns). */
export function getHistoryMaxTurns(db: Database.Database): number {
  const row = db.prepare('SELECT history_max_turns FROM memory_config WHERE id = 1').get() as
    | { history_max_turns: number }
    | undefined;
  const v = row ? Math.floor(row.history_max_turns) : 20;
  return Number.isFinite(v) && v >= 0 ? v : 20;
}

const router = Router();

/**
 * Extract readable text from a file attachment (PDF, text, code, etc.)
 * Returns null for images or unsupported types.
 */
async function extractFileText(mimeType: string, base64Data: string, filename: string): Promise<string | null> {
  try {
    console.log(`[extractFileText] Processing file: ${filename}, mimeType: ${mimeType}, base64 length: ${base64Data.length}`);
    
    if (mimeType === 'application/pdf') {
      console.log(`[extractFileText] PDF detected, decoding base64 buffer...`);
      const buffer = Buffer.from(base64Data, 'base64');
      console.log(`[extractFileText] PDF buffer size: ${buffer.length} bytes`);
      try {
        const data = await pdfParse(buffer);
        const text = data.text || null;
        console.log(`[extractFileText] PDF extracted: ${text ? text.length : 0} chars, pages: ${data.numpages}`);
        if (text) {
          // Truncate to ~15000 chars to stay within token limits
          const truncated = text.length > 15000 ? text.substring(0, 15000) + '\n\n[...truncated due to length...]' : text;
          return truncated;
        }
        return null;
      } catch (pdfErr: unknown) {
        console.error(`[extractFileText] PDF parse error for ${filename}:`, getErrorMessage(pdfErr));
        return null;
      }
    }
    // Plain text, CSV, JSON, markdown, code files, XML, HTML, etc.
    if (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml' ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/x-javascript' ||
      mimeType === 'application/typescript' ||
      mimeType === 'application/csv' ||
      mimeType === 'application/x-yaml' ||
      mimeType === 'application/yaml' ||
      mimeType === 'application/toml' ||
      mimeType === 'application/x-sh' ||
      mimeType === 'application/octet-stream'
    ) {
      const buffer = Buffer.from(base64Data, 'base64');
      // Check if it looks like binary (more than 10% non-printable chars)
      const text = buffer.toString('utf-8');
      const nonPrintable = text.replace(/[\x09\x0A\x0D\x20-\x7E\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g, '');
      if (nonPrintable.length > text.length * 0.1) {
        return null; // Likely binary, skip
      }
      return text || null;
    }
    // For unknown types with common text extensions in filename
    const textExtensions = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.rs', '.go', '.rb', '.php', '.sh', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.log', '.sql', '.r', '.lua', '.swift', '.kt', '.scala', '.vue', '.svelte', '.jsx', '.tsx'];
    const lowerFilename = filename.toLowerCase();
    if (textExtensions.some(ext => lowerFilename.endsWith(ext))) {
      const buffer = Buffer.from(base64Data, 'base64');
      const text = buffer.toString('utf-8');
      const nonPrintable = text.replace(/[\x09\x0A\x0D\x20-\x7E\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g, '');
      if (nonPrintable.length > text.length * 0.1) {
        return null;
      }
      return text || null;
    }
    return null;
  } catch (err) {
    console.error(`[extractFileText] Error extracting text from ${filename} (${mimeType}):`, err);
    return null;
  }
}

// POST /api/chat - Send message & get streaming response (SSE)
router.post('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, modelNormalizedName, message, attachments, fileIds, webSearch } = req.body;
    if (!conversationId || !modelNormalizedName || !message) {
      return res.status(400).json({ success: false, error: 'conversationId, modelNormalizedName, and message are required' });
    }

    const db = getDb();
    const isAdmin = req.user?.role === 'admin';
    const chatStarted = Date.now();

    // Get conversation
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as ConversationRow | undefined;
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    // 只有本人（或管理员）能往会话里发消息。规则本体在
    // services/conversationAccess.ts，与 conversations.ts 共用同一份。
    // v0.7.98：无主会话不再「保持开放」—— 那条豁免的实际效果是，
    // 删掉一个用户之后，任何人都能往他被孤儿化的会话里继续发消息。
    const sender = req.user;
    if (!canModifyConversation(sender, conv)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to send messages in this conversation' });
    }

    // Per-user monthly token quota (§10.8 Phase 3). Admins are exempt; members
    // with a cap set (monthly_token_limit > 0) are hard-blocked once they've
    // spent it this month. Checked before any work is done.
    if (sender && sender.role !== 'admin') {
      const quota = checkUserQuota(db, sender.id);
      if (quota.exceeded) {
        return res.status(429).json({
          success: false,
          error: `Monthly token quota reached (${quota.used.toLocaleString()} / ${quota.limit.toLocaleString()} tokens). Contact an admin to raise your limit.`,
          quota,
        });
      }
    }

    // Save user message
    const userMsgId = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userMsgId, conversationId, 'user', message, now);

    // Load active regex scripts for this user/conversation
    const activeRegexScripts = getActiveScripts(db, conv.user_id || null, conversationId);

    // Apply input regex transformation for API consumption
    const transformedInput = activeRegexScripts.length > 0
      ? applyRegexScripts(activeRegexScripts, message, 'input')
      : message;

    // Save attachments if any
    const attachmentMeta: { id: string; type: string; filename: string; mimeType: string }[] = [];
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        const attId = uuidv4();
        const attType = att.mimeType.startsWith('image/') ? 'image' : 'file';
        db.prepare(
          'INSERT INTO attachments (id, message_id, type, filename, mime_type, url) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(attId, userMsgId, attType, att.filename, att.mimeType, `data:${att.mimeType};base64,${att.base64}`);
        attachmentMeta.push({ id: attId, type: attType, filename: att.filename, mimeType: att.mimeType });
      }
    }

    // Update conversation timestamp
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);

    // Get conversation history for context, capped to the configured recent-turns
    // window (§10.8 TC2 #2). Older context is NOT lost to the model: the memory
    // store's RAG injection below retrieves relevant older turns semantically.
    // Slicing happens BEFORE the attachment batch load, so dropped messages'
    // attachments are never fetched or parsed at all.
    const fullHistory = db.prepare(
      'SELECT id, role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(conversationId) as Array<Pick<MessageRow, 'id' | 'role' | 'content'>>;
    const history = limitHistory(fullHistory, getHistoryMaxTurns(db));

    // Batch-load every historical message's attachments in ONE query (was an N+1
    // query per message inside the build loop), grouped by message_id. Each row
    // carries the cached `extracted_text` so historical PDFs/text files are never
    // re-parsed turn after turn (see the extraction cache below).
    const attachmentsByMessage = new Map<
      string,
      Array<{ id: string; type: string; filename: string; mime_type: string; url: string; extracted_text: string | null }>
    >();
    if (history.length > 0) {
      const historyIds = history.map((h) => h.id);
      const placeholders = historyIds.map(() => '?').join(',');
      const allAtts = db.prepare(
        `SELECT id, message_id, type, filename, mime_type, url, extracted_text
         FROM attachments WHERE message_id IN (${placeholders})`
      ).all(...historyIds) as Array<{
        id: string;
        message_id: string;
        type: string;
        filename: string;
        mime_type: string;
        url: string;
        extracted_text: string | null;
      }>;
      for (const att of allAtts) {
        const list = attachmentsByMessage.get(att.message_id) || [];
        list.push({ id: att.id, type: att.type, filename: att.filename, mime_type: att.mime_type, url: att.url, extracted_text: att.extracted_text });
        attachmentsByMessage.set(att.message_id, list);
      }
    }

    // Return the extracted text for a saved attachment, using the cached column
    // when present and only parsing (+ persisting the result) on a cache miss.
    const cacheExtractStmt = db.prepare('UPDATE attachments SET extracted_text = ? WHERE id = ?');
    const extractCached = async (att: { id: string; filename: string; mime_type: string; url: string; extracted_text: string | null }): Promise<string | null> => {
      if (att.extracted_text !== null) return att.extracted_text || null;
      const base64Match = att.url.match(/^data:[^;]+;base64,(.+)$/);
      if (!base64Match) return null;
      const extracted = await extractFileText(att.mime_type, base64Match[1], att.filename || 'file');
      // Persist even an empty result ('') so a genuinely-empty/unsupported file
      // isn't re-parsed every turn; '' reads back as "no text" via `|| null`.
      try { cacheExtractStmt.run(extracted ?? '', att.id); } catch { /* non-fatal */ }
      return extracted;
    };

    // Station pool for this model — computed ONCE, up front (v0.7.55; TC2 #5
    // tail). Previously this spot ran `resolveModel` (a full station scan whose
    // result was never used) and the failover loop below re-ran an identical
    // scan. Now a single call to the SHARED services/modelInvocation
    // implementation (healthy-preferred, failover-ordered, round-robin rotated,
    // keys decrypted) feeds both the 503 check and the failover loop. Side
    // fix: the early check now respects the admin pool (it used the public
    // pool before, 503-ing admins whose model was admin-only).
    const stations = getModelStations(modelNormalizedName, { adminPool: isAdmin });
    if (stations.length === 0) {
      // Say WHICH of the three states this is (v0.7.89). The old single message
      // ("no healthy stations, wait and retry") sent the owner hunting for a
      // provider outage when the real cause was that a freshly pulled model is
      // left disabled by design — see routes/stations.ts "First pull: nothing selected".
      const reason = diagnoseNoStation(modelNormalizedName);
      return res.status(503).json({
        success: false,
        error: noStationMessage(reason, modelNormalizedName),
        reason,
      });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Build messages array for the API, with multimodal support.
    // 这里只把附件变成「可拼装的片段」（需要 I/O：解析 PDF、读提取缓存），
    // 真正的拼装规则在 services/chatContent.ts。v0.7.98 之前，本轮消息和历史消息
    // 各自维护了一份一模一样的 contentParts / textContent / hasImages 推演。
    const apiMessages: ChatApiMessage[] = [];
    for (const m of history) {
      // Apply input regex to current user message content for API
      const msgContent = (m.role === 'user' && m.id === userMsgId) ? transformedInput : m.content;
      const isCurrentTurn = m.role === 'user' && m.id === userMsgId && !!attachments && attachments.length > 0;
      const pieces: AttachmentPiece[] = [];

      if (isCurrentTurn) {
        // 本轮刚发出的消息：附件还是内存里的 base64，需要现场解析
        for (let ai = 0; ai < attachments.length; ai++) {
          const att = attachments[ai];
          if (att.mimeType.startsWith('image/')) {
            pieces.push({ kind: 'image', url: `data:${att.mimeType};base64,${att.base64}` });
            continue;
          }
          // Extract text from non-image files (PDF, text, code, etc.)
          const extracted = await extractFileText(att.mimeType, att.base64, att.filename);
          console.log(`[chat] File "${att.filename}" extraction result: ${extracted ? extracted.length + ' chars' : 'null'}`);
          // Persist to the extraction cache so NEXT turn (when this becomes a
          // historical message) never re-parses it. attachmentMeta is in the
          // same order as `attachments` (both built from the same input array).
          const attId = attachmentMeta[ai]?.id;
          if (attId) {
            try { cacheExtractStmt.run(extracted ?? '', attId); } catch { /* non-fatal */ }
          }
          if (!extracted) {
            console.warn(`[chat] Failed to extract text from "${att.filename}" (${att.mimeType}). AI will not see file content.`);
          }
          pieces.push({ kind: 'file', filename: att.filename, extracted });
        }
      } else {
        // Historical message: attachments come from the prefetched map (no
        // per-message query) and file text resolves through the extraction cache
        // (no re-parsing of historical PDFs/text files turn after turn).
        for (const att of attachmentsByMessage.get(m.id) || []) {
          if (att.type === 'image') {
            pieces.push({ kind: 'image', url: att.url });
          } else {
            pieces.push({ kind: 'file', filename: att.filename, extracted: await extractCached(att) });
          }
        }
      }

      apiMessages.push({ role: m.role, content: buildMessageContent(msgContent, pieces) });
    }

    // Send attachment info to client
    if (attachmentMeta.length > 0) {
      res.write(`data: ${JSON.stringify({ attachments: attachmentMeta })}\n\n`);
    }

    // ── system 上下文：先各自检索，最后按一个写明的顺序统一前置 ──
    // 顺序与格式化规则在 services/chatContext.ts（v0.7.99 抽出，含顺序测试）。
    // 原先这里是五次 apiMessages.unshift()，最终顺序靠调用次序**倒着**决定，
    // 而这个约定只写在一句注释里、没有任何测试盯着。
    const systemContext: SystemContextParts = {};

    // 文件库 RAG。
    // Gate the client-supplied fileIds through the visibility filter so the
    // sender can never pull another member's private file into context by
    // forging its id (default-private file library — §10.8 Phase 4).
    const visibleFileIds =
      fileIds && Array.isArray(fileIds) && fileIds.length > 0
        ? filterVisibleFileIds(db, fileIds, req.user)
        : [];
    // Compute the query embedding at most ONCE per turn and reuse it for both the
    // file-library RAG search and the memory vector search (same query text was
    // being embedded 2× per turn). Populated lazily by whichever runs first.
    let sharedQueryEmbedding: number[] | null = null;
    if (visibleFileIds.length > 0) {
      try {
        sharedQueryEmbedding = await generateEmbedding(message);
        systemContext.fileRag = formatFileContext(
          searchFileChunks(sharedQueryEmbedding, visibleFileIds, 5)
        );
      } catch (fileErr: unknown) {
        console.warn('[chat] File RAG injection failed:', getErrorMessage(fileErr));
      }
    }

    // 记忆库（向量检索）。按会话归属人隔离，成员之间看不到彼此的记忆。
    systemContext.memory = formatMemoryContext(
      await retrieveRelevantMemories(db, message, 5, conv.user_id, sharedQueryEmbedding)
    );

    // Inject triggered project-lorebook entries (世界书, v0.7.72). Keyword scan
    // covers the new message plus the last few turns so follow-up questions keep
    // a triggered setting active. Simple substring matching (CJK-safe); entries
    // cost no context until mentioned. Failures must never break chat.
    try {
      const loreRows = db
        .prepare('SELECT id, title, keywords, content, enabled, priority, created_by, created_at, updated_at FROM lorebook_entries WHERE enabled = 1')
        .all() as Array<{
        id: string; title: string; keywords: string; content: string; enabled: number;
        priority: number; created_by: string | null; created_at: string; updated_at: string;
      }>;
      if (loreRows.length > 0) {
        const scanText = [message, ...history.slice(-6).map((h) => h.content)].join('\n');
        const matched = matchLorebookEntries(
          scanText,
          loreRows.map((r) => ({
            id: r.id,
            title: r.title,
            keywords: JSON.parse(r.keywords || '[]') as string[],
            content: r.content,
            enabled: Boolean(r.enabled),
            priority: r.priority,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }))
        );
        const loreContext = buildLorebookContext(matched);
        if (loreContext) {
          systemContext.lorebook = loreContext;
        }
      }
    } catch (loreErr: unknown) {
      console.warn('[chat] Lorebook injection failed:', getErrorMessage(loreErr));
    }

    // In-chat web search (v0.7.74): the member flipped 联网 for this message —
    // ask the configured provider and inject snippets + sources. Unavailable /
    // failed search degrades to a normal answer (never blocks the chat).
    if (webSearch === true) {
      const search = await searchWeb(String(message), db);
      if (search.ok) {
        systemContext.webSearch = buildWebSearchContext(String(message), search.results);
      } else {
        console.warn('[chat] web search unavailable:', search.reason);
      }
    }

    // 会话自带的人设。空 / 纯空白由 orderSystemContext 过滤掉。
    systemContext.persona = conv.system_prompt;

    // 统一前置。`unshift(...items)` 会按给定顺序插到最前面，
    // 所以 orderSystemContext 返回的顺序就是模型看到的顺序。
    apiMessages.unshift(
      ...orderSystemContext(systemContext).map((content) => ({ role: 'system' as const, content }))
    );

    // Try stations with failover (pool computed once above — no re-scan).
    let assistantContent = '';
    /** 展示用的 `模型 @ 节点` 串（写进 messages.model_used 和用量日志）。 */
    let usedStation = '';
    /**
     * 胜出的那个节点本身。
     *
     * v0.7.99：自审段原先是把 `usedStation` 这个展示串**拆开再反查**
     * （`split(' @ ')[0]` 取模型名，再用同样的拼法 `find()` 回节点）。
     * 直接留一个引用就不用来回编解码了 —— 顺带去掉一个隐患：
     * 万一两个条目拼出同样的展示串（同名节点、或同一节点被列了两次），
     * `find()` 可能反查到另一个。
     */
    let winningStation: (typeof stations)[number] | null = null;

    // Load enabled MCP tools
    const mcpTools = loadEnabledMcpTools(db);

    // What each station actually said when it refused (v0.7.90) — collected so
    // the failure can name a cause instead of a bare "All stations failed".
    const stationFailures: StationFailure[] = [];

    for (const s of stations) {
      try {
        const requestBody: ChatRequestBody = {
          model: s.modelId,
          messages: apiMessages,
          stream: true,
        };

        // Include tools if MCP tools are available
        if (mcpTools.length > 0) {
          requestBody.tools = mcpTools;
        }

        const response = await fetch(`${s.station.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${s.station.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          // Read the body before discarding the attempt — this is where the
          // provider says WHY (invalid key, unknown model, quota). It used to be
          // dropped on the floor, leaving the user with "All stations failed".
          let body = '';
          try { body = await response.text(); } catch { /* body already consumed/absent */ }
          const detail = sanitizeUpstreamDetail(body, s.station.apiKey);
          console.error(`Station ${s.station.name} returned ${response.status}: ${detail}`);
          stationFailures.push({ stationName: s.station.name, status: response.status, detail });
          continue;
        }

        usedStation = `${s.modelId} @ ${s.station.name}`;
        winningStation = s;

        // Stream the response with tool_call support
        const maxToolRounds = 5;
        let currentApiMessages = [...apiMessages];
        let currentRequestBody = { ...requestBody };

        for (let toolRound = 0; toolRound <= maxToolRounds; toolRound++) {
          const roundResponse = toolRound === 0 ? response : await fetch(`${s.station.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${s.station.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentRequestBody),
          });

          if (!roundResponse.ok) {
            console.error(`Station ${s.station.name} returned ${roundResponse.status} on tool round ${toolRound}`);
            break;
          }

          const reader = roundResponse.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';
          let roundContent = '';
          // Collect tool_calls: indexed by position
          const toolCallsMap: Map<number, AccumulatedToolCall> = new Map();
          let hasToolCalls = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') {
                  break;
                }
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta;

                  if (delta?.content) {
                    roundContent += delta.content;
                    assistantContent += delta.content;
                    res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
                  }

                  // Handle tool_calls streaming deltas.
                  // 累加规则在 services/toolCallStream.ts（v0.7.98 抽出 + 单测）：
                  // 按 index 认领、跨 chunk 拼接、容忍字段缺失。
                  if (delta?.tool_calls) {
                    hasToolCalls = true;
                    accumulateToolCalls(toolCallsMap, delta.tool_calls);
                  }
                } catch {
                  // Skip invalid JSON chunks
                }
              }
            }
          }

          // If no tool calls, we're done
          if (!hasToolCalls || toolCallsMap.size === 0) {
            break;
          }

          // Execute tool calls.
          // 显式按 index 排序而不是用 Map 的插入序：插入序取决于增量到达顺序，
          // 并行调用时不保证等于 index 序。上游是按 tool_call_id 配结果的，
          // 所以这不是一个活着的 bug，但顺序稳定不花成本。
          const toolCalls = orderedToolCalls(toolCallsMap);

          // Send tool call info to client for rendering
          for (const tc of toolCalls) {
            let parsedArgs: Record<string, unknown> = {};
            try { parsedArgs = JSON.parse(tc.arguments); } catch { /* empty */ }

            res.write(`data: ${JSON.stringify({
              toolCall: {
                id: tc.id,
                name: tc.name,
                arguments: parsedArgs,
              },
            })}\n\n`);
          }

          // Build assistant message with tool_calls for next round
          const assistantToolCallsMsg: ChatApiMessage = {
            role: 'assistant',
            content: roundContent || null,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            })),
          };

          // Execute each tool and build tool result messages
          const toolResultMessages: ChatApiMessage[] = [];
          for (const tc of toolCalls) {
            let parsedArgs: Record<string, unknown> = {};
            try { parsedArgs = JSON.parse(tc.arguments); } catch { /* empty */ }

            let toolResult: string;
            try {
              const resolved = resolveToolCall(tc.name);
              if (resolved) {
                const result = await executeToolCall(resolved.serverId, resolved.toolName, parsedArgs);
                toolResult = typeof result === 'string' ? result : JSON.stringify(result);
              } else {
                toolResult = JSON.stringify({ error: `Unknown tool: ${tc.name}` });
              }
            } catch (err: unknown) {
              toolResult = JSON.stringify({ error: getErrorMessage(err) });
            }

            // Send tool result to client
            res.write(`data: ${JSON.stringify({
              toolResult: { id: tc.id, name: tc.name, result: toolResult },
            })}\n\n`);

            toolResultMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: toolResult,
            });
          }

          // Prepare next round messages
          currentApiMessages = [...currentApiMessages, assistantToolCallsMsg, ...toolResultMessages];
          currentRequestBody = { ...currentRequestBody, messages: currentApiMessages };
        }

        // Send final done
        res.write('data: [DONE]\n\n');

        // Success - break out of failover loop
        break;
      } catch (err: unknown) {
        const detail = sanitizeUpstreamDetail(getErrorMessage(err), s.station.apiKey);
        console.error(`Station ${s.station.name} failed:`, detail);
        // status null = the request never landed (DNS, refused, timeout)
        stationFailures.push({ stationName: s.station.name, status: null, detail });
        // Mark station unhealthy temporarily
        const failTime = new Date().toISOString();
        db.prepare('UPDATE stations SET health_status = ?, updated_at = ? WHERE id = ?')
          .run('unhealthy', failTime, s.station.id);
        continue;
      }
    }

    if (!assistantContent) {
      const kind = classifyUpstreamFailures(stationFailures);
      const summary = upstreamFailureMessage(kind);
      // Per-station breakdown: admins only. It names stations and echoes
      // upstream bodies, which a regular member has no way to act on anyway —
      // their message already says to fetch an admin.
      const detailLines = stationFailures.map(
        (f) => `${f.stationName}: ${f.status !== null ? `HTTP ${f.status}` : 'no response'}${f.detail ? ` — ${f.detail}` : ''}`
      );
      logApiUsage({
        userId: req.user?.id || conv.user_id || null,
        username: req.user?.username || null,
        role: req.user?.role || null,
        kind: 'chat',
        modelNormalized: modelNormalizedName,
        conversationId,
        status: 'error',
        // The log keeps the full breakdown regardless of who was asking.
        errorMessage: detailLines.length ? `${summary} | ${detailLines.join(' | ')}` : summary,
        latencyMs: Date.now() - chatStarted,
      });
      res.write(`data: ${JSON.stringify({
        error: summary,
        ...(isAdmin && detailLines.length ? { detail: detailLines.join('\n') } : {}),
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Self-review pass: if enabled, send the response through a review prompt.
    // 提示词与响应解析在 services/selfReview.ts（v0.7.99 抽出 + 单测）。
    if (conv.self_review && winningStation) {
      console.log(`[chat] Self-review enabled for conversation ${conversationId}, starting review pass...`);
      try {
        const reviewRequestBody: ChatRequestBody = {
          model: winningStation.modelId, // 与正文用的是同一个模型
          messages: [{ role: 'user', content: buildSelfReviewPrompt(assistantContent) }],
          stream: false,
        };

        const reviewResponse = await fetch(`${winningStation.station.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${winningStation.station.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reviewRequestBody),
        });

        if (reviewResponse.ok) {
          const reviewedContent = extractReviewedContent(await reviewResponse.json());
          if (reviewedContent) {
            console.log(`[chat] Self-review complete. Original: ${assistantContent.length} chars, Reviewed: ${reviewedContent.length} chars`);
            assistantContent = reviewedContent;
            // Send the reviewed content as a replacement event
            res.write(`data: ${JSON.stringify({ reviewedContent: assistantContent })}\n\n`);
          }
        } else {
          console.error(`[chat] Self-review API call failed with status ${reviewResponse.status}`);
        }
      } catch (reviewErr: unknown) {
        console.error('[chat] Self-review error:', getErrorMessage(reviewErr));
        // Continue with original content if review fails
      }
    }

    // Apply output regex transformation for display
    if (activeRegexScripts.length > 0) {
      const displayContent = applyRegexScripts(activeRegexScripts, assistantContent, 'output');
      if (displayContent !== assistantContent) {
        console.log(`[regex] Output regex applied. Original: ${assistantContent.length} chars, Transformed: ${displayContent.length} chars`);
        assistantContent = displayContent;
        res.write(`data: ${JSON.stringify({ regexContent: displayContent })}\n\n`);
      }
    }

    // Save assistant message (raw content before regex, regex is display-only)
    // Note: assistantContent may have been modified by output regex for display,
    // but we save the post-review content. The regex is purely cosmetic for the client.
    const assistantMsgId = uuidv4();
    const assistantTime = new Date().toISOString();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, model_used, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(assistantMsgId, conversationId, 'assistant', assistantContent, usedStation, assistantTime);

    // Approximate tokens when provider usage missing
    const approxPrompt = Math.ceil(String(message).length / 4);
    const approxCompletion = Math.ceil(String(assistantContent).length / 4);
    logApiUsage({
      userId: req.user?.id || conv.user_id || null,
      username: req.user?.username || null,
      role: req.user?.role || null,
      kind: 'chat',
      modelNormalized: modelNormalizedName,
      modelUsed: usedStation,
      conversationId,
      status: 'ok',
      promptTokens: approxPrompt,
      completionTokens: approxCompletion,
      totalTokens: approxPrompt + approxCompletion,
      latencyMs: Date.now() - chatStarted,
    });

    // Auto-save to memory store (with vector embedding generation)
    const userId = conv.user_id || null;
    autoSaveMemory(db, conversationId, userMsgId, 'user', message, modelNormalizedName, userId).catch(err => console.error('[memory] User memory save error:', err));
    autoSaveMemory(db, conversationId, assistantMsgId, 'assistant', assistantContent, modelNormalizedName, userId).catch(err => console.error('[memory] Assistant memory save error:', err));

    // Auto-distill learning (v0.7.73): every N messages, refine this
    // conversation's fresh tail into durable memory facts in the background.
    maybeDistillConversation(conversationId, db);

    res.end();
  } catch (err: unknown) {
    console.error('Chat error:', err);
    try {
      logApiUsage({
        userId: (req as AuthRequest).user?.id || null,
        username: (req as AuthRequest).user?.username || null,
        role: (req as AuthRequest).user?.role || null,
        kind: 'chat',
        modelNormalized: (req.body || {}).modelNormalizedName,
        conversationId: (req.body || {}).conversationId,
        status: 'error',
        httpStatus: 500,
        errorMessage: getErrorMessage(err),
      });
    } catch { /* ignore */ }
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: getErrorMessage(err) });
    } else {
      res.write(`data: ${JSON.stringify({ error: getErrorMessage(err) })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// Auto-save conversation turn to memory store with vector embedding
async function autoSaveMemory(
  db: Database.Database,
  conversationId: string,
  messageId: string,
  role: 'user' | 'assistant',
  content: string,
  modelUsed: string,
  userId?: string | null
): Promise<void> {
  try {
    const config = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as MemoryConfigRow | undefined;
    if (!config || !config.auto_save) return;

    const keywords = extractKeywords(content);
    const summary = generateSummary(content, role);
    const importance = calculateImportance(content, keywords);
    const tags = extractTags(content);
    const id = uuidv4();
    const now = new Date().toISOString();

    // Generate embedding vector for the content
    let embeddingJson: string | null = null;
    try {
      const embedding = await generateEmbedding(content);
      embeddingJson = serializeEmbedding(embedding);
      console.log(`[memory] Generated embedding for ${role} message (${embedding.length} dims)`);
    } catch (embErr: unknown) {
      console.warn(`[memory] Embedding generation failed, saving without vector: ${getErrorMessage(embErr)}`);
    }

    db.prepare(`
      INSERT INTO memory_entries (id, conversation_id, message_id, role, content, summary, keywords, tags, model_used, importance, embedding, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, conversationId, messageId, role, content, summary, JSON.stringify(keywords), JSON.stringify(tags), modelUsed, importance, embeddingJson, userId || null, now, now);

    // Update tag entry counts
    for (const tag of tags) {
      db.prepare(`
        INSERT INTO memory_tags (id, name, entry_count, created_at) VALUES (?, ?, 1, ?)
        ON CONFLICT(name) DO UPDATE SET entry_count = entry_count + 1
      `).run(uuidv4(), tag, now);
    }
  } catch (err) {
    console.error('Auto-save memory error:', err);
  }
}

// Retrieve relevant memories for context injection using vector similarity
async function retrieveRelevantMemories(db: Database.Database, query: string, limit: number = 5, userId?: string | null, precomputedEmbedding?: number[] | null): Promise<MemoryContextRow[]> {
  try {
    const config = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as MemoryConfigRow | undefined;
    if (!config || !config.context_injection) return [];

    const maxMemories = Math.min(limit, config.max_context_memories || 5);
    // Privacy scoping: when the chat's owner is known, only use their own + legacy (NULL) memories,
    // so one member's saved memories are never injected into another member's chat.
    const scopeUser = typeof userId === 'string' && userId.length > 0;
    const userClause = scopeUser ? ' AND (user_id = ? OR user_id IS NULL)' : '';

    // Check if we have any embeddings stored
    const embeddingCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM memory_entries WHERE embedding IS NOT NULL AND embedding != \'\''
    ).get() as { cnt: number };

    if (embeddingCount && embeddingCount.cnt > 0) {
      // Use vector similarity search
      console.log(`[memory] Using vector search (${embeddingCount.cnt} entries with embeddings)`);
      try {
        // Reuse the query embedding computed earlier (e.g. for file RAG) when
        // available, so the same query isn't embedded twice in one turn.
        const queryEmbedding = precomputedEmbedding ?? (await generateEmbedding(query));
        const results = vectorSearch(db, queryEmbedding, maxMemories, 0.2, userId);
        if (results.length > 0) {
          console.log(`[memory] Vector search found ${results.length} relevant memories`);
          return results;
        }
        console.log('[memory] Vector search returned 0 results, falling back to keyword search');
      } catch (vecErr: unknown) {
        console.warn(`[memory] Vector search failed, falling back to keyword: ${getErrorMessage(vecErr)}`);
      }
    }

    // Fallback: keyword-based search
    const keywords = extractKeywords(query);
    if (keywords.length === 0) {
      return db.prepare(`
        SELECT summary, content, keywords, created_at, role
        FROM memory_entries
        WHERE summary IS NOT NULL AND summary != ''${userClause}
        ORDER BY importance DESC, created_at DESC
        LIMIT ?
      `).all(...(scopeUser ? [userId, maxMemories] : [maxMemories])) as MemoryContextRow[];
    }

    const conditions = keywords.map(() => '(content LIKE ? OR keywords LIKE ? OR summary LIKE ?)').join(' OR ');
    const params: (string | number)[] = [];
    for (const kw of keywords) {
      params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`);
    }
    if (scopeUser) params.push(userId as string);
    params.push(maxMemories);

    return db.prepare(`
      SELECT summary, content, keywords, created_at, role
      FROM memory_entries
      WHERE (${conditions})${userClause}
      ORDER BY importance DESC, created_at DESC
      LIMIT ?
    `).all(...params) as MemoryContextRow[];
  } catch (err) {
    console.error('Memory retrieval error:', err);
    return [];
  }
}

// Generate a concise summary from content
function generateSummary(content: string, role: 'user' | 'assistant'): string {
  const now = new Date();
  const timeStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Truncate content for summary
  const truncated = content.length > 200 ? content.substring(0, 200) + '...' : content;

  // Extract the main topic: first sentence or first 100 chars
  const firstSentence = content.split(/[。！？\n.!?]/).filter(s => s.trim())[0]?.trim() || '';
  const topic = firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;

  if (role === 'user') {
    return `[${timeStr}] 用户提问: ${topic || truncated}`;
  } else {
    return `[${timeStr}] AI回复: ${topic || truncated}`;
  }
}

// Calculate importance score based on content analysis
function calculateImportance(content: string, keywords: string[]): number {
  let score = 0.5; // base

  // Longer content is usually more important
  if (content.length > 500) score += 0.1;
  if (content.length > 1000) score += 0.1;

  // Content with more keywords is more topic-rich
  if (keywords.length >= 5) score += 0.1;
  if (keywords.length >= 8) score += 0.1;

  // Questions are usually more important for memory
  if (/[？?]/.test(content)) score += 0.05;

  // Contains numbers/dates (factual info)
  if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(content)) score += 0.05;

  return Math.min(score, 1.0);
}

// Extract tags from content (topic categories)
function extractTags(content: string): string[] {
  const tags: string[] = [];
  const lower = content.toLowerCase();

  // Topic-based tag detection
  const tagPatterns: [RegExp, string][] = [
    [/天气|气温|温度|下雨|晴天|阴天|weather/i, '天气'],
    [/编程|代码|开发|bug|api|程序|coding/i, '编程'],
    [/学习|教育|课程|知识|教程|learning/i, '学习'],
    [/工作|项目|任务|会议|job|work/i, '工作'],
    [/健康|运动|饮食|睡眠|health/i, '健康'],
    [/旅行|旅游|出行|航班|酒店|travel/i, '旅行'],
    [/美食|餐厅|做饭|菜谱|food/i, '美食'],
    [/电影|音乐|游戏|娱乐|entertainment/i, '娱乐'],
    [/购物|商品|价格|买|shop/i, '购物'],
    [/科技|技术|AI|人工智能|tech/i, '科技'],
    [/设计|UI|界面|design/i, '设计'],
    [/数据库|SQL|database/i, '数据库'],
    [/网络|服务器|部署|server/i, '运维'],
    [/数学|计算|公式|math/i, '数学'],
    [/翻译|语言|英文|中文|translate/i, '翻译'],
  ];

  for (const [pattern, tag] of tagPatterns) {
    if (pattern.test(content)) {
      tags.push(tag);
    }
  }

  return tags;
}

// Extract keywords from text (supports Chinese and English)
function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();

  // English keywords: words > 3 chars
  const englishWords = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  const enStopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should',
    'about', 'their', 'there', 'where', 'which', 'what', 'when', 'your', 'just', 'also',
    'some', 'than', 'them', 'then', 'these', 'those', 'very', 'more', 'does', 'doing',
    'into', 'each', 'every', 'both', 'being', 'between', 'through', 'during', 'before',
    'after', 'above', 'below', 'other', 'same', 'such', 'only', 'over', 'own', 'same',
    'here', 'they', 'she', 'him', 'her', 'its', 'our', 'you', 'not', 'nor', 'but',
  ]);

  for (const w of englishWords) {
    if (!enStopWords.has(w)) {
      keywords.add(w);
    }
  }

  // Chinese keywords: extract meaningful phrases (2-4 char sequences)
  const chineseChars = text.replace(/[^\u4e00-\u9fff]/g, '');
  if (chineseChars.length > 0) {
    // Extract 2-char and 3-char Chinese phrases
    for (let i = 0; i < chineseChars.length - 1; i++) {
      const bigram = chineseChars.substring(i, i + 2);
      // Skip very common bigrams
      if (!['的是', '不了', '我们', '他们', '什么', '怎么', '这个', '那个', '可以', '已经', '还是', '就是', '因为', '所以', '但是', '如果', '这样', '那样', '一个', '一些', '一下', '一样', '不是', '没有', '知道', '觉得', '认为'].includes(bigram)) {
        keywords.add(bigram);
      }
      if (i < chineseChars.length - 2) {
        const trigram = chineseChars.substring(i, i + 3);
        keywords.add(trigram);
      }
    }

    // Extract named entities (连续的中文字符 >= 2)
    const namedEntities = text.match(/[\u4e00-\u9fff]{2,}/g) || [];
    for (const entity of namedEntities) {
      if (entity.length >= 2 && entity.length <= 6) {
        keywords.add(entity);
      }
    }
  }

  // Count frequency and return top keywords
  const freq = new Map<string, number>();
  for (const w of keywords) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => {
      // Prefer longer keywords, then by frequency
      const lenDiff = b[0].length - a[0].length;
      if (lenDiff !== 0) return lenDiff;
      return b[1] - a[1];
    })
    .slice(0, 15)
    .map(([w]) => w);
}

export default router;
