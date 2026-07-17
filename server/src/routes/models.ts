import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { optionalAuth } from '../middleware/auth';
import { AggregatedModel, ModelCapability, ApiResponse, AuthRequest } from '../types';
import { normalizeModelName } from '../services/normalizeModelName';
import { getErrorMessage } from '../utils/errors';

// Re-export so existing `from './models'` importers keep working.
export { normalizeModelName } from '../services/normalizeModelName';

const router = Router();

/**
 * GET /api/models — aggregated models.
 * - guests / users: only public (enabled=1)
 * - admin: models in admin pool (admin_enabled=1), including non-public
 * Query: ?scope=public|admin (admin only for admin scope)
 */
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const isAdmin = req.user?.role === 'admin';
    const scope = String(req.query.scope || '');
    const useAdminPool = isAdmin && scope !== 'public';

    const where = useAdminPool
      ? 'WHERE COALESCE(sm.admin_enabled, 1) = 1 AND s.enabled = 1'
      : 'WHERE sm.enabled = 1 AND s.enabled = 1';

    const rows = db.prepare(`
      SELECT sm.model_id, sm.display_name, sm.capabilities, sm.enabled,
             COALESCE(sm.admin_enabled, 1) as admin_enabled,
             s.id as station_id, s.name as station_name, s.health_status
      FROM station_models sm
      JOIN stations s ON sm.station_id = s.id
      ${where}
    `).all() as any[];

    const modelMap = new Map<string, AggregatedModel & { publicEnabled?: boolean; adminEnabled?: boolean }>();

    for (const row of rows) {
      const normalized = normalizeModelName(row.model_id);
      let caps: ModelCapability[] = [];
      try {
        caps = JSON.parse(row.capabilities);
      } catch {
        caps = ['text'] as ModelCapability[];
      }

      if (!modelMap.has(normalized)) {
        modelMap.set(normalized, {
          displayName: row.display_name,
          normalizedName: normalized,
          capabilities: [...caps],
          stations: [],
          publicEnabled: row.enabled === 1,
          adminEnabled: row.admin_enabled === 1,
        });
      }

      const agg = modelMap.get(normalized)!;
      if (row.enabled === 1) (agg as any).publicEnabled = true;
      if (row.admin_enabled === 1) (agg as any).adminEnabled = true;
      // Prefer a nicer custom display name if present
      if (row.display_name && row.display_name !== row.model_id) {
        agg.displayName = row.display_name;
      }

      agg.stations.push({
        stationId: row.station_id,
        stationName: row.station_name,
        modelId: row.model_id,
        healthy: row.health_status === 'healthy',
      });

      for (const cap of caps) {
        if (!agg.capabilities.includes(cap)) {
          agg.capabilities.push(cap);
        }
      }
    }

    const models = Array.from(modelMap.values());
    res.json({ success: true, data: models } as ApiResponse<AggregatedModel[]>);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/models/:normalizedName/stations - List stations serving a model
router.get('/:normalizedName/stations', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { normalizedName } = req.params;
    const db = getDb();
    const isAdmin = req.user?.role === 'admin';
    const where = isAdmin
      ? 'WHERE COALESCE(sm.admin_enabled, 1) = 1 AND s.enabled = 1'
      : 'WHERE sm.enabled = 1 AND s.enabled = 1';

    const rows = db.prepare(`
      SELECT sm.model_id, sm.display_name, sm.capabilities,
             s.id as station_id, s.name as station_name, s.health_status, s.base_url
      FROM station_models sm
      JOIN stations s ON sm.station_id = s.id
      ${where}
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
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
