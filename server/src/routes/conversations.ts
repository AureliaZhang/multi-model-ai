import { Router, Response } from 'express';
import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { Conversation, ConversationVisibility, ApiResponse, AuthRequest, Message, Attachment } from '../types';
import type {
  ConversationRow,
  MessageRow,
  AttachmentRow,
  ConversationImportItem,
  AttachmentImportItem,
} from '../dbRows';
import { optionalAuth } from '../middleware/auth';
import { getErrorMessage } from '../utils/errors';

const router = Router();

/** Export schema version: 2 includes per-message attachments (data URLs). v1 still importable. */
const EXPORT_VERSION = 2;

// Helper to map a DB row to Conversation type
function rowToConversation(r: ConversationRow): Conversation {
  return {
    id: r.id,
    title: r.title,
    modelNormalizedName: r.model_normalized_name,
    visibility: (r.visibility as ConversationVisibility) || 'public',
    selfReview: Boolean(r.self_review),
    systemPrompt: r.system_prompt ?? null,
    userId: r.user_id || undefined,
    pinned: Boolean(r.pinned),
    folder: r.folder ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Compute the new column values for a conversation update (PUT). Pure — exported
 * for testing. Semantics per field: `undefined` = not sent → keep existing;
 * `folder`: string → set (trimmed; empty/whitespace → null = remove from
 * folder), null → remove from folder; `pinned`: any truthy/falsy → 1/0.
 */
export function computeConversationUpdate(
  existing: ConversationRow,
  body: {
    title?: unknown;
    modelNormalizedName?: unknown;
    visibility?: unknown;
    selfReview?: unknown;
    systemPrompt?: unknown;
    pinned?: unknown;
    folder?: unknown;
  }
): {
  title: string;
  model_normalized_name: string;
  visibility: string;
  self_review: number;
  system_prompt: string | null;
  pinned: number;
  folder: string | null;
} {
  const { title, modelNormalizedName, visibility, selfReview, systemPrompt, pinned, folder } = body;
  return {
    title: typeof title === 'string' ? title : existing.title,
    model_normalized_name: typeof modelNormalizedName === 'string' ? modelNormalizedName : existing.model_normalized_name,
    visibility: (visibility === 'public' || visibility === 'private') ? visibility : existing.visibility,
    self_review: selfReview !== undefined ? (selfReview ? 1 : 0) : existing.self_review,
    // undefined = not sent (keep existing); string/null = set or clear (empty → null)
    system_prompt: systemPrompt !== undefined
      ? (typeof systemPrompt === 'string' && systemPrompt.trim() ? systemPrompt : null)
      : existing.system_prompt,
    pinned: pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned,
    folder: folder !== undefined
      ? (typeof folder === 'string' && folder.trim() ? folder.trim() : null)
      : existing.folder,
  };
}

/** Read access: admin, owner, public conversations, or legacy ownerless rows. */
function canReadConv(req: AuthRequest, conv: ConversationRow): boolean {
  const u = req.user;
  if (u && (u.role === 'admin' || conv.user_id === u.id)) return true;
  return conv.visibility === 'public' || conv.user_id == null;
}

/** Mutate access: admin or the real owner only (legacy ownerless rows → admin only). */
function canModifyConv(req: AuthRequest, conv: ConversationRow): boolean {
  const u = req.user;
  if (!u) return false;
  return u.role === 'admin' || (conv.user_id != null && conv.user_id === u.id);
}

function rowToAttachment(r: AttachmentRow): Attachment {
  return {
    id: r.id,
    messageId: r.message_id,
    type: (r.type === 'image' ? 'image' : 'file') as Attachment['type'],
    filename: r.filename,
    mimeType: r.mime_type,
    url: r.url,
  };
}

function rowToMessage(r: MessageRow, attachments?: Attachment[]): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role as Message['role'],
    content: r.content,
    modelUsed: r.model_used || undefined,
    createdAt: r.created_at,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
  };
}

