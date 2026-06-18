import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { Conversation, Message, ApiResponse } from '../types';

const router = Router();

// GET /api/conversations - List conversations
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as any[];
    const conversations: Conversation[] = rows.map(r => ({
      id: r.id,
      title: r.title,
      modelNormalizedName: r.model_normalized_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json({ success: true, data: conversations } as ApiResponse<Conversation[]>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/conversations - Create conversation
router.post('/', (req: Request, res: Response) => {
  try {
    const { title, modelNormalizedName } = req.body;
    if (!modelNormalizedName) {
      return res.status(400).json({ success: false, error: 'modelNormalizedName is required' });
    }
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO conversations (id, title, model_normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, title || 'New Conversation', modelNormalizedName, now, now);

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    res.status(201).json({
      success: true,
      data: { id: conv.id, title: conv.title, modelNormalizedName: conv.model_normalized_name, createdAt: conv.created_at, updatedAt: conv.updated_at },
    } as ApiResponse<Conversation>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/conversations/:id - Update conversation
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, modelNormalizedName } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const newTitle = title ?? existing.title;
    const newModel = modelNormalizedName ?? existing.model_normalized_name;
    const now = new Date().toISOString();

    db.prepare('UPDATE conversations SET title = ?, model_normalized_name = ?, updated_at = ? WHERE id = ?')
      .run(newTitle, newModel, now, id);

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    res.json({
      success: true,
      data: { id: conv.id, title: conv.title, modelNormalizedName: conv.model_normalized_name, createdAt: conv.created_at, updatedAt: conv.updated_at },
    } as ApiResponse<Conversation>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/conversations/:id/messages - Get messages
router.get('/:id/messages', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const rows = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(id) as any[];
    const messages: Message[] = rows.map(r => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      modelUsed: r.model_used,
      createdAt: r.created_at,
    }));

    res.json({ success: true, data: messages } as ApiResponse<Message[]>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
