import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { Conversation, ConversationVisibility, ApiResponse, AuthRequest, Message } from '../types';
import type { ConversationRow, MessageRow, ConversationImportItem } from '../dbRows';
import { optionalAuth } from '../middleware/auth';
import { getErrorMessage } from '../utils/errors';

const router = Router();

// Helper to map a DB row to Conversation type
function rowToConversation(r: ConversationRow): Conversation {
  return {
    id: r.id,
    title: r.title,
    modelNormalizedName: r.model_normalized_name,
    visibility: (r.visibility as ConversationVisibility) || 'public',
    selfReview: Boolean(r.self_review),
    userId: r.user_id || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role as Message['role'],
    content: r.content,
    modelUsed: r.model_used || undefined,
    createdAt: r.created_at,
  };
}

// GET /api/conversations - List conversations
// - Authenticated users see their own conversations (all visibility) + public conversations from others
// - Unauthenticated users see only public conversations
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user?.id;
    let rows: ConversationRow[];

    if (userId) {
      // Authenticated: own conversations (all visibility) + public from others
      rows = db.prepare(
        'SELECT * FROM conversations WHERE user_id = ? OR visibility = ? OR user_id IS NULL ORDER BY updated_at DESC'
      ).all(userId, 'public') as ConversationRow[];
    } else {
      // Guest: only public conversations
      rows = db.prepare(
        'SELECT * FROM conversations WHERE visibility = ? ORDER BY updated_at DESC'
      ).all('public') as ConversationRow[];
    }

    const conversations: Conversation[] = rows.map(rowToConversation);
    res.json({ success: true, data: conversations } as ApiResponse<Conversation[]>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/conversations - Create conversation
router.post('/', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { title, modelNormalizedName, visibility, selfReview } = req.body;
    if (!modelNormalizedName) {
      return res.status(400).json({ success: false, error: 'modelNormalizedName is required' });
    }
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const vis: ConversationVisibility = visibility === 'private' ? 'private' : 'public';
    const review = selfReview ? 1 : 0;
    const userId = req.user?.id || null;

    db.prepare(
      'INSERT INTO conversations (id, title, model_normalized_name, visibility, self_review, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, title || 'New Conversation', modelNormalizedName, vis, review, userId, now, now);

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow;
    res.status(201).json({
      success: true,
      data: rowToConversation(conv),
    } as ApiResponse<Conversation>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// PUT /api/conversations/:id - Update conversation
router.put('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, modelNormalizedName, visibility, selfReview } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const newTitle = title ?? existing.title;
    const newModel = modelNormalizedName ?? existing.model_normalized_name;
    const newVisibility = (visibility === 'public' || visibility === 'private') ? visibility : existing.visibility;
    const newSelfReview = selfReview !== undefined ? (selfReview ? 1 : 0) : existing.self_review;
    const now = new Date().toISOString();

    db.prepare('UPDATE conversations SET title = ?, model_normalized_name = ?, visibility = ?, self_review = ?, updated_at = ? WHERE id = ?')
      .run(newTitle, newModel, newVisibility, newSelfReview, now, id);

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow;
    res.json({
      success: true,
      data: rowToConversation(conv),
    } as ApiResponse<Conversation>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    res.json({ success: true } as ApiResponse);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/conversations/export - Export conversations (+ their messages) as JSON download
// Scope mirrors the list endpoint: authed users get their own (all visibility) + public;
// guests get public only. NOTE: attachments (images/files) are NOT included in v1 —
// they live in separate binary storage. TODO 待更新：如果将来要连附件一起导出/导入，
// 需要把 attachments 表 + 实际文件一起打包（见 framework §3.3 F-C04 / P1 backlog）。
router.get('/export', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user?.id;
    let convRows: ConversationRow[];

    if (userId) {
      convRows = db.prepare(
        'SELECT * FROM conversations WHERE user_id = ? OR visibility = ? OR user_id IS NULL ORDER BY updated_at DESC'
      ).all(userId, 'public') as ConversationRow[];
    } else {
      convRows = db.prepare(
        'SELECT * FROM conversations WHERE visibility = ? ORDER BY updated_at DESC'
      ).all('public') as ConversationRow[];
    }

    const msgStmt = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    );

    const conversations = convRows.map(c => ({
      ...rowToConversation(c),
      messages: (msgStmt.all(c.id) as MessageRow[]).map(r => ({
        id: r.id,
        role: r.role,
        content: r.content,
        modelUsed: r.model_used,
        createdAt: r.created_at,
      })),
    }));

    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      conversations,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=conversations-export.json');
    res.json(payload);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/conversations/import - Import conversations (+ messages) from an export file.
// Accepts either the wrapped { conversations: [...] } shape or a bare array.
// Uses INSERT OR IGNORE so re-importing the same file is a no-op (dedup by id).
router.post('/import', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as ConversationImportItem[] | { conversations?: ConversationImportItem[] } | null;
    const list: ConversationImportItem[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.conversations)
        ? body.conversations
        : [];

    if (list.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Body must be an array of conversations or an object with a "conversations" array',
      });
    }

    const db = getDb();
    const userId = req.user?.id || null;

    const insertConv = db.prepare(`
      INSERT OR IGNORE INTO conversations
        (id, title, model_normalized_name, visibility, self_review, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMsg = db.prepare(`
      INSERT OR IGNORE INTO messages
        (id, conversation_id, role, content, model_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let importedConvs = 0;
    let importedMsgs = 0;

    const runImport = db.transaction((items: ConversationImportItem[]) => {
      for (const c of items) {
        if (!c || !c.modelNormalizedName) continue; // skip malformed entries
        const convId = c.id || uuidv4();
        const now = new Date().toISOString();
        const vis = c.visibility === 'private' ? 'private' : 'public';
        const review = c.selfReview ? 1 : 0;

        const cr = insertConv.run(
          convId,
          c.title || 'Imported Conversation',
          c.modelNormalizedName,
          vis,
          review,
          userId,
          c.createdAt || now,
          c.updatedAt || now
        );
        if (cr.changes > 0) importedConvs++;

        const messages = Array.isArray(c.messages) ? c.messages : [];
        for (const m of messages) {
          if (!m || !m.role || m.content === undefined || m.content === null) continue;
          const mr = insertMsg.run(
            m.id || uuidv4(),
            convId,
            m.role,
            m.content,
            m.modelUsed || null,
            m.createdAt || now
          );
          if (mr.changes > 0) importedMsgs++;
        }
      }
    });

    runImport(list);

    res.json({
      success: true,
      data: { importedConversations: importedConvs, importedMessages: importedMsgs, total: list.length },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/conversations/:id/messages - Get messages
router.get('/:id/messages', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined;
    if (!conv) {
      console.warn('[getMessages] Conversation not found:', id);
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const rows = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(id) as MessageRow[];
    const messages = rows.map(rowToMessage);

    console.log(`[getMessages] conv=${id} messages=${messages.length}`);
    res.json({ success: true, data: messages } as ApiResponse);
  } catch (err: unknown) {
    console.error('[getMessages] Error:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
