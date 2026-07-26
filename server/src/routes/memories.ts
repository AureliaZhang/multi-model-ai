import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { MemoryEntry, MemoryConfig, ApiResponse, AuthRequest } from '../types';
import type { MemoryEntryRow, MemoryTagRow, MemoryConfigRow } from '../dbRows';
import { generateEmbedding, serializeEmbedding, vectorSearch } from '../services/embeddings';
import { requireAuth, requireRole } from '../middleware/auth';
import { getErrorMessage, isAbortError } from '../utils/errors';
import { encryptSecret, decryptSecret } from '../utils/crypto';

const router = Router();

// All memory endpoints require a logged-in user. Each member sees/manages only
// their own memories (+ legacy rows with no owner); admins see everything.
router.use(requireAuth);

/**
 * Row-visibility scope for the caller.
 * - admin  → no restriction (sees all)
 * - others → own memories + legacy rows whose user_id is NULL
 * Returns fragments for appending to an existing WHERE (`and`), a standalone
 * WHERE (`whereOnly`), plus the bound params.
 */
function memScope(req: AuthRequest): { params: string[]; and: string; whereOnly: string } {
  const u = req.user;
  if (!u || u.role === 'admin') return { params: [], and: '', whereOnly: '' };
  return {
    params: [u.id],
    and: ' AND (user_id = ? OR user_id IS NULL)',
    whereOnly: 'WHERE (user_id = ? OR user_id IS NULL)',
  };
}

/** The userId to hand vectorSearch (undefined = admin, no scoping). */
function scopeUserId(req: AuthRequest): string | undefined {
  const u = req.user;
  return !u || u.role === 'admin' ? undefined : u.id;
}

