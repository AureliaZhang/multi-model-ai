import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { MemoryEntry, MemoryConfig, ApiResponse } from '../types';

const router = Router();

// GET /api/memories - List all memory entries (with pagination & filters)
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const tag = req.query.tag as string;
    const conversationId = req.query.conversationId as string;

    let where = '1=1';
    const params: any[] = [];

    if (tag) {
      where += " AND tags LIKE ?";
      params.push(`%"${tag}"%`);
    }
    if (conversationId) {
      where += " AND conversation_id = ?";
      params.push(conversationId);
    }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM memory_entries WHERE ${where}`).get(...params) as any).count;
    const rows = db.prepare(`SELECT * FROM memory_entries WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as any[];

    const entries = rows.map(rowToMemoryEntry);
    res.json({
      success: true,
      data: { entries, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/memories/search?q=keyword - Keyword search
router.get('/search', (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM memory_entries 
      WHERE content LIKE ? OR keywords LIKE ? OR summary LIKE ?
      ORDER BY created_at DESC LIMIT 50
    `).all(`%${q}%`, `%${q}%`, `%${q}%`) as any[];

    const entries = rows.map(rowToMemoryEntry);
    res.json({ success: true, data: entries } as ApiResponse<MemoryEntry[]>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/memories/search/semantic - Semantic search (placeholder - requires vector DB)
router.post('/search/semantic', (req: Request, res: Response) => {
  try {
    const { query, limit: limitParam } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }
    // Fallback to keyword search for now
    const db = getDb();
    const limit = limitParam || 10;
    const rows = db.prepare(`
      SELECT * FROM memory_entries 
      WHERE content LIKE ? OR keywords LIKE ?
      ORDER BY importance DESC, created_at DESC LIMIT ?
    `).all(`%${query}%`, `%${query}%`, limit) as any[];

    const entries = rows.map(rowToMemoryEntry);
    res.json({ success: true, data: entries } as ApiResponse<MemoryEntry[]>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/memories/context?q=query&limit=5 - Retrieve relevant memories for context injection
router.get('/context', (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const limitParam = parseInt(req.query.limit as string) || 5;
    const db = getDb();

    const config = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as any;
    const maxMemories = Math.min(limitParam, config?.max_context_memories || 5);

    let entries: MemoryEntry[] = [];
    if (q) {
      const rows = db.prepare(`
        SELECT * FROM memory_entries 
        WHERE content LIKE ? OR keywords LIKE ?
        ORDER BY importance DESC, created_at DESC LIMIT ?
      `).all(`%${q}%`, `%${q}%`, maxMemories) as any[];
      entries = rows.map(rowToMemoryEntry);
    } else {
      const rows = db.prepare(`
        SELECT * FROM memory_entries 
        ORDER BY importance DESC, created_at DESC LIMIT ?
      `).all(maxMemories) as any[];
      entries = rows.map(rowToMemoryEntry);
    }

    res.json({ success: true, data: entries } as ApiResponse<MemoryEntry[]>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/memories/tags - List all memory tags
router.get('/tags', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM memory_tags ORDER BY entry_count DESC').all() as any[];
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/memories/config - Get memory configuration
router.get('/config', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as any;
    const config: MemoryConfig = {
      autoSave: row.auto_save === 1,
      contextInjection: row.context_injection === 1,
      maxContextMemories: row.max_context_memories,
      retentionDays: row.retention_days,
      semanticSearch: row.semantic_search === 1,
      autoSummarize: row.auto_summarize === 1,
      summarizeThreshold: row.summarize_threshold,
    };
    res.json({ success: true, data: config } as ApiResponse<MemoryConfig>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/memories/config - Update memory configuration
router.put('/config', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const updates = req.body as Partial<MemoryConfig>;
    const current = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as any;

    db.prepare(`
      UPDATE memory_config SET
        auto_save = ?, context_injection = ?, max_context_memories = ?,
        retention_days = ?, semantic_search = ?, auto_summarize = ?, summarize_threshold = ?
      WHERE id = 1
    `).run(
      updates.autoSave !== undefined ? (updates.autoSave ? 1 : 0) : current.auto_save,
      updates.contextInjection !== undefined ? (updates.contextInjection ? 1 : 0) : current.context_injection,
      updates.maxContextMemories ?? current.max_context_memories,
      updates.retentionDays ?? current.retention_days,
      updates.semanticSearch !== undefined ? (updates.semanticSearch ? 1 : 0) : current.semantic_search,
      updates.autoSummarize !== undefined ? (updates.autoSummarize ? 1 : 0) : current.auto_summarize,
      updates.summarizeThreshold ?? current.summarize_threshold
    );

    const updated = db.prepare('SELECT * FROM memory_config WHERE id = 1').get() as any;
    const config: MemoryConfig = {
      autoSave: updated.auto_save === 1,
      contextInjection: updated.context_injection === 1,
      maxContextMemories: updated.max_context_memories,
      retentionDays: updated.retention_days,
      semanticSearch: updated.semantic_search === 1,
      autoSummarize: updated.auto_summarize === 1,
      summarizeThreshold: updated.summarize_threshold,
    };
    res.json({ success: true, data: config } as ApiResponse<MemoryConfig>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/memories/:id - Get a single memory entry
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM memory_entries WHERE id = ?').get(id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Memory entry not found' });
    }
    res.json({ success: true, data: rowToMemoryEntry(row) } as ApiResponse<MemoryEntry>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/memories/:id - Delete a memory entry
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const result = db.prepare('DELETE FROM memory_entries WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Memory entry not found' });
    }
    res.json({ success: true } as ApiResponse);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/memories/conversation/:convId - Delete all memories for a conversation
router.delete('/conversation/:convId', (req: Request, res: Response) => {
  try {
    const { convId } = req.params;
    const db = getDb();
    const result = db.prepare('DELETE FROM memory_entries WHERE conversation_id = ?').run(convId);
    res.json({ success: true, data: { deleted: result.changes } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/memories/export - Export all memories to JSON
router.post('/export', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM memory_entries ORDER BY created_at DESC').all() as any[];
    const entries = rows.map(rowToMemoryEntry);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=memories-export.json');
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/memories/import - Import memories from JSON
router.post('/import', (req: Request, res: Response) => {
  try {
    const entries = req.body as Partial<MemoryEntry>[];
    if (!Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: 'Body must be an array of memory entries' });
    }
    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO memory_entries (id, conversation_id, message_id, role, content, summary, keywords, tags, model_used, importance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          entry.createdAt || new Date().toISOString(),
          entry.updatedAt || new Date().toISOString()
        );
        imported++;
      } catch {
        // Skip duplicates
      }
    }

    res.json({ success: true, data: { imported, total: entries.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/memories/summarize/:convId - Generate summary for a conversation's memories
router.post('/summarize/:convId', (req: Request, res: Response) => {
  try {
    const { convId } = req.params;
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM memory_entries WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(convId) as any[];

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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: map DB row to MemoryEntry
function rowToMemoryEntry(row: any): MemoryEntry {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    role: row.role,
    content: row.content,
    summary: row.summary,
    keywords: JSON.parse(row.keywords || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
    modelUsed: row.model_used,
    importance: row.importance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
