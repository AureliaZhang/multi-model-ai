import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { Station, CreateStationRequest, UpdateStationRequest, ApiResponse } from '../types';
import type { AuthRequest } from '../types';
import { checkStationHealth } from '../services/healthCheck';

const router = Router();

function mapStationModel(row: any) {
  let capabilities: string[] = [];
  try {
    capabilities = JSON.parse(row.capabilities || '[]');
  } catch {
    capabilities = detectCapabilities(row.model_id);
  }
  const adminEnabled = row.admin_enabled === undefined || row.admin_enabled === null
    ? 1
    : row.admin_enabled;
  return {
    id: row.id,
    stationId: row.station_id,
    modelId: row.model_id,
    displayName: row.display_name,
    capabilities,
    /** Selected into admin pool (admin can use) */
    adminEnabled: adminEnabled === 1 || adminEnabled === true,
    /** Public to end users (implies adminEnabled for sanity) */
    enabled: row.enabled === 1, // public
    publicEnabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

// GET /api/stations - List all stations
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM stations ORDER BY created_at DESC').all() as any[];
    const stations: Station[] = rows.map(rowToStation);
    res.json({ success: true, data: stations } as ApiResponse<Station[]>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/stations - Create a station
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, baseUrl, apiKey } = req.body as CreateStationRequest;
    if (!name || !baseUrl || !apiKey) {
      return res.status(400).json({ success: false, error: 'name, baseUrl, and apiKey are required' });
    }
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO stations (id, name, base_url, api_key, enabled, health_status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
    ).run(id, name, baseUrl, apiKey, 'unknown', now, now);

    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id) as any;
    res.status(201).json({ success: true, data: rowToStation(station) } as ApiResponse<Station>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/stations/:id - Update a station
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateStationRequest;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM stations WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    const name = updates.name ?? existing.name;
    const baseUrl = updates.baseUrl ?? existing.base_url;
    const apiKey = updates.apiKey ?? existing.api_key;
    const enabled = updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : existing.enabled;
    const now = new Date().toISOString();

    db.prepare(
      'UPDATE stations SET name = ?, base_url = ?, api_key = ?, enabled = ?, updated_at = ? WHERE id = ?'
    ).run(name, baseUrl, apiKey, enabled, now, id);

    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id) as any;
    res.json({ success: true, data: rowToStation(station) } as ApiResponse<Station>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/stations/:id - Delete a station
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const result = db.prepare('DELETE FROM stations WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }
    res.json({ success: true } as ApiResponse);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/stations/:id/models — admin catalog of pulled models (includes hidden)
 * Requires auth + admin so users cannot inspect unexposed models.
 */
router.get('/:id/models', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const station = db.prepare('SELECT id FROM stations WHERE id = ?').get(id);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }
    const rows = db.prepare(
      'SELECT * FROM station_models WHERE station_id = ? ORDER BY display_name ASC'
    ).all(id) as any[];
    res.json({ success: true, data: rows.map(mapStationModel) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/stations/:id/models/:modelRowId
 * body: { adminEnabled?: boolean, enabled?: boolean (public), capabilities?: string[], displayName?: string }
 */
router.put('/:id/models/:modelRowId', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const { id, modelRowId } = req.params;
    const { enabled, adminEnabled, capabilities, displayName } = req.body || {};
    const db = getDb();
    const row = db.prepare(
      'SELECT * FROM station_models WHERE id = ? AND station_id = ?'
    ).get(modelRowId, id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Model not found on this station' });
    }

    let nextAdmin = row.admin_enabled === undefined || row.admin_enabled === null ? 1 : row.admin_enabled;
    if (adminEnabled !== undefined) nextAdmin = adminEnabled ? 1 : 0;

    let nextPublic = row.enabled;
    if (enabled !== undefined) nextPublic = enabled ? 1 : 0;

    // Public implies admin pool
    if (nextPublic === 1) nextAdmin = 1;
    // Turning off admin also turns off public
    if (nextAdmin === 0) nextPublic = 0;

    let nextCaps = row.capabilities;
    if (Array.isArray(capabilities)) {
      nextCaps = JSON.stringify(capabilities);
    }

    let nextDisplay = row.display_name;
    if (displayName !== undefined) {
      const trimmed = String(displayName).trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, error: 'displayName cannot be empty' });
      }
      if (trimmed.length > 120) {
        return res.status(400).json({ success: false, error: 'displayName too long (max 120)' });
      }
      nextDisplay = trimmed;
    }

    db.prepare(
      'UPDATE station_models SET enabled = ?, admin_enabled = ?, capabilities = ?, display_name = ? WHERE id = ?'
    ).run(nextPublic, nextAdmin, nextCaps, nextDisplay, modelRowId);

    const updated = db.prepare('SELECT * FROM station_models WHERE id = ?').get(modelRowId);
    res.json({ success: true, data: mapStationModel(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/stations/:id/models-bulk
 * body: {
 *   adminEnabled?: boolean,
 *   enabled?: boolean (public),
 *   modelRowIds?: string[]
 * }
 */
router.put('/:id/models-bulk', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled, adminEnabled, modelRowIds } = req.body || {};
    if (enabled === undefined && adminEnabled === undefined) {
      return res.status(400).json({ success: false, error: 'enabled or adminEnabled is required' });
    }
    const db = getDb();
    const station = db.prepare('SELECT id FROM stations WHERE id = ?').get(id);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    const ids: string[] = Array.isArray(modelRowIds) && modelRowIds.length > 0
      ? modelRowIds
      : (db.prepare('SELECT id FROM station_models WHERE station_id = ?').all(id) as any[]).map((r) => r.id);

    const upd = db.prepare(
      'UPDATE station_models SET admin_enabled = ?, enabled = ? WHERE station_id = ? AND id = ?'
    );
    for (const mid of ids) {
      const row = db.prepare('SELECT enabled, admin_enabled FROM station_models WHERE id = ? AND station_id = ?').get(mid, id) as any;
      if (!row) continue;
      let nextAdmin = row.admin_enabled === undefined || row.admin_enabled === null ? 1 : row.admin_enabled;
      let nextPublic = row.enabled;
      if (adminEnabled !== undefined) nextAdmin = adminEnabled ? 1 : 0;
      if (enabled !== undefined) nextPublic = enabled ? 1 : 0;
      if (nextPublic === 1) nextAdmin = 1;
      if (nextAdmin === 0) nextPublic = 0;
      upd.run(nextAdmin, nextPublic, id, mid);
    }

    const rows = db.prepare(
      'SELECT * FROM station_models WHERE station_id = ? ORDER BY display_name ASC'
    ).all(id);
    res.json({ success: true, data: rows.map(mapStationModel) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/stations/:id/pull-models - Fetch models from station
router.post('/:id/pull-models', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id) as any;
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    const baseUrl = station.base_url.replace(/\/+$/, '');
    const modelsUrl = `${baseUrl}/models`;

    let response: any;
    try {
      response = await fetch(modelsUrl, {
        headers: {
          Authorization: `Bearer ${station.api_key}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
        throw new Error(
          `Request timed out connecting to ${modelsUrl}. Check that the Base URL is correct and the server is reachable.`
        );
      }
      throw new Error(`Failed to connect to ${modelsUrl}: ${fetchErr.message}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const hint =
        response.status === 401
          ? ' — Check that your API Key is correct (should be a secret key like sk-..., not a URL)'
          : response.status === 404
            ? ' — The /models endpoint was not found. Ensure your Base URL is correct (e.g. https://api.example.com/v1)'
            : '';
      throw new Error(
        `Station returned HTTP ${response.status}: ${response.statusText}${hint}${errorBody ? `\n${errorBody}` : ''}`
      );
    }

    const data = (await response.json()) as any;
    const models = data.data || [];

    if (models.length === 0) {
      const now = new Date().toISOString();
      db.prepare('UPDATE stations SET health_status = ?, last_health_check = ?, updated_at = ? WHERE id = ?').run(
        'healthy',
        now,
        now,
        id
      );
      return res.json({
        success: true,
        data: [],
        warning: 'Station is reachable but returned no models',
      });
    }

    // Remember previous exposure + custom display names before replace
    const existingCount = (
      db.prepare('SELECT COUNT(*) as n FROM station_models WHERE station_id = ?').get(id) as any
    ).n as number;
    const prevRows = db
      .prepare('SELECT model_id, display_name, enabled, admin_enabled FROM station_models WHERE station_id = ?')
      .all(id) as { model_id: string; display_name: string; enabled: number; admin_enabled: number }[];
    const prevMap = new Map(prevRows.map((r) => [r.model_id, r]));
    const isFirstPull = existingCount === 0;

    db.prepare('DELETE FROM station_models WHERE station_id = ?').run(id);

    const insert = db.prepare(
      'INSERT INTO station_models (id, station_id, model_id, display_name, capabilities, enabled, admin_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const now = new Date().toISOString();
    for (const model of models) {
      const modelId = model.id || model.name;
      const apiName = model.name || model.id;
      const prev = prevMap.get(modelId);
      const displayName = prev?.display_name?.trim() ? prev.display_name : apiName;
      const capabilities = detectCapabilities(modelId);
      // First pull: nothing selected. Re-pull: keep previous admin/public flags; new models hidden.
      let adminEn = isFirstPull ? 0 : (prev ? (prev.admin_enabled ? 1 : 0) : 0);
      let pubEn = isFirstPull ? 0 : (prev ? (prev.enabled ? 1 : 0) : 0);
      if (pubEn === 1) adminEn = 1;
      insert.run(uuidv4(), id, modelId, displayName, JSON.stringify(capabilities), pubEn, adminEn, now);
    }

    db.prepare('UPDATE stations SET health_status = ?, last_health_check = ?, updated_at = ? WHERE id = ?').run(
      'healthy',
      now,
      now,
      id
    );

    const savedModels = db
      .prepare('SELECT * FROM station_models WHERE station_id = ? ORDER BY display_name ASC')
      .all(id);
    res.json({
      success: true,
      data: savedModels.map(mapStationModel),
      meta: {
        total: savedModels.length,
        exposed: savedModels.filter((m: any) => m.enabled === 1 || m.enabled === true).length,
        firstPull: isFirstPull,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/stations/:id/health-check
router.post('/:id/health-check', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id) as any;
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    // Reuse the same ping+persist logic the background sweep uses (§8.3).
    const { status, detail } = await checkStationHealth(db, station);
    const updated = db.prepare('SELECT last_health_check FROM stations WHERE id = ?').get(id) as any;

    res.json({ success: true, data: { healthStatus: status, lastHealthCheck: updated?.last_health_check, detail } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function rowToStation(row: any): Station {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    enabled: row.enabled === 1,
    healthStatus: row.health_status,
    lastHealthCheck: row.last_health_check,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function detectCapabilities(modelId: string): string[] {
  const id = modelId.toLowerCase();
  if (id.includes('embedding') || id.includes('embed')) {
    return ['embedding'];
  }
  if (
    id.includes('tts') ||
    id.includes('speech') ||
    id.includes('voiceclone') ||
    id.includes('voicedesign') ||
    id.includes('audio-speech')
  ) {
    return ['tts'];
  }
  if (
    id.includes('dall-e') ||
    id.includes('dalle') ||
    id.includes('stable-diffusion') ||
    id.includes('midjourney') ||
    id.includes('image-gen') ||
    id.includes('imagen') ||
    id.includes('flux') ||
    (id.includes('image') && !id.includes('vision'))
  ) {
    return ['image-gen'];
  }

  const caps: string[] = ['text'];
  if (id.includes('vision') || id.includes('gpt-4o') || id.includes('claude-3') || id.includes('omni')) {
    caps.push('vision');
  }
  if (id.includes('code') || id.includes('codex') || id.includes('coder')) {
    caps.push('code');
  }
  return caps;
}

export default router;
