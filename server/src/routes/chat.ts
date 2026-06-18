import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number; numrender: number; info: any; metadata: any; version: string }>;
import { getDb } from '../database';
import { normalizeModelName } from './models';
import { ApiResponse } from '../types';
import { loadEnabledMcpTools, resolveToolCall, executeToolCall } from '../services/mcpClient';

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
      } catch (pdfErr: any) {
        console.error(`[extractFileText] PDF parse error for ${filename}:`, pdfErr.message || pdfErr);
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { conversationId, modelNormalizedName, message, attachments } = req.body;
    if (!conversationId || !modelNormalizedName || !message) {
      return res.status(400).json({ success: false, error: 'conversationId, modelNormalizedName, and message are required' });
    }

    const db = getDb();

    // Get conversation
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as any;
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Save user message
    const userMsgId = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userMsgId, conversationId, 'user', message, now);

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
    ).all(conversationId) as any[];

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
    const apiMessages: any[] = [];
    for (const m of history) {
      if (m.role === 'user' && m.id === userMsgId && attachments && attachments.length > 0) {
        // Build multimodal content for the current user message with attachments
        const contentParts: any[] = [];
        let textContent = m.content;
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
        ).all(m.id) as any[];
        if (msgAttachments.length > 0) {
          const contentParts: any[] = [];
          let textContent = m.content;
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
          apiMessages.push({ role: m.role, content: m.content });
        }
      }
    }

    // Send attachment info to client
    if (attachmentMeta.length > 0) {
      res.write(`data: ${JSON.stringify({ attachments: attachmentMeta })}\n\n`);
    }

    // Inject relevant memories as system context
    const relevantMemories = retrieveRelevantMemories(db, message, 5);
    if (relevantMemories.length > 0) {
      const memoryContext = relevantMemories
        .filter((m: any) => m.summary)
        .map((m: any) => `- ${m.summary}`)
        .join('\n');

      if (memoryContext) {
        apiMessages.unshift({
          role: 'system',
          content: `以下是从记忆库中检索到的相关记忆，可能对回答用户问题有帮助：\n${memoryContext}\n\n请根据这些记忆信息来更好地回答用户的问题。如果记忆中没有相关信息，请正常回答。`,
        });
      }
    }

    // Try stations with failover
    const stations = getStationsForModel(db, modelNormalizedName);
    let assistantContent = '';
    let usedStation = '';

    // Load enabled MCP tools
    const mcpTools = loadEnabledMcpTools(db);

    for (const s of stations) {
      try {
        const requestBody: any = {
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
          const assistantToolCallsMsg: any = {
            role: 'assistant',
            content: roundContent || null,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            })),
          };

          // Execute each tool and build tool result messages
          const toolResultMessages: any[] = [];
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
            } catch (err: any) {
              toolResult = JSON.stringify({ error: err.message });
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
      } catch (err: any) {
        console.error(`Station ${s.station.name} failed:`, err.message);
        // Mark station unhealthy temporarily
        const failTime = new Date().toISOString();
        db.prepare('UPDATE stations SET health_status = ?, updated_at = ? WHERE id = ?')
          .run('unhealthy', failTime, s.station.id);
        continue;
      }
    }

    if (!assistantContent) {
      res.write(`data: ${JSON.stringify({ error: 'All stations failed' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Save assistant message
    const assistantMsgId = uuidv4();
    const assistantTime = new Date().toISOString();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, model_used, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(assistantMsgId, conversationId, 'assistant', assistantContent, usedStation, assistantTime);

    // Auto-save to memory store
    autoSaveMemory(db, conversationId, userMsgId, 'user', message, modelNormalizedName);
    autoSaveMemory(db, conversationId, assistantMsgId, 'assistant', assistantContent, modelNormalizedName);

    res.end();
  } catch (err: any) {
    console.error('Chat error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// Resolve model to a station using round-robin
function resolveModel(db: any, normalizedName: string): { station: any; modelId: string } | null {
  const stations = getStationsForModel(db, normalizedName);
  if (stations.length === 0) return null;

  // Simple round-robin: use a random pick for now (proper counter-based RR in Phase 3)
  const pick = stations[Math.floor(Math.random() * stations.length)];
  return { station: pick.station, modelId: pick.modelId };
}

// Get all healthy stations for a normalized model name
function getStationsForModel(db: any, normalizedName: string): { station: any; modelId: string }[] {
  const rows = db.prepare(`
    SELECT sm.model_id, s.id, s.name, s.base_url, s.api_key, s.health_status, s.enabled
    FROM station_models sm
    JOIN stations s ON sm.station_id = s.id
    WHERE sm.enabled = 1 AND s.enabled = 1
  `).all() as any[];

  return rows
    .filter((r: any) => normalizeModelName(r.model_id) === normalizedName)
    .map((r: any) => ({
      station: { id: r.id, name: r.name, baseUrl: r.base_url, apiKey: r.api_key, healthStatus: r.health_status },
      modelId: r.model_id,
    }));
}

// Auto-save conversation turn to memory store with improved summary and keywords
function autoSaveMemory(
  db: any,
  conversationId: string,
  messageId: string,
  role: 'user' | 'assistant',
  content: string,
  modelUsed: string
): void {
  try {
    const config = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as any;
    if (!config || !config.auto_save) return;

    const keywords = extractKeywords(content);
    const summary = generateSummary(content, role);
    const importance = calculateImportance(content, keywords);
    const tags = extractTags(content);
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO memory_entries (id, conversation_id, message_id, role, content, summary, keywords, tags, model_used, importance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, conversationId, messageId, role, content, summary, JSON.stringify(keywords), JSON.stringify(tags), modelUsed, importance, now, now);

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

// Retrieve relevant memories for context injection
function retrieveRelevantMemories(db: any, query: string, limit: number = 5): any[] {
  try {
    const config = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as any;
    if (!config || !config.context_injection) return [];

    const maxMemories = Math.min(limit, config.max_context_memories || 5);
    const keywords = extractKeywords(query);

    if (keywords.length === 0) {
      // Fallback: get most recent important memories
      return db.prepare(`
        SELECT summary, content, keywords, created_at, role
        FROM memory_entries
        WHERE summary IS NOT NULL AND summary != ''
        ORDER BY importance DESC, created_at DESC
        LIMIT ?
      `).all(maxMemories);
    }

    // Build LIKE conditions for each keyword
    const conditions = keywords.map(() => '(content LIKE ? OR keywords LIKE ? OR summary LIKE ?)').join(' OR ');
    const params: any[] = [];
    for (const kw of keywords) {
      params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`);
    }
    params.push(maxMemories);

    return db.prepare(`
      SELECT summary, content, keywords, created_at, role
      FROM memory_entries
      WHERE ${conditions}
      ORDER BY importance DESC, created_at DESC
      LIMIT ?
    `).all(...params);
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
