import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { logApiUsage } from '../services/usageLog';
import type { AuthRequest } from '../types';
import type { ConversationRow, MessageRow, MemoryConfigRow, StationModelJoinRow } from '../dbRows';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number; numrender: number; info: unknown; metadata: unknown; version: string }>;
import { getDb } from '../database';
import { normalizeModelName } from '../services/normalizeModelName';
import { ApiResponse } from '../types';
import { loadEnabledMcpTools, resolveToolCall, executeToolCall } from '../services/mcpClient';
import { generateEmbedding, serializeEmbedding, vectorSearch } from '../services/embeddings';
import { roundRobin } from '../services/loadBalancer';
import { getActiveScripts, applyRegexScripts } from '../services/regexEngine';
import { getErrorMessage } from '../utils/errors';
import { searchFileChunks } from '../services/fileProcessor';

/** OpenAI-style multimodal content part for chat completions. */
type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

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
    const { conversationId, modelNormalizedName, message, attachments, fileIds } = req.body;
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
    // Only the owner (or admin) may send into an owned conversation.
    // Ownerless rows (legacy / guest-created) stay open so those flows keep working.
    const sender = req.user;
    if (conv.user_id != null && !(sender && (sender.role === 'admin' || sender.id === conv.user_id))) {
      return res.status(403).json({ success: false, error: 'You do not have permission to send messages in this conversation' });
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

    // Get conversation history for context
    const history = db.prepare(
      'SELECT id, role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(conversationId) as Array<Pick<MessageRow, 'id' | 'role' | 'content'>>;

    // Resolve model to a station using round-robin + failover
    const resolved = resolveModel(db, modelNormalizedName);
    if (!resolved) {
      return res.status(503).json({
        success: false,
        error: `No healthy stations available for model "${modelNormalizedName}"`,
      });
    }

    const { station, modelId } = resolved;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Build messages array for the API, with multimodal support
    const apiMessages: ChatApiMessage[] = [];
    for (const m of history) {
      // Apply input regex to current user message content for API
      const msgContent = (m.role === 'user' && m.id === userMsgId) ? transformedInput : m.content;
      if (m.role === 'user' && m.id === userMsgId && attachments && attachments.length > 0) {
        // Build multimodal content for the current user message with attachments
        const contentParts: ChatContentPart[] = [];
        let textContent = msgContent;
        for (const att of attachments) {
          if (att.mimeType.startsWith('image/')) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:${att.mimeType};base64,${att.base64}` },
            });
          } else {
            // Extract text from non-image files (PDF, text, code, etc.)
            const extracted = await extractFileText(att.mimeType, att.base64, att.filename);
            console.log(`[chat] File "${att.filename}" extraction result: ${extracted ? extracted.length + ' chars' : 'null'}`);
            if (extracted) {
              textContent += `\n\n--- [Attached File: ${att.filename}] ---\n${extracted}\n--- [End of ${att.filename}] ---`;
            } else {
              console.warn(`[chat] Failed to extract text from "${att.filename}" (${att.mimeType}). AI will not see file content.`);
            }
          }
        }
        if (contentParts.length > 0) {
          // Has images — use multimodal content array with text as first part
          contentParts.unshift({ type: 'text', text: textContent });
          apiMessages.push({ role: m.role, content: contentParts });
        } else {
          // No images — send as plain text (possibly with extracted file content)
          apiMessages.push({ role: m.role, content: textContent });
        }
      } else {
        // Check if this message has saved attachments
        const msgAttachments = db.prepare(
          'SELECT type, filename, mime_type, url FROM attachments WHERE message_id = ?'
        ).all(m.id) as Array<{ id: string; type: string; filename: string; mime_type: string; url: string }>;
        if (msgAttachments.length > 0) {
          const contentParts: ChatContentPart[] = [];
          let textContent = msgContent;
          let hasImages = false;
          for (const att of msgAttachments) {
            if (att.type === 'image') {
              hasImages = true;
              contentParts.push({
                type: 'image_url',
                image_url: { url: att.url },
              });
            } else {
              // Extract text from non-image saved attachments
              // url is stored as data:mime;base64,xxxxx — extract the base64 part
              const base64Match = att.url.match(/^data:[^;]+;base64,(.+)$/);
              if (base64Match) {
                const extracted = await extractFileText(att.mime_type, base64Match[1], att.filename || 'file');
                if (extracted) {
                  textContent += `\n\n--- [Attached File: ${att.filename || 'file'}] ---\n${extracted}\n--- [End of ${att.filename || 'file'}] ---`;
                }
              }
            }
          }
          if (hasImages) {
            contentParts.unshift({ type: 'text', text: textContent });
            apiMessages.push({ role: m.role, content: contentParts });
          } else {
            apiMessages.push({ role: m.role, content: textContent });
          }
        } else {
          apiMessages.push({ role: m.role, content: msgContent });
        }
      }
    }

    // Send attachment info to client
    if (attachmentMeta.length > 0) {
      res.write(`data: ${JSON.stringify({ attachments: attachmentMeta })}\n\n`);
    }

    // Inject relevant file library chunks as system context (RAG)
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      try {
        const queryEmbedding = await generateEmbedding(message);
        const relevantChunks = searchFileChunks(queryEmbedding, fileIds, 5);
        if (relevantChunks.length > 0) {
          const fileContext = relevantChunks
            .map((c: { fileName: string; content: string }) => `[${c.fileName}] ${c.content}`)
            .join('\n\n');
          apiMessages.unshift({
            role: 'system',
            content: `以下是从文件库中检索到的相关内容：\n${fileContext}\n\n请基于这些文件内容回答用户的问题。`,
          });
        }
      } catch (fileErr: unknown) {
        console.warn('[chat] File RAG injection failed:', getErrorMessage(fileErr));
      }
    }

    // Inject relevant memories as system context (vector search)
    // Scoped to the conversation owner so members never see each other's memories.
    const relevantMemories = await retrieveRelevantMemories(db, message, 5, conv.user_id);
    if (relevantMemories.length > 0) {
      const memoryContext = relevantMemories
        .filter((m) => m.summary)
        .map((m) => `- ${m.summary}`)
        .join('\n');

      if (memoryContext) {
        apiMessages.unshift({
          role: 'system',
          content: `以下是从记忆库中检索到的相关记忆，可能对回答用户问题有帮助：\n${memoryContext}\n\n请根据这些记忆信息来更好地回答用户的问题。如果记忆中没有相关信息，请正常回答。`,
        });
      }
    }

    // Inject this conversation's custom system prompt (persona) as the LEADING system message.
    // Unshifted last so it lands before file/memory context — the persona should frame the
    // whole exchange, with retrieval context following it. Empty/whitespace-only = no injection.
    if (conv.system_prompt && conv.system_prompt.trim()) {
      apiMessages.unshift({ role: 'system', content: conv.system_prompt });
    }

    // Try stations with failover
    const stations = roundRobin(modelNormalizedName, getStationsForModel(db, modelNormalizedName, isAdmin));
    let assistantContent = '';
    let usedStation = '';

    // Load enabled MCP tools
    const mcpTools = loadEnabledMcpTools(db);

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
          console.error(`Station ${s.station.name} returned ${response.status}`);
          continue;
        }

        usedStation = `${s.modelId} @ ${s.station.name}`;

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
          const toolCallsMap: Map<number, { id: string; name: string; arguments: string }> = new Map();
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

                  // Handle tool_calls streaming deltas
                  if (delta?.tool_calls) {
                    hasToolCalls = true;
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      if (!toolCallsMap.has(idx)) {
                        toolCallsMap.set(idx, { id: '', name: '', arguments: '' });
                      }
                      const existing = toolCallsMap.get(idx)!;
                      if (tc.id) existing.id = tc.id;
                      if (tc.function?.name) existing.name += tc.function.name;
                      if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                    }
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

          // Execute tool calls
          const toolCalls = Array.from(toolCallsMap.values());

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
        console.error(`Station ${s.station.name} failed:`, getErrorMessage(err));
        // Mark station unhealthy temporarily
        const failTime = new Date().toISOString();
        db.prepare('UPDATE stations SET health_status = ?, updated_at = ? WHERE id = ?')
          .run('unhealthy', failTime, s.station.id);
        continue;
      }
    }

    if (!assistantContent) {
      logApiUsage({
        userId: req.user?.id || conv.user_id || null,
        username: req.user?.username || null,
        role: req.user?.role || null,
        kind: 'chat',
        modelNormalized: modelNormalizedName,
        conversationId,
        status: 'error',
        errorMessage: 'All stations failed',
        latencyMs: Date.now() - chatStarted,
      });
      res.write(`data: ${JSON.stringify({ error: 'All stations failed' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Self-review pass: if enabled, send the response through a review prompt
    if (conv.self_review) {
      console.log(`[chat] Self-review enabled for conversation ${conversationId}, starting review pass...`);
      try {
        const reviewPrompt = `You are a professional editor and proofreader. Review the following AI response for:
1. Grammar errors and typos
2. Table formatting issues (broken markdown tables, misaligned columns)
3. Formatting inconsistencies

If you find any issues, correct them and return ONLY the corrected version. If there are no issues, return the original text unchanged. Do NOT add any commentary, explanation, or meta-text. Just return the corrected content directly.

---BEGIN AI RESPONSE---
${assistantContent}
---END AI RESPONSE---`;

        const reviewRequestBody: ChatRequestBody = {
          model: usedStation.split(' @ ')[0], // Use the same model
          messages: [{ role: 'user', content: reviewPrompt }],
          stream: false,
        };

        // Find the station info for the review call
        const reviewStation = stations.find((s) => `${s.modelId} @ ${s.station.name}` === usedStation);
        if (reviewStation) {
          const reviewResponse = await fetch(`${reviewStation.station.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${reviewStation.station.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(reviewRequestBody),
          });

          if (reviewResponse.ok) {
            const reviewData = await reviewResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
            const reviewedContent = reviewData.choices?.[0]?.message?.content;
            if (reviewedContent && reviewedContent.trim()) {
              console.log(`[chat] Self-review complete. Original: ${assistantContent.length} chars, Reviewed: ${reviewedContent.length} chars`);
              assistantContent = reviewedContent;
              // Send the reviewed content as a replacement event
              res.write(`data: ${JSON.stringify({ reviewedContent: assistantContent })}\n\n`);
            }
          } else {
            console.error(`[chat] Self-review API call failed with status ${reviewResponse.status}`);
          }
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

// Resolve model to a single station using counter-based round-robin
function resolveModel(db: Database.Database, normalizedName: string): { station: { id: string; name: string; baseUrl: string; apiKey: string; healthStatus: string }; modelId: string } | null {
  const stations = getStationsForModel(db, normalizedName);
  if (stations.length === 0) return null;

  // Counter-based round-robin: rotate the station list, take the first.
  const pick = roundRobin(normalizedName, stations)[0];
  return { station: pick.station, modelId: pick.modelId };
}

// Get all healthy stations for a normalized model name
function getStationsForModel(db: Database.Database, normalizedName: string, adminPool = false): { station: { id: string; name: string; baseUrl: string; apiKey: string; healthStatus: string }; modelId: string }[] {
  const pool = adminPool
    ? 'COALESCE(sm.admin_enabled, 1) = 1'
    : 'sm.enabled = 1';
  const rows = db.prepare(`
    SELECT sm.model_id, s.id, s.name, s.base_url, s.api_key, s.health_status, s.enabled
    FROM station_models sm
    JOIN stations s ON sm.station_id = s.id
    WHERE ${pool} AND s.enabled = 1
  `).all() as StationModelJoinRow[];

  return rows
    .filter((r) => normalizeModelName(r.model_id) === normalizedName)
    .map((r) => ({
      station: { id: r.id, name: r.name, baseUrl: r.base_url, apiKey: r.api_key, healthStatus: r.health_status },
      modelId: r.model_id,
    }));
}

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
async function retrieveRelevantMemories(db: Database.Database, query: string, limit: number = 5, userId?: string | null): Promise<MemoryContextRow[]> {
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
        const queryEmbedding = await generateEmbedding(query);
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
