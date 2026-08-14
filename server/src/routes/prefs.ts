/**
 * User model preferences + catalog by capability (admin-curated via stations).
 */

import { Router, Response } from 'express';
import { getDb } from '../database';
import { requireAuth } from '../middleware/auth';
import { normalizeModelName } from '../services/normalizeModelName';
import { detectCapabilities } from './stations';
import type { AuthRequest, ApiResponse } from '../types';
import type { AggregatedModelSourceRow, UserModelPrefsRow } from '../dbRows';
import { getErrorMessage } from '../utils/errors';

const router = Router();
router.use(requireAuth);

function listModelsByCapability(
  cap: 'text' | 'image-gen' | 'tts',
  opts?: { adminPool?: boolean }
) {
  const db = getDb();
  const pool = opts?.adminPool
    ? 'COALESCE(sm.admin_enabled, 1) = 1'
    : 'sm.enabled = 1';
  const rows = db.prepare(`
    SELECT sm.model_id, sm.display_name, sm.capabilities,
           s.id as station_id, s.name as station_name
    FROM station_models sm
    JOIN stations s ON sm.station_id = s.id
    WHERE ${pool} AND s.enabled = 1
  `).all() as Array<Pick<AggregatedModelSourceRow, 'model_id' | 'display_name' | 'capabilities' | 'station_id' | 'station_name'>>;

  const map = new Map<string, {
    normalizedName: string;
    displayName: string;
    capabilities: string[];
    stationCount: number;
  }>();

  for (const row of rows) {
    const detected = detectCapabilities(row.model_id);
    let stored: string[] = [];
    try {
      stored = JSON.parse(row.capabilities || '[]');
    } catch {
      stored = [];
    }
    const merged = Array.from(new Set([...stored, ...detected]));
    const primary = detected[0] || stored[0] || 'text';

    // Slot membership by detected specialty first
    if (cap === 'tts' && !detected.includes('tts') && !merged.includes('tts')) continue;
    if (cap === 'image-gen' && !detected.includes('image-gen') && !merged.includes('image-gen')) continue;
    if (cap === 'text') {
      if (detected.includes('tts') && detected.length === 1) continue;
      if (detected.includes('image-gen') && detected.length === 1) continue;
      if (detected.includes('embedding') && detected.length === 1) continue;
      if (!merged.includes('text') && !merged.includes('vision') && !merged.includes('code')) continue;
    }

    const n = normalizeModelName(row.model_id);
    if (!map.has(n)) {
      map.set(n, {
        normalizedName: n,
        displayName: row.display_name || row.model_id,
        capabilities: merged.length ? merged : [primary],
        stationCount: 0,
      });
    }
    map.get(n)!.stationCount += 1;
  }

  return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function getPrefsRow(userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT user_id as userId, chat_model as chatModel, image_model as imageModel,
           tts_model as ttsModel, skip_daily_modal as skipDailyModal,
           last_modal_date as lastModalDate, auto_tts as autoTts, updated_at as updatedAt
    FROM user_model_prefs WHERE user_id = ?
  `).get(userId) as UserModelPrefsRow | undefined;
}

router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const row = getPrefsRow(userId);

    res.json({
      success: true,
      data: {
        chatModel: row?.chatModel || null,
        imageModel: row?.imageModel || null,
        ttsModel: row?.ttsModel || null,
        autoTts: row ? Boolean(row.autoTts) : true,
        role: req.user!.role,
      },
    } as ApiResponse);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

router.put('/', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { chatModel, imageModel, ttsModel, autoTts } = req.body || {};

    const db = getDb();
    const existing = getPrefsRow(userId);
    const now = new Date().toISOString();

    const next = {
      chatModel: chatModel !== undefined ? (chatModel ? normalizeModelName(String(chatModel)) : null) : (existing?.chatModel ?? null),
      imageModel: imageModel !== undefined ? (imageModel ? normalizeModelName(String(imageModel)) : null) : (existing?.imageModel ?? null),
      ttsModel: ttsModel !== undefined ? (ttsModel ? normalizeModelName(String(ttsModel)) : null) : (existing?.ttsModel ?? null),
      // v0.7.92: the daily-model modal is gone (its slots now live in Settings,
      // editable any time). The two columns stay in the table — dropping columns
      // in SQLite means rebuilding it, for no gain — but nothing writes them now.
      skipDailyModal: existing?.skipDailyModal ? 1 : 0,
      lastModalDate: existing?.lastModalDate ?? null,
      autoTts: autoTts !== undefined ? (autoTts ? 1 : 0) : (existing ? (existing.autoTts ? 1 : 0) : 1),
    };

    if (existing) {
      db.prepare(`
        UPDATE user_model_prefs SET
          chat_model = ?, image_model = ?, tts_model = ?,
          skip_daily_modal = ?, last_modal_date = ?, auto_tts = ?, updated_at = ?
        WHERE user_id = ?
      `).run(
        next.chatModel,
        next.imageModel,
        next.ttsModel,
        next.skipDailyModal,
        next.lastModalDate,
        next.autoTts,
        now,
        userId
      );
    } else {
      db.prepare(`
        INSERT INTO user_model_prefs
          (user_id, chat_model, image_model, tts_model, skip_daily_modal, last_modal_date, auto_tts, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        next.chatModel,
        next.imageModel,
        next.ttsModel,
        next.skipDailyModal,
        next.lastModalDate,
        next.autoTts,
        now
      );
    }

    const row = getPrefsRow(userId)!;
    res.json({
      success: true,
      data: {
        chatModel: row.chatModel,
        imageModel: row.imageModel,
        ttsModel: row.ttsModel,
        autoTts: Boolean(row.autoTts),
        role: req.user!.role,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

router.get('/catalog', (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    res.json({
      success: true,
      data: {
        chat: listModelsByCapability('text', { adminPool: isAdmin }),
        image: listModelsByCapability('image-gen', { adminPool: isAdmin }),
        tts: listModelsByCapability('tts', { adminPool: isAdmin }),
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
