/**
 * Admin DB backup endpoints (§10.8 "Data safety" — Phase 2).
 *
 *   GET  /api/backups  → config + list of existing snapshots (newest first)
 *   POST /api/backups  → take a snapshot NOW (works even if the scheduled job is
 *                        disabled — an explicit admin action, e.g. before a risky
 *                        import), returns the new filename + size.
 *
 * Admin-only: backups are a whole-DB copy (every user's data), so this mirrors
 * the `usage` route's `requireAuth + requireRole('admin')` gate.
 */

import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../types';
import { getErrorMessage } from '../utils/errors';
import { parseBackupOptions, runBackupSweep } from '../services/backup';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const BACKUP_FILE_RE = /^app-\d{8}-\d{6}\.db$/;

// GET /api/backups — config + existing snapshots (newest first)
router.get('/', (_req: AuthRequest, res: Response) => {
  try {
    const opts = parseBackupOptions();
    let backups: { name: string; size: number; createdAt: string }[] = [];
    try {
      backups = fs
        .readdirSync(opts.dir)
        .filter((f) => BACKUP_FILE_RE.test(f))
        .map((name) => {
          const st = fs.statSync(path.join(opts.dir, name));
          return { name, size: st.size, createdAt: st.mtime.toISOString() };
        })
        .sort((a, b) => (a.name < b.name ? 1 : -1)); // newest first
    } catch {
      backups = []; // dir not created yet → no snapshots
    }
    res.json({
      success: true,
      enabled: opts.enabled,
      dir: opts.dir,
      keep: opts.keep,
      intervalMs: opts.intervalMs,
      backups,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/backups — take a snapshot now
router.post('/', async (_req: AuthRequest, res: Response) => {
  try {
    const { file, pruned } = await runBackupSweep();
    const st = fs.statSync(file);
    res.json({ success: true, file: path.basename(file), size: st.size, pruned: pruned.length });
  } catch (err) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
