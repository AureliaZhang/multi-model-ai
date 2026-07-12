/**
 * §10.6 Collaborative group chat + shared Group AI.
 *
 * Two tracks per room:
 *   - Left  : human social messages (room_messages). AI NEVER reads these.
 *   - Right : shared Group AI thread (room_ai_messages). Only these go to the model.
 *
 * Concurrency: per-room single AI task. Lock is per roomId only, so different
 * rooms (and private chats) run in parallel. State machine on rooms.ai_state:
 *   idle -> occupying_input -> ai_running -> idle
 *
 * This file covers P0 (rooms/members/messages CRUD + occupancy) and P1
 * (@AI delivery + reply via shared invokeModel). Realtime (WS) is layered
 * on top later; clients may poll GET endpoints in the meantime.
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { requireAuth } from '../middleware/auth';
import { invokeModel } from '../services/modelInvocation';
import { logApiUsage } from '../services/usageLog';
import type { AuthRequest, ApiResponse } from '../types';

const router = Router();
router.use(requireAuth);

const OCCUPANCY_MS = 2 * 60 * 1000; // 2 minutes per @AI cycle (§10.6.4)
const MODEL_COOLDOWN_MS = 5 * 60 * 1000; // shared 5-min model change cooldown (§10.6.8)
const DEFAULT_CAP = 10;

// ---------- helpers ----------

function nowIso(): string {
  return new Date().toISOString();
}

function isMember(roomId: string, userId: string): { role: string } | null {
  const db = getDb();
  const row = db
    .prepare('SELECT role FROM room_members WHERE room_id = ? AND user_id = ?')
    .get(roomId, userId) as { role: string } | undefined;
  return row || null;
}

function getRoom(roomId: string): any {
  return getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
}

/** Auto-release a stale input lock so the room never gets stuck. */
function reconcileOccupancy(room: any): any {
  if (room.ai_state === 'occupying_input' && room.occupancy_until) {
    if (new Date(room.occupancy_until).getTime() < Date.now()) {
      getDb()
        .prepare(
          `UPDATE rooms SET ai_state = 'idle', occupant_user_id = NULL, occupancy_until = NULL, updated_at = ? WHERE id = ?`
        )
        .run(nowIso(), room.id);
      return getRoom(room.id);
    }
  }
  return room;
}

