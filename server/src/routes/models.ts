import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { AggregatedModel, ModelCapability, ApiResponse } from '../types';

const router = Router();

// GET /api/models - List all aggregated (deduplicated) models
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT sm.model_id, sm.display_name, sm.capabilities, sm.enabled,
             s.id as station_id, s.name as station_name, s.health_status
      FROM station_models sm
      JOIN stations s ON sm.station_id = s.id
      WHERE sm.enabled = 1 AND s.enabled = 1
    `).all() as any[];

    // Deduplicate by normalized model name
    const modelMap = new Map<string, AggregatedModel>();

    for (const row of rows) {
      const normalized = normalizeModelName(row.model_id);
      const caps: ModelCapability[] = JSON.parse(row.capabilities);

      if (!modelMap.has(normalized)) {
        modelMap.set(normalized, {
          displayName: row.display_name,
          normalizedName: normalized,
          capabilities: [...caps],
          stations: [],
        });
      }

      const agg = modelMap.get(normalized)!;

      // Add station
      agg.stations.push({
        stationId: row.station_id,
        stationName: row.station_name,
        modelId: row.model_id,
        healthy: row.health_status === 'healthy',
      });

      // Merge capabilities (union)
      for (const cap of caps) {
        if (!agg.capabilities.includes(cap)) {
          agg.capabilities.push(cap);
        }
      }
    }

    const models = Array.from(modelMap.values());
    res.json({ success: true, data: models } as ApiResponse<AggregatedModel[]>);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/models/:normalizedName/stations - List stations serving a model
router.get('/:normalizedName/stations', (req: Request, res: Response) => {
  try {
    const { normalizedName } = req.params;
    const db = getDb();
    const rows = db.prepare(`
      SELECT sm.model_id, sm.display_name, sm.capabilities,
             s.id as station_id, s.name as station_name, s.health_status, s.base_url
      FROM station_models sm
      JOIN stations s ON sm.station_id = s.id
      WHERE sm.enabled = 1 AND s.enabled = 1
    `).all() as any[];

    const stations = rows
      .filter(r => normalizeModelName(r.model_id) === normalizedName)
      .map(r => ({
        stationId: r.station_id,
        stationName: r.station_name,
        modelId: r.model_id,
        healthy: r.health_status === 'healthy',
      }));

    res.json({ success: true, data: stations } as ApiResponse);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/stations/:stationId/models/:modelId - Enable/disable a specific station-model
router.put('/:stationId/models/:modelId', (req: Request, res: Response) => {
  // Note: This is mounted at /api/models but handles station-specific model toggle
  // The actual route is /api/stations/:stationId/models/:modelId - see index.ts
  res.status(501).json({ success: false, error: 'Use /api/stations/:stationId/models/:modelId' });
});

// Normalize model name for deduplication
export function normalizeModelName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default router;