// GET /api/memories - List memory entries (with pagination & filters), scoped to the caller
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const tag = req.query.tag as string;
    const conversationId = req.query.conversationId as string;

    let where = '1=1';
    const params: (string | number)[] = [];

    if (tag) {
      where += " AND tags LIKE ?";
      params.push(`%"${tag}"%`);
    }
    if (conversationId) {
      where += " AND conversation_id = ?";
      params.push(conversationId);
    }
    const scope = memScope(req);
    where += scope.and;
    params.push(...scope.params);

    const total = (db.prepare(`SELECT COUNT(*) as count FROM memory_entries WHERE ${where}`).get(...params) as { count: number }).count;
    const rows = db.prepare(`
      SELECT me.*, u.username as user_username
      FROM memory_entries me
      LEFT JOIN users u ON me.user_id = u.id
      WHERE ${where}
      ORDER BY me.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as MemoryEntryRow[];

    const entries = rows.map(rowToMemoryEntry);
    res.json({
      success: true,
      data: { entries, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/memories/search?q=keyword - Keyword search (scoped)
router.get('/search', (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }
    const db = getDb();
    const scope = memScope(req);
    const rows = db.prepare(`
      SELECT * FROM memory_entries
      WHERE (content LIKE ? OR keywords LIKE ? OR summary LIKE ?)${scope.and}
      ORDER BY created_at DESC LIMIT 50
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, ...scope.params) as MemoryEntryRow[];

    const entries = rows.map(rowToMemoryEntry);
    res.json({ success: true, data: entries } as ApiResponse<MemoryEntry[]>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/memories/search/semantic - Semantic search using vector embeddings (scoped)
router.post('/search/semantic', async (req: AuthRequest, res: Response) => {
  try {
    const { query, limit: limitParam } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }
    const db = getDb();
    const limit = limitParam || 10;
    const scope = memScope(req);

    // Try vector search first
    const embeddingCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM memory_entries WHERE embedding IS NOT NULL AND embedding != ''"
    ).get() as { cnt: number }).cnt;

    if (embeddingCount > 0) {
      try {
        const queryEmbedding = await generateEmbedding(query);
        const vectorResults = vectorSearch(db, queryEmbedding, limit, 0.15, scopeUserId(req));
        if (vectorResults.length > 0) {
          const entries = vectorResults.map((r) => ({
            id: r.id || '',
            conversationId: r.conversation_id || '',
            messageId: r.message_id || '',
            role: r.role as MemoryEntry['role'],
            content: r.content,
            summary: r.summary ?? undefined,
            keywords: typeof r.keywords === 'string' ? JSON.parse(r.keywords) : (r.keywords || []),
            tags: [],
            importance: r.importance || 0.5,
            createdAt: r.created_at,
            updatedAt: r.created_at,
          }));
          return res.json({ success: true, data: entries, method: 'vector' });
        }
      } catch (vecErr: unknown) {
        console.warn(`[memories] Vector search failed, falling back to keyword: ${getErrorMessage(vecErr)}`);
      }
    }

    // Fallback to keyword search (scoped)
    const rows = db.prepare(`
      SELECT * FROM memory_entries
      WHERE (content LIKE ? OR keywords LIKE ?)${scope.and}
      ORDER BY importance DESC, created_at DESC LIMIT ?
    `).all(`%${query}%`, `%${query}%`, ...scope.params, limit) as MemoryEntryRow[];

    const entries = rows.map(rowToMemoryEntry);
    res.json({ success: true, data: entries, method: 'keyword' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/memories/context?q=query&limit=5 - Retrieve relevant memories for context injection (scoped)
router.get('/context', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    const limitParam = parseInt(req.query.limit as string) || 5;
    const db = getDb();
    const scope = memScope(req);

    const config = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as MemoryConfigRow;
    const maxMemories = Math.min(limitParam, config?.max_context_memories || 5);

    let entries: MemoryEntry[] = [];

    if (q) {
      // Try vector search first
      const embeddingCount = (db.prepare(
        "SELECT COUNT(*) as cnt FROM memory_entries WHERE embedding IS NOT NULL AND embedding != ''"
      ).get() as { cnt: number }).cnt;

      if (embeddingCount > 0) {
        try {
          const queryEmbedding = await generateEmbedding(q);
          const vectorResults = vectorSearch(db, queryEmbedding, maxMemories, 0.15, scopeUserId(req));
          if (vectorResults.length > 0) {
            entries = vectorResults.map((r) => ({
              id: r.id || '',
              conversationId: r.conversation_id || '',
              messageId: r.message_id || '',
              role: r.role as MemoryEntry['role'],
              content: r.content,
              summary: r.summary ?? undefined,
              keywords: typeof r.keywords === 'string' ? JSON.parse(r.keywords) : (r.keywords || []),
              tags: [],
              importance: r.importance || 0.5,
              createdAt: r.created_at,
              updatedAt: r.created_at,
            }));
            return res.json({ success: true, data: entries, method: 'vector' });
          }
        } catch (vecErr: unknown) {
          console.warn(`[memories] Vector context search failed: ${getErrorMessage(vecErr)}`);
        }
      }

      // Fallback to keyword search (scoped)
      const rows = db.prepare(`
        SELECT * FROM memory_entries
        WHERE (content LIKE ? OR keywords LIKE ?)${scope.and}
        ORDER BY importance DESC, created_at DESC LIMIT ?
      `).all(`%${q}%`, `%${q}%`, ...scope.params, maxMemories) as MemoryEntryRow[];
      entries = rows.map(rowToMemoryEntry);
    } else {
      const rows = db.prepare(`
        SELECT * FROM memory_entries
        ${scope.whereOnly}
        ORDER BY importance DESC, created_at DESC LIMIT ?
      `).all(...scope.params, maxMemories) as MemoryEntryRow[];
      entries = rows.map(rowToMemoryEntry);
    }

    res.json({ success: true, data: entries } as ApiResponse<MemoryEntry[]>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/memories/tags - List all memory tags (global aggregate; low-sensitivity topic labels)
router.get('/tags', (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM memory_tags ORDER BY entry_count DESC').all() as MemoryTagRow[];
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/memories/config - Get memory configuration (instance-wide; any authed user may read)
router.get('/config', (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as MemoryConfigRow;

    // Count entries with and without embeddings
    const totalEntries = (db.prepare('SELECT COUNT(*) as cnt FROM memory_entries').get() as { cnt: number }).cnt;
    const embeddedEntries = (db.prepare(
      "SELECT COUNT(*) as cnt FROM memory_entries WHERE embedding IS NOT NULL AND embedding != ''"
    ).get() as { cnt: number }).cnt;

    const config: MemoryConfig & { embeddingStats?: { total: number; embedded: number } } = {
      autoSave: row.auto_save === 1,
      contextInjection: row.context_injection === 1,
      maxContextMemories: row.max_context_memories,
      historyMaxTurns: row.history_max_turns ?? 20,
      retentionDays: row.retention_days,
      semanticSearch: row.semantic_search === 1,
      autoSummarize: row.auto_summarize === 1,
      summarizeThreshold: row.summarize_threshold,
      embeddingApiBaseUrl: row.embedding_api_base_url || null,
      embeddingApiKey: row.embedding_api_key ? decryptSecret(row.embedding_api_key) : null,
      embeddingModel: row.embedding_model || null,
      embeddingStats: { total: totalEntries, embedded: embeddedEntries },
    };
    res.json({ success: true, data: config } as ApiResponse<MemoryConfig & { embeddingStats?: { total: number; embedded: number } }>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// PUT /api/memories/config - Update memory configuration (instance-wide → admin only)
router.put('/config', requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const updates = req.body as Partial<MemoryConfig>;
    const current = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as MemoryConfigRow;

    db.prepare(`
      UPDATE memory_config SET
        auto_save = ?, context_injection = ?, max_context_memories = ?,
        history_max_turns = ?, retention_days = ?, semantic_search = ?, auto_summarize = ?, summarize_threshold = ?,
        embedding_api_base_url = ?, embedding_api_key = ?, embedding_model = ?
      WHERE id = 1
    `).run(
      updates.autoSave !== undefined ? (updates.autoSave ? 1 : 0) : current.auto_save,
      updates.contextInjection !== undefined ? (updates.contextInjection ? 1 : 0) : current.context_injection,
      updates.maxContextMemories ?? current.max_context_memories,
      updates.historyMaxTurns !== undefined ? Math.max(0, Math.floor(updates.historyMaxTurns)) : current.history_max_turns,
      updates.retentionDays ?? current.retention_days,
      updates.semanticSearch !== undefined ? (updates.semanticSearch ? 1 : 0) : current.semantic_search,
      updates.autoSummarize !== undefined ? (updates.autoSummarize ? 1 : 0) : current.auto_summarize,
      updates.summarizeThreshold ?? current.summarize_threshold,
      updates.embeddingApiBaseUrl !== undefined ? updates.embeddingApiBaseUrl : current.embedding_api_base_url,
      updates.embeddingApiKey !== undefined
        ? (updates.embeddingApiKey ? encryptSecret(updates.embeddingApiKey) : updates.embeddingApiKey)
        : current.embedding_api_key,
      updates.embeddingModel !== undefined ? updates.embeddingModel : current.embedding_model
    );

    const updated = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as MemoryConfigRow;
    res.json({ success: true, data: rowToMemoryConfig(updated) } as ApiResponse<MemoryConfig>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/memories/fetch-embedding-models - Fetch embedding models from a base URL (admin only)
router.post('/fetch-embedding-models', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { baseUrl, apiKey } = req.body;
    if (!baseUrl || !apiKey) {
      return res.status(400).json({ success: false, error: 'baseUrl and apiKey are required' });
    }

    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const modelsUrl = `${cleanUrl}/models`;

    let response: { ok: boolean; status: number; json: () => Promise<unknown> };
    try {
      response = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch (fetchErr: unknown) {
      const hint = isAbortError(fetchErr)
        ? 'Request timed out. Check that the Base URL is correct and reachable.'
        : getErrorMessage(fetchErr);
      return res.status(502).json({ success: false, error: `Failed to connect: ${hint}` });
    }

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: `Server returned HTTP ${response.status}` });
    }

    const data = await response.json() as { data?: Array<{ id?: string; name?: string }> };
    const allModels = data.data || [];

    // Filter to only embedding-capable models
    const embeddingModels = allModels
      .filter((m) => {
        const id = (m.id || m.name || '').toLowerCase();
        return id.includes('embedding') || id.includes('embed');
      })
      .map((m) => ({ id: m.id || m.name, name: m.name || m.id }));

    res.json({ success: true, data: embeddingModels });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/memories/:id - Get a single memory entry (owner or admin only)
router.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM memory_entries WHERE id = ?').get(id) as MemoryEntryRow | undefined;
    if (!row || !canAccessRow(req, row)) {
      return res.status(404).json({ success: false, error: 'Memory entry not found' });
    }
    res.json({ success: true, data: rowToMemoryEntry(row) } as ApiResponse<MemoryEntry>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// DELETE /api/memories/:id - Delete a memory entry (owner or admin only)
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const scope = memScope(req);
    const result = db.prepare(`DELETE FROM memory_entries WHERE id = ?${scope.and}`).run(id, ...scope.params);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Memory entry not found' });
    }
    res.json({ success: true } as ApiResponse);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// DELETE /api/memories/conversation/:convId - Delete all of the caller's memories for a conversation
router.delete('/conversation/:convId', (req: AuthRequest, res: Response) => {
  try {
    const { convId } = req.params;
    const db = getDb();
    const scope = memScope(req);
    const result = db.prepare(`DELETE FROM memory_entries WHERE conversation_id = ?${scope.and}`).run(convId, ...scope.params);
    res.json({ success: true, data: { deleted: result.changes } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/memories/export - Export the caller's memories to JSON
router.post('/export', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const scope = memScope(req);
    const rows = db.prepare(`SELECT * FROM memory_entries ${scope.whereOnly} ORDER BY created_at DESC`).all(...scope.params) as MemoryEntryRow[];
    const entries = rows.map(rowToMemoryEntry);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=memories-export.json');
    res.json(entries);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/memories/import - Import memories from JSON (owned by the importing user)
router.post('/import', (req: AuthRequest, res: Response) => {
  try {
    const entries = req.body as Partial<MemoryEntry>[];
    if (!Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: 'Body must be an array of memory entries' });
    }
    const db = getDb();
    const ownerId = req.user?.id || null;
    const insert = db.prepare(`
      INSERT OR IGNORE INTO memory_entries (id, conversation_id, message_id, role, content, summary, keywords, tags, model_used, importance, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    for (const entry of entries) {
      try {
        insert.run(
          entry.id || uuidv4(),
          entry.conversationId || 'imported',
          entry.messageId || uuidv4(),
          entry.role || 'user',
          entry.content || '',
          entry.summary || null,
          JSON.stringify(entry.keywords || []),
          JSON.stringify(entry.tags || []),
          entry.modelUsed || null,
          entry.importance ?? 0.5,
          ownerId,
          entry.createdAt || new Date().toISOString(),
          entry.updatedAt || new Date().toISOString()
        );
        imported++;
      } catch {
        // Skip duplicates
      }
    }

    res.json({ success: true, data: { imported, total: entries.length } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/memories/backfill-embeddings - Generate embeddings for entries missing them (admin: instance maintenance)
router.post('/backfill-embeddings', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const batchSize = Math.min(req.body.batchSize || 10, 50); // Max 50 at a time

    // Find entries without embeddings
    const rows = db.prepare(`
      SELECT id, content FROM memory_entries
      WHERE embedding IS NULL OR embedding = ''
      ORDER BY created_at DESC
      LIMIT ?
    `).all(batchSize) as MemoryEntryRow[];

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: { processed: 0, total: 0, message: 'All entries already have embeddings' },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const embedding = await generateEmbedding(row.content);
        const embeddingJson = serializeEmbedding(embedding);
        db.prepare('UPDATE memory_entries SET embedding = ? WHERE id = ?')
          .run(embeddingJson, row.id);
        processed++;
      } catch (err: unknown) {
        console.warn(`[memories] Backfill embedding failed for ${row.id}: ${getErrorMessage(err)}`);
        failed++;
      }
    }

    // Count remaining entries without embeddings
    const remaining = (db.prepare(
      "SELECT COUNT(*) as cnt FROM memory_entries WHERE embedding IS NULL OR embedding = ''"
    ).get() as { cnt: number }).cnt;

    res.json({
      success: true,
      data: {
        processed,
        failed,
        batchSize: rows.length,
        remainingWithoutEmbeddings: remaining,
        message: remaining > 0
          ? `Processed ${processed}/${rows.length} entries. ${remaining} remaining.`
          : `All entries now have embeddings!`,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/memories/summarize/:convId - Generate summary for the caller's memories of a conversation
router.post('/summarize/:convId', (req: AuthRequest, res: Response) => {
  try {
    const { convId } = req.params;
    const db = getDb();
    const scope = memScope(req);
    const rows = db.prepare(
      `SELECT * FROM memory_entries WHERE conversation_id = ?${scope.and} ORDER BY created_at ASC`
    ).all(convId, ...scope.params) as MemoryEntryRow[];

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No memories found for this conversation' });
    }

    // Simple concatenation summary (LLM-based summarization can be added later)
    const summary = rows
      .map(r => `${r.role}: ${r.content.substring(0, 100)}`)
      .join('\n');

    // Update first entry with summary
    db.prepare('UPDATE memory_entries SET summary = ? WHERE id = ?')
      .run(summary, rows[0].id);

    res.json({ success: true, data: { summary, entriesSummarized: rows.length } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/** Can the caller see this row? admin → yes; else own or legacy (NULL owner). */
function canAccessRow(req: AuthRequest, row: MemoryEntryRow): boolean {
  const u = req.user;
  if (!u || u.role === 'admin') return true;
  return row.user_id === u.id || row.user_id == null;
}

// Helper: map DB row to MemoryEntry
function rowToMemoryEntry(row: MemoryEntryRow): MemoryEntry {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    role: row.role as MemoryEntry['role'],
    content: row.content,
    summary: row.summary || undefined,
    keywords: JSON.parse(row.keywords || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
    modelUsed: row.model_used || undefined,
    importance: row.importance,
    userId: row.user_id || null,
    username: row.user_username || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMemoryConfig(row: MemoryConfigRow): MemoryConfig {
  return {
    autoSave: row.auto_save === 1,
    contextInjection: row.context_injection === 1,
    maxContextMemories: row.max_context_memories,
    historyMaxTurns: row.history_max_turns ?? 20,
    retentionDays: row.retention_days,
    semanticSearch: row.semantic_search === 1,
    autoSummarize: row.auto_summarize === 1,
    summarizeThreshold: row.summarize_threshold,
    embeddingApiBaseUrl: row.embedding_api_base_url || null,
    embeddingApiKey: row.embedding_api_key ? decryptSecret(row.embedding_api_key) : null,
    embeddingModel: row.embedding_model || null,
  };
}

export default router;
