import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { Station, CreateStationRequest, UpdateStationRequest, ApiResponse } from '../types';

const router = Router();

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

// POST /api/stations/:id/pull-models - Fetch models from station
router.post('/:id/pull-models', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id) as any;
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    // Construct the models URL, handling trailing slashes
    const baseUrl = station.base_url.replace(/\/+$/, '');
    const modelsUrl = `${baseUrl}/models`;

    let response: any;
    try {
      response = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${station.api_key}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
        throw new Error(`Request timed out connecting to ${modelsUrl}. Check that the Base URL is correct and the server is reachable.`);
      }
      throw new Error(`Failed to connect to ${modelsUrl}: ${fetchErr.message}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const hint = response.status === 401
        ? ' — Check that your API Key is correct (should be a secret key like sk-..., not a URL)'
        : response.status === 404
        ? ' — The /models endpoint was not found. Ensure your Base URL is correct (e.g. https://api.example.com/v1)'
        : '';
      throw new Error(`Station returned HTTP ${response.status}: ${response.statusText}${hint}${errorBody ? `\n${errorBody}` : ''}`);
    }

    const data = await response.json() as any;
    const models = data.data || [];

    if (models.length === 0) {
      // Update station health but warn about empty model list
      const now = new Date().toISOString();
      db.prepare('UPDATE stations SET health_status = ?, last_health_check = ?, updated_at = ? WHERE id = ?')
        .run('healthy', now, now, id);
      return res.json({ success: true, data: [], warning: 'Station is reachable but returned no models' });
    }

    // Clear existing models for this station
    db.prepare('DELETE FROM station_models WHERE station_id = ?').run(id);

    // Insert new models
    const insert = db.prepare(
      'INSERT INTO station_models (id, station_id, model_id, display_name, capabilities, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    );

    const now = new Date().toISOString();
    for (const model of models) {
      const modelId = model.id || model.name;
      const displayName = model.name || model.id;
      // Detect capabilities from model id/name
      const capabilities = detectCapabilities(modelId);
      insert.run(uuidv4(), id, modelId, displayName, JSON.stringify(capabilities), now);
    }

    // Update station health
    db.prepare('UPDATE stations SET health_status = ?, last_health_check = ?, updated_at = ? WHERE id = ?')
      .run('healthy', now, now, id);

    const savedModels = db.prepare('SELECT * FROM station_models WHERE station_id = ?').all(id);
    res.json({ success: true, data: savedModels });
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

    const baseUrl = station.base_url.replace(/\/+$/, '');
    const modelsUrl = `${baseUrl}/models`;
    const now = new Date().toISOString();
    let status = 'unhealthy';
    let detail = '';
    try {
      const response = await fetch(modelsUrl, {
        headers: { 'Authorization': `Bearer ${station.api_key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        status = 'healthy';
      } else {
        detail = `HTTP ${response.status}`;
      }
    } catch (fetchErr: any) {
      status = 'unhealthy';
      detail = fetchErr.name === 'TimeoutError' ? 'Timeout' : fetchErr.message;
    }

    db.prepare('UPDATE stations SET health_status = ?, last_health_check = ?, updated_at = ? WHERE id = ?')
      .run(status, now, now, id);

    res.json({ success: true, data: { healthStatus: status, lastHealthCheck: now, detail } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: map DB row to Station
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

// Helper: detect model capabilities from model ID
export function detectCapabilities(modelId: string): string[] {
  const id = modelId.toLowerCase();
  const caps: string[] = ['text'];
  if (id.includes('embedding') || id.includes('embed')) {
    caps.push('embedding');
  }
  if (id.includes('vision') || id.includes('gpt-4o') || id.includes('claude-3')) {
    caps.push('vision');
  }
  if (id.includes('dall-e') || id.includes('stable-diffusion') || id.includes('midjourney') || id.includes('image')) {
    caps.push('image-gen');
  }
  if (id.includes('code') || id.includes('codex') || id.includes('coder')) {
    caps.push('code');
  }
  return caps;
}

export default router;