function memberInfo(roomId: string): { userId: string; role: string; username: string; displayName: string | null }[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT m.user_id as userId, m.role, u.username, u.display_name as displayName
       FROM room_members m JOIN users u ON u.id = m.user_id
       WHERE m.room_id = ? ORDER BY m.role = 'owner' DESC, m.joined_at ASC`
    )
    .all(roomId) as any[];
}

function serializeRoom(room: any): any {
  return {
    id: room.id,
    name: room.name,
    ownerId: room.owner_id,
    memberCap: room.member_cap,
    chatModel: room.chat_model,
    imageModel: room.image_model,
    ttsModel: room.tts_model,
    modelLockedUntil: room.model_locked_until,
    aiState: room.ai_state,
    occupantUserId: room.occupant_user_id,
    occupancyUntil: room.occupancy_until,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
  };
}

// ---------- rooms ----------

/** GET /api/rooms — rooms the current user belongs to */
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT r.*, (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) as memberCount
         FROM rooms r
         JOIN room_members mm ON mm.room_id = r.id
         WHERE mm.user_id = ?
         ORDER BY r.updated_at DESC`
      )
      .all(req.user!.id) as any[];
    const data = rows.map((r) => ({ ...serializeRoom(r), memberCount: r.memberCount }));
    res.json({ success: true, data } as ApiResponse);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/rooms — create a group.
 * body: { name, memberUserIds: string[] }  (owner + >= 1 other = min 2 members)
 */
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { name, memberUserIds } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    const others: string[] = Array.isArray(memberUserIds)
      ? [...new Set(memberUserIds.filter((x: string) => x && x !== req.user!.id))]
      : [];
    if (others.length < 1) {
      return res.status(400).json({ success: false, error: 'A group needs at least 2 members (owner + 1)' });
    }

    const db = getDb();
    // Validate invitees exist & are active
    const valid = db
      .prepare(`SELECT id FROM users WHERE id IN (${others.map(() => '?').join(',')}) AND is_active = 1`)
      .all(...others) as { id: string }[];
    const validIds = valid.map((v) => v.id);
    if (validIds.length < 1) {
      return res.status(400).json({ success: false, error: 'No valid members to invite' });
    }
    if (1 + validIds.length > DEFAULT_CAP) {
      return res.status(400).json({ success: false, error: `Member cap is ${DEFAULT_CAP}. Ask a platform admin to raise it.` });
    }

    const roomId = uuidv4();
    const now = nowIso();
    db.prepare(
      `INSERT INTO rooms (id, name, owner_id, member_cap, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(roomId, String(name).trim(), req.user!.id, DEFAULT_CAP, now, now);

    const addMember = db.prepare(
      `INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`
    );
    addMember.run(roomId, req.user!.id, 'owner', now);
    for (const uid of validIds) addMember.run(roomId, uid, 'member', now);

    res.status(201).json({ success: true, data: { ...serializeRoom(getRoom(roomId)), members: memberInfo(roomId) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/rooms/:id — room detail + members (members only) */
router.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    let room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    room = reconcileOccupancy(room);
    res.json({ success: true, data: { ...serializeRoom(room), members: memberInfo(room.id) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** DELETE /api/rooms/:id — disband (owner only) */
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (room.owner_id !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Only the group owner can disband' });
    }
    getDb().prepare('DELETE FROM rooms WHERE id = ?').run(room.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/rooms/:id/members — invite (owner only). body: { userIds: string[] } */
router.post('/:id/members', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (room.owner_id !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Only the group owner can invite' });
    }
    const { userIds } = req.body || {};
    const ids: string[] = Array.isArray(userIds) ? [...new Set(userIds.filter(Boolean))] : [];
    if (ids.length === 0) return res.status(400).json({ success: false, error: 'userIds required' });

    const db = getDb();
    const current = (db.prepare('SELECT COUNT(*) as n FROM room_members WHERE room_id = ?').get(room.id) as any).n;
    const valid = db
      .prepare(`SELECT id FROM users WHERE id IN (${ids.map(() => '?').join(',')}) AND is_active = 1`)
      .all(...ids) as { id: string }[];
    if (current + valid.length > room.member_cap) {
      return res.status(400).json({ success: false, error: `Member cap is ${room.member_cap}. Ask a platform admin to raise it.` });
    }
    const add = db.prepare(`INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`);
    for (const v of valid) add.run(room.id, v.id, nowIso());
    db.prepare('UPDATE rooms SET updated_at = ? WHERE id = ?').run(nowIso(), room.id);
    res.json({ success: true, data: memberInfo(room.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** DELETE /api/rooms/:id/members/:userId — kick (owner only; owner cannot be kicked) */
router.delete('/:id/members/:userId', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (room.owner_id !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Only the group owner can kick' });
    }
    if (req.params.userId === room.owner_id) {
      return res.status(400).json({ success: false, error: 'Owner cannot be removed; disband instead' });
    }
    getDb().prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(room.id, req.params.userId);
    res.json({ success: true, data: memberInfo(room.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- left track: human messages ----------

/** GET /api/rooms/:id/messages — full human history (members) */
router.get('/:id/messages', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    const rows = getDb()
      .prepare(
        `SELECT m.id, m.user_id as userId, u.username, u.display_name as displayName,
                m.kind, m.content, m.ai_message_id as aiMessageId, m.attachments_json as attachmentsJson,
                m.created_at as createdAt
         FROM room_messages m LEFT JOIN users u ON u.id = m.user_id
         WHERE m.room_id = ? ORDER BY m.created_at ASC`
      )
      .all(room.id) as any[];
    const data = rows.map((r) => ({
      ...r,
      attachments: JSON.parse(r.attachmentsJson || '[]'),
      attachmentsJson: undefined,
    }));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/rooms/:id/messages — send a human message. body: { content, attachments? } */
router.post('/:id/messages', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    const { content, attachments } = req.body || {};
    const text = String(content || '').trim();
    const atts = Array.isArray(attachments) ? attachments : [];
    if (!text && atts.length === 0) {
      return res.status(400).json({ success: false, error: 'Empty message' });
    }
    const db = getDb();
    const id = uuidv4();
    const now = nowIso();
    db.prepare(
      `INSERT INTO room_messages (id, room_id, user_id, kind, content, attachments_json, created_at)
       VALUES (?, ?, ?, 'text', ?, ?, ?)`
    ).run(id, room.id, req.user!.id, text, JSON.stringify(atts), now);
    db.prepare('UPDATE rooms SET updated_at = ? WHERE id = ?').run(now, room.id);
    res.status(201).json({
      success: true,
      data: {
        id,
        userId: req.user!.id,
        username: req.user!.username,
        kind: 'text',
        content: text,
        attachments: atts,
        createdAt: now,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- right track: shared Group AI ----------

/** GET /api/rooms/:id/ai — full AI thread (members) */
router.get('/:id/ai', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    const rows = getDb()
      .prepare(
        `SELECT id, role, content, author_id as authorId, author_name as authorName,
                status, error_message as errorMessage, model_used as modelUsed,
                file_ids_json as fileIdsJson, created_at as createdAt
         FROM room_ai_messages WHERE room_id = ? ORDER BY created_at ASC`
      )
      .all(room.id) as any[];
    const data = rows.map((r) => ({ ...r, fileIds: JSON.parse(r.fileIdsJson || '[]'), fileIdsJson: undefined }));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- group model preferences (§10.6.8) ----------

/**
 * PUT /api/rooms/:id/models — set group chat/image/tts model.
 * Any member may change; shared 5-minute cooldown for the whole group.
 * body: { chatModel?, imageModel?, ttsModel? }
 */
router.put('/:id/models', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    if (room.model_locked_until && new Date(room.model_locked_until).getTime() > Date.now()) {
      const secs = Math.ceil((new Date(room.model_locked_until).getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        error: `Group model was changed recently. Try again in ${secs}s.`,
        data: { lockedUntil: room.model_locked_until },
      });
    }
    const { chatModel, imageModel, ttsModel } = req.body || {};
    const lockedUntil = new Date(Date.now() + MODEL_COOLDOWN_MS).toISOString();
    getDb()
      .prepare(
        `UPDATE rooms SET
           chat_model = COALESCE(?, chat_model),
           image_model = COALESCE(?, image_model),
           tts_model = COALESCE(?, tts_model),
           model_locked_until = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        chatModel !== undefined ? chatModel : null,
        imageModel !== undefined ? imageModel : null,
        ttsModel !== undefined ? ttsModel : null,
        lockedUntil,
        nowIso(),
        room.id
      );
    res.json({ success: true, data: serializeRoom(getRoom(room.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- occupancy (@AI input lock) ----------

/** POST /api/rooms/:id/occupancy/claim — grab the @AI input lock */
router.post('/:id/occupancy/claim', (req: AuthRequest, res: Response) => {
  try {
    let room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    room = reconcileOccupancy(room);
    if (room.ai_state === 'ai_running') {
      return res.status(409).json({ success: false, error: 'AI is replying; wait until it finishes' });
    }
    if (room.ai_state === 'occupying_input' && room.occupant_user_id !== req.user!.id) {
      return res.status(409).json({ success: false, error: 'Someone else is composing an @AI message' });
    }
    const until = new Date(Date.now() + OCCUPANCY_MS).toISOString();
    getDb()
      .prepare(
        `UPDATE rooms SET ai_state = 'occupying_input', occupant_user_id = ?, occupancy_until = ?, updated_at = ? WHERE id = ?`
      )
      .run(req.user!.id, until, nowIso(), room.id);
    res.json({ success: true, data: serializeRoom(getRoom(room.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/rooms/:id/occupancy/renew — occupant adds +2 minutes */
router.post('/:id/occupancy/renew', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (room.ai_state !== 'occupying_input' || room.occupant_user_id !== req.user!.id) {
      return res.status(409).json({ success: false, error: 'You do not hold the @AI lock' });
    }
    const until = new Date(Date.now() + OCCUPANCY_MS).toISOString();
    getDb().prepare('UPDATE rooms SET occupancy_until = ?, updated_at = ? WHERE id = ?').run(until, nowIso(), room.id);
    res.json({ success: true, data: serializeRoom(getRoom(room.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/rooms/:id/occupancy/release — occupant gives up the lock */
router.post('/:id/occupancy/release', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (room.ai_state === 'occupying_input' && room.occupant_user_id === req.user!.id) {
      getDb()
        .prepare(
          `UPDATE rooms SET ai_state = 'idle', occupant_user_id = NULL, occupancy_until = NULL, updated_at = ? WHERE id = ?`
        )
        .run(nowIso(), room.id);
    }
    res.json({ success: true, data: serializeRoom(getRoom(room.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- @AI delivery + reply ----------

/**
 * POST /api/rooms/:id/ai/ask
 * body: { content, fileIds?: string[] }
 * Requires the caller to hold the input lock. Transitions occupying_input -> ai_running,
 * appends the delivery to the right track + a stub to the left track, calls the model,
 * then returns to idle. Per-room single task enforced by ai_state.
 */
router.post('/:id/ai/ask', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  let room = getRoom(req.params.id);
  try {
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    room = reconcileOccupancy(room);
    if (room.ai_state === 'ai_running') {
      return res.status(409).json({ success: false, error: 'AI is already working on a task' });
    }
    // Must hold the input lock (or room idle and we grab it atomically)
    if (room.ai_state === 'occupying_input' && room.occupant_user_id !== req.user!.id) {
      return res.status(409).json({ success: false, error: 'Someone else holds the @AI lock' });
    }

    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ success: false, error: 'content is required' });
    const fileIds: string[] = Array.isArray(req.body?.fileIds) ? req.body.fileIds : [];

    const chatModel = room.chat_model;
    if (!chatModel) {
      return res.status(400).json({ success: false, error: 'Group has no chat model set. Pick one in group settings.' });
    }

    // Transition to ai_running (locks the whole group)
    db.prepare(
      `UPDATE rooms SET ai_state = 'ai_running', occupant_user_id = NULL, occupancy_until = NULL, updated_at = ? WHERE id = ?`
    ).run(nowIso(), room.id);

    const now = nowIso();
    const userMsgId = uuidv4();
    db.prepare(
      `INSERT INTO room_ai_messages (id, room_id, role, content, author_id, author_name, status, file_ids_json, created_at)
       VALUES (?, ?, 'user', ?, ?, ?, 'done', ?, ?)`
    ).run(userMsgId, room.id, content, req.user!.id, req.user!.displayName || req.user!.username, JSON.stringify(fileIds), now);

    // Assistant placeholder (thinking)
    const asstId = uuidv4();
    db.prepare(
      `INSERT INTO room_ai_messages (id, room_id, role, content, status, created_at)
       VALUES (?, ?, 'assistant', '', 'thinking', ?)`
    ).run(asstId, room.id, nowIso());

    // Left-track stub so humans see "X asked AI ..." (no long answer on the left)
    const stubText = content.length > 60 ? content.slice(0, 60) + '…' : content;
    db.prepare(
      `INSERT INTO room_messages (id, room_id, user_id, kind, content, ai_message_id, created_at)
       VALUES (?, ?, ?, 'ai_stub', ?, ?, ?)`
    ).run(uuidv4(), room.id, req.user!.id, stubText, asstId, nowIso());

    // Build the model context from the RIGHT track only (AI never sees left chat).
    const history = db
      .prepare(
        `SELECT role, content FROM room_ai_messages
         WHERE room_id = ? AND status IN ('done') AND id != ? ORDER BY created_at ASC`
      )
      .all(room.id, asstId) as { role: string; content: string }[];

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

    // Group KB files referenced by this delivery (separate read path, §10.6.7)
    if (fileIds.length > 0) {
      const placeholders = fileIds.map(() => '?').join(',');
      const files = db
        .prepare(`SELECT original_name, content FROM room_files WHERE room_id = ? AND id IN (${placeholders})`)
        .all(room.id, ...fileIds) as { original_name: string; content: string | null }[];
      const blocks = files
        .filter((f) => f.content)
        .map((f) => `# ${f.original_name}\n${String(f.content).slice(0, 8000)}`);
      if (blocks.length > 0) {
        messages.push({
          role: 'system',
          content: `Reference files from the group knowledge base:\n\n${blocks.join('\n\n---\n\n')}`,
        });
      }
    }

    for (const h of history) {
      if (h.role === 'user' || h.role === 'assistant' || h.role === 'system') {
        messages.push({ role: h.role as any, content: h.content });
      }
    }
    messages.push({ role: 'user', content });

    // Call the model (non-streaming; reuse shared invoker). Uses group model prefs.
    const result = await invokeModel({ modelNormalizedName: chatModel, messages });

    if (result.ok) {
      db.prepare(
        `UPDATE room_ai_messages SET content = ?, status = 'done', model_used = ?, created_at = created_at WHERE id = ?`
      ).run(result.content, result.modelUsed, asstId);
      logApiUsage({
        userId: req.user!.id,
        username: req.user!.username,
        role: req.user!.role,
        kind: 'chat',
        modelNormalized: chatModel,
        modelUsed: result.modelUsed,
        stationId: result.stationId,
        stationName: result.stationName,
        status: 'ok',
        completionTokens: Math.ceil((result.content || '').length / 4),
        latencyMs: result.latencyMs,
      });
    } else {
      db.prepare(`UPDATE room_ai_messages SET status = 'error', error_message = ? WHERE id = ?`).run(result.error, asstId);
      logApiUsage({
        userId: req.user!.id,
        username: req.user!.username,
        role: req.user!.role,
        kind: 'chat',
        modelNormalized: chatModel,
        status: 'error',
        errorMessage: result.error,
        latencyMs: result.latencyMs,
      });
    }

    // Back to idle — next @AI allowed only now (§10.6.4 / §10.6.5)
    db.prepare(`UPDATE rooms SET ai_state = 'idle', updated_at = ? WHERE id = ?`).run(nowIso(), room.id);

    const asst = db
      .prepare(
        `SELECT id, role, content, status, error_message as errorMessage, model_used as modelUsed, created_at as createdAt
         FROM room_ai_messages WHERE id = ?`
      )
      .get(asstId);
    res.json({ success: true, data: { userMessageId: userMsgId, assistant: asst } });
  } catch (err: any) {
    // Best-effort unlock so the room never stays stuck in ai_running
    try {
      if (room) db.prepare(`UPDATE rooms SET ai_state = 'idle', updated_at = ? WHERE id = ?`).run(nowIso(), room.id);
    } catch {
      /* ignore */
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- helper: list users for the invite picker ----------

/**
 * GET /api/rooms/util/users — minimal user list for the invite picker.
 * Any authenticated user may list (needed to build a group). Returns only
 * id / username / displayName of active users, excluding the caller.
 */
router.get('/util/users', (req: AuthRequest, res: Response) => {
  try {
    const rows = getDb()
      .prepare(
        `SELECT id, username, display_name as displayName, role, is_active as isActive
         FROM users WHERE is_active = 1 AND id != ? ORDER BY username ASC`
      )
      .all(req.user!.id) as any[];
    const data = rows.map((r) => ({ ...r, isActive: Boolean(r.isActive) }));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- group knowledge base files (§10.6.7) ----------

function serializeRoomFile(f: any): any {
  return {
    id: f.id,
    roomId: f.room_id,
    uploadedBy: f.uploaded_by,
    originalName: f.original_name,
    mimeType: f.mime_type,
    fileSize: f.file_size,
    createdAt: f.created_at,
  };
}

/** GET /api/rooms/:id/files — list group files (members) */
router.get('/:id/files', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    const rows = getDb()
      .prepare(
        `SELECT id, room_id, uploaded_by, original_name, mime_type, file_size, created_at
         FROM room_files WHERE room_id = ? ORDER BY created_at DESC`
      )
      .all(room.id) as any[];
    res.json({ success: true, data: rows.map(serializeRoomFile) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/rooms/:id/files — add a group KB file (members).
 * body: { name, mimeType, content, fileSize? }
 * Text content is stored inline; only this group's AI reads it (via @AI + select).
 */
router.post('/:id/files', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    const { name, mimeType, content, fileSize } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    const db = getDb();
    const id = uuidv4();
    const now = nowIso();
    db.prepare(
      `INSERT INTO room_files (id, room_id, uploaded_by, original_name, mime_type, file_size, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      room.id,
      req.user!.id,
      String(name).trim(),
      String(mimeType || 'text/plain'),
      typeof fileSize === 'number' ? fileSize : String(content || '').length,
      content != null ? String(content) : null,
      now
    );
    res.status(201).json({ success: true, data: serializeRoomFile(getDb().prepare('SELECT * FROM room_files WHERE id = ?').get(id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** DELETE /api/rooms/:id/files/:fileId — remove a group file (members) */
router.delete('/:id/files/:fileId', (req: AuthRequest, res: Response) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (!isMember(room.id, req.user!.id)) {
      return res.status(403).json({ success: false, error: 'Not a member of this room' });
    }
    getDb().prepare('DELETE FROM room_files WHERE id = ? AND room_id = ?').run(req.params.fileId, room.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