function loadAttachmentsForMessages(messageIds: string[]): Map<string, Attachment[]> {
  const map = new Map<string, Attachment[]>();
  if (messageIds.length === 0) return map;
  const db = getDb();
  // Chunk IN clauses to stay under SQLite variable limits on large exports
  const CHUNK = 400;
  for (let i = 0; i < messageIds.length; i += CHUNK) {
    const slice = messageIds.slice(i, i + CHUNK);
    const placeholders = slice.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT id, message_id, type, filename, mime_type, url FROM attachments WHERE message_id IN (${placeholders})`
      )
      .all(...slice) as AttachmentRow[];
    for (const r of rows) {
      const list = map.get(r.message_id) || [];
      list.push(rowToAttachment(r));
      map.set(r.message_id, list);
    }
  }
  return map;
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
      // Authenticated: own conversations (all visibility) + public from others.
      // Pinned first, then most-recent (the sidebar renders in this order).
      rows = db.prepare(
        'SELECT * FROM conversations WHERE user_id = ? OR visibility = ? OR user_id IS NULL ORDER BY pinned DESC, updated_at DESC'
      ).all(userId, 'public') as ConversationRow[];
    } else {
      // Guest: only public conversations
      rows = db.prepare(
        'SELECT * FROM conversations WHERE visibility = ? ORDER BY pinned DESC, updated_at DESC'
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
    const { title, modelNormalizedName, visibility, selfReview, systemPrompt } = req.body;
    if (!modelNormalizedName) {
      return res.status(400).json({ success: false, error: 'modelNormalizedName is required' });
    }
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    // Team default (v0.7.58, §10.9 P0 #1): PRIVATE unless explicitly public —
    // sharing with the team is the deliberate act, not the accident.
    const vis: ConversationVisibility = visibility === 'public' ? 'public' : 'private';
    const review = selfReview ? 1 : 0;
    const sysPrompt = typeof systemPrompt === 'string' && systemPrompt.trim() ? systemPrompt : null;
    const userId = req.user?.id || null;

    db.prepare(
      'INSERT INTO conversations (id, title, model_normalized_name, visibility, self_review, system_prompt, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, title || 'New Conversation', modelNormalizedName, vis, review, sysPrompt, userId, now, now);

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
    const db = getDb();

    const existing = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    if (!canModifyConv(req, existing)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to modify this conversation' });
    }

    const next = computeConversationUpdate(existing, req.body ?? {});
    const now = new Date().toISOString();

    db.prepare('UPDATE conversations SET title = ?, model_normalized_name = ?, visibility = ?, self_review = ?, system_prompt = ?, pinned = ?, folder = ?, updated_at = ? WHERE id = ?')
      .run(next.title, next.model_normalized_name, next.visibility, next.self_review, next.system_prompt, next.pinned, next.folder, now, id);

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow;
    res.json({
      success: true,
      data: rowToConversation(conv),
    } as ApiResponse<Conversation>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// DELETE /api/conversations/:id - Delete conversation (owner or admin only)
router.delete('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    if (!canModifyConv(req, existing)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to delete this conversation' });
    }
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    res.json({ success: true } as ApiResponse);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * Delete `messageId` and every message inserted after it in the conversation
 * (attachments cascade via FK). Uses `rowid` — monotonic with insert order — so
 * truncation is exact regardless of `created_at` ties. Exported for testing.
 * Returns `{ found: false }` when the message isn't in the conversation.
 */
export function truncateMessagesFrom(
  db: Database.Database,
  conversationId: string,
  messageId: string
): { found: boolean; deleted: number } {
  const target = db
    .prepare('SELECT rowid AS rid FROM messages WHERE id = ? AND conversation_id = ?')
    .get(messageId, conversationId) as { rid: number } | undefined;
  if (!target) return { found: false, deleted: 0 };
  const info = db
    .prepare('DELETE FROM messages WHERE conversation_id = ? AND rowid >= ?')
    .run(conversationId, target.rid);
  return { found: true, deleted: info.changes };
}

// POST /api/conversations/:id/truncate  { messageId }
router.post('/:id/truncate', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { messageId } = req.body as { messageId?: string };
    if (!messageId) {
      return res.status(400).json({ success: false, error: 'messageId is required' });
    }
    const db = getDb();
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined;
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    const u = req.user;
    if (conv.user_id != null && !(u && (u.role === 'admin' || u.id === conv.user_id))) {
      return res.status(403).json({ success: false, error: 'You do not have permission to modify this conversation' });
    }

    const result = truncateMessagesFrom(db, id, messageId);
    if (!result.found) {
      return res.status(404).json({ success: false, error: 'Message not found in this conversation' });
    }
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(id);

    res.json({ success: true, data: { deleted: result.deleted } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * Search a user's in-scope conversations by title OR any message content.
 * Scope mirrors the list endpoint (authed: own all-visibility + public + legacy
 * ownerless; guest: public only). LIKE wildcards in `q` are escaped. Exported
 * for testing.
 */
export function searchConversations(
  db: Database.Database,
  userId: string | undefined,
  q: string,
  limit = 50
): ConversationRow[] {
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const match = `(c.title LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.content LIKE ? ESCAPE '\\'))`;
  if (userId) {
    return db.prepare(
      `SELECT c.* FROM conversations c
       WHERE (c.user_id = ? OR c.visibility = 'public' OR c.user_id IS NULL) AND ${match}
       ORDER BY c.updated_at DESC LIMIT ?`
    ).all(userId, like, like, limit) as ConversationRow[];
  }
  return db.prepare(
    `SELECT c.* FROM conversations c
     WHERE c.visibility = 'public' AND ${match}
     ORDER BY c.updated_at DESC LIMIT ?`
  ).all(like, like, limit) as ConversationRow[];
}

// GET /api/conversations/search?q= - Search in-scope conversations by title + message content
router.get('/search', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      return res.json({ success: true, data: [] } as ApiResponse<Conversation[]>);
    }
    const db = getDb();
    const rows = searchConversations(db, req.user?.id, q);
    res.json({ success: true, data: rows.map(rowToConversation) } as ApiResponse<Conversation[]>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/conversations/export - Export conversations (+ messages + attachments) as JSON download
// Scope mirrors the list endpoint: authed users get their own (all visibility) + public;
// guests get public only.
// version 2 embeds attachment rows (url is typically a data: base64 URL stored in SQLite).
// version 1 files (no attachments field) remain importable.
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

    // Load all message rows first so we can batch-fetch attachments once.
    const convMessages: { conv: ConversationRow; messages: MessageRow[] }[] = convRows.map((c) => ({
      conv: c,
      messages: msgStmt.all(c.id) as MessageRow[],
    }));
    const allMsgIds = convMessages.flatMap((cm) => cm.messages.map((m) => m.id));
    const attMap = loadAttachmentsForMessages(allMsgIds);

    const conversations = convMessages.map(({ conv, messages }) => ({
      ...rowToConversation(conv),
      messages: messages.map((r) => {
        const atts = attMap.get(r.id) || [];
        return {
          id: r.id,
          role: r.role,
          content: r.content,
          modelUsed: r.model_used,
          createdAt: r.created_at,
          attachments: atts.map((a) => ({
            id: a.id,
            type: a.type,
            filename: a.filename,
            mimeType: a.mimeType,
            url: a.url,
          })),
        };
      }),
    }));

    const payload = {
      exportedAt: new Date().toISOString(),
      version: EXPORT_VERSION,
      conversations,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=conversations-export.json');
    res.json(payload);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/conversations/import - Import conversations (+ messages + optional attachments).
// Accepts either the wrapped { conversations: [...] } shape or a bare array.
// Uses INSERT OR IGNORE so re-importing the same file is a no-op (dedup by id).
// Compatible with export version 1 (no attachments) and version 2 (with attachments).
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
        (id, title, model_normalized_name, visibility, self_review, system_prompt, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMsg = db.prepare(`
      INSERT OR IGNORE INTO messages
        (id, conversation_id, role, content, model_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertAtt = db.prepare(`
      INSERT OR IGNORE INTO attachments
        (id, message_id, type, filename, mime_type, url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let importedConvs = 0;
    let importedMsgs = 0;
    let importedAtts = 0;

    const runImport = db.transaction((items: ConversationImportItem[]) => {
      for (const c of items) {
        if (!c || !c.modelNormalizedName) continue; // skip malformed entries
        const convId = c.id || uuidv4();
        const now = new Date().toISOString();
        const vis = c.visibility === 'public' ? 'public' : 'private'; // default-private (v0.7.58)
        const review = c.selfReview ? 1 : 0;
        const sysPrompt = typeof c.systemPrompt === 'string' && c.systemPrompt.trim() ? c.systemPrompt : null;

        const cr = insertConv.run(
          convId,
          c.title || 'Imported Conversation',
          c.modelNormalizedName,
          vis,
          review,
          sysPrompt,
          userId,
          c.createdAt || now,
          c.updatedAt || now
        );
        if (cr.changes > 0) importedConvs++;

        const messages = Array.isArray(c.messages) ? c.messages : [];
        for (const m of messages) {
          if (!m || !m.role || m.content === undefined || m.content === null) continue;
          const msgId = m.id || uuidv4();
          const mr = insertMsg.run(
            msgId,
            convId,
            m.role,
            m.content,
            m.modelUsed || null,
            m.createdAt || now
          );
          if (mr.changes > 0) importedMsgs++;

          const atts: AttachmentImportItem[] = Array.isArray(m.attachments) ? m.attachments : [];
          for (const a of atts) {
            if (!a || !a.url || !a.filename) continue;
            const attType = a.type === 'image' ? 'image' : 'file';
            const ar = insertAtt.run(
              a.id || uuidv4(),
              msgId,
              attType,
              a.filename,
              a.mimeType || (attType === 'image' ? 'image/png' : 'application/octet-stream'),
              a.url
            );
            if (ar.changes > 0) importedAtts++;
          }
        }
      }
    });

    runImport(list);

    res.json({
      success: true,
      data: {
        importedConversations: importedConvs,
        importedMessages: importedMsgs,
        importedAttachments: importedAtts,
        total: list.length,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/conversations/:id/messages - Get messages (with attachments); read access enforced
router.get('/:id/messages', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined;
    if (!conv) {
      console.warn('[getMessages] Conversation not found:', id);
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    if (!canReadConv(req, conv)) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const rows = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(id) as MessageRow[];
    const attMap = loadAttachmentsForMessages(rows.map((r) => r.id));
    const messages = rows.map((r) => rowToMessage(r, attMap.get(r.id)));

    console.log(`[getMessages] conv=${id} messages=${messages.length}`);
    res.json({ success: true, data: messages } as ApiResponse);
  } catch (err: unknown) {
    console.error('[getMessages] Error:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
