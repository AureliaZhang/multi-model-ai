/**
 * Arena API — admin-only model battle / leaderboard / stats.
 * Selection = pick one answer (no scores).
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { normalizeModelName } from './models';
import { invokeModel } from '../services/modelInvocation';
import { arenaConcurrency, mapPool } from '../utils/asyncPool';
import { sendCsv, toCsv } from '../utils/csv';
import type { AuthRequest, ApiResponse } from '../types';

const router = Router();

// All arena routes: authenticated admin only
router.use(requireAuth, requireRole('admin'));

// ---------- helpers ----------

function listAggregatedModels(): {
  displayName: string;
  normalizedName: string;
  capabilities: string[];
  stationCount: number;
}[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT sm.model_id, sm.display_name, sm.capabilities, sm.enabled,
           s.id as station_id, s.health_status
    FROM station_models sm
    JOIN stations s ON sm.station_id = s.id
    WHERE sm.enabled = 1 AND s.enabled = 1
  `).all() as any[];

  const map = new Map<string, { displayName: string; normalizedName: string; capabilities: string[]; stationCount: number }>();
  for (const row of rows) {
    const n = normalizeModelName(row.model_id);
    if (!map.has(n)) {
      map.set(n, {
        displayName: row.display_name || row.model_id,
        normalizedName: n,
        capabilities: JSON.parse(row.capabilities || '["text"]'),
        stationCount: 0,
      });
    }
    map.get(n)!.stationCount += 1;
  }
  return Array.from(map.values());
}

function getBattleDetail(sessionId: string) {
  const db = getDb();
  const session = db.prepare(`
    SELECT id, question_text as questionText, prompt_id as promptId, status,
           reveal_mode as revealMode, created_by as createdBy,
           created_at as createdAt, completed_at as completedAt
    FROM arena_battle_sessions WHERE id = ?
  `).get(sessionId) as any;
  if (!session) return null;

  const candidates = db.prepare(`
    SELECT id, session_id as sessionId, model_normalized_name as modelNormalizedName,
           station_id as stationId, position, status, content, error_message as errorMessage,
           latency_ms as latencyMs, model_used as modelUsed, finished_at as finishedAt
    FROM arena_battle_candidates
    WHERE session_id = ?
    ORDER BY position ASC
  `).all(sessionId) as any[];

  const selection = db.prepare(`
    SELECT id, session_id as sessionId, selected_candidate_id as selectedCandidateId,
           selected_model_normalized_name as selectedModelNormalizedName,
           selector_user_id as selectorUserId, created_at as createdAt
    FROM arena_battle_selections WHERE session_id = ?
  `).get(sessionId) as any || null;

  // Hide model names until pick if configured and not yet selected
  let viewCandidates = candidates;
  if (session.revealMode === 'hidden_until_pick' && !selection) {
    viewCandidates = candidates.map((c, i) => ({
      ...c,
      modelNormalizedName: session.status === 'completed' ? c.modelNormalizedName : `model-${i + 1}`,
      modelUsed: null,
      stationId: null,
      _hidden: true,
    }));
  }

  return { ...session, candidates: viewCandidates, selection };
}

async function runBattleCandidates(sessionId: string, question: string): Promise<void> {
  const db = getDb();
  db.prepare(`UPDATE arena_battle_sessions SET status = 'running' WHERE id = ?`).run(sessionId);

  const candidates = db.prepare(
    `SELECT id, model_normalized_name FROM arena_battle_candidates WHERE session_id = ?`
  ).all(sessionId) as { id: string; model_normalized_name: string }[];

  await mapPool(candidates, arenaConcurrency(3), async (c) => {
    const result = await invokeModel({
      modelNormalizedName: c.model_normalized_name,
      messages: [{ role: 'user', content: question }],
    });
    const finished = new Date().toISOString();
    if (result.ok) {
      db.prepare(`
        UPDATE arena_battle_candidates
        SET status = 'done', content = ?, latency_ms = ?, model_used = ?, station_id = ?, finished_at = ?, error_message = NULL
        WHERE id = ?
      `).run(result.content, result.latencyMs, result.modelUsed, result.stationId, finished, c.id);
    } else {
      db.prepare(`
        UPDATE arena_battle_candidates
        SET status = 'error', error_message = ?, latency_ms = ?, finished_at = ?, content = NULL
        WHERE id = ?
      `).run(result.error, result.latencyMs, finished, c.id);
    }
  });

  const doneCount = (db.prepare(
    `SELECT COUNT(*) as n FROM arena_battle_candidates WHERE session_id = ? AND status = 'done'`
  ).get(sessionId) as any).n;

  if (doneCount === 0) {
    db.prepare(`UPDATE arena_battle_sessions SET status = 'failed' WHERE id = ?`).run(sessionId);
  } else {
    db.prepare(`UPDATE arena_battle_sessions SET status = 'awaiting_selection' WHERE id = ?`).run(sessionId);
  }
}

// ---------- Models pool ----------

/** GET /api/arena/models — aggregated models + arena profiles */
router.get('/models', (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const aggregated = listAggregatedModels();
    const profiles = db.prepare(`
      SELECT id, model_normalized_name as modelNormalizedName, display_label as displayLabel,
             eligible_battle as eligibleBattle, eligible_benchmark as eligibleBenchmark,
             tags_json as tagsJson, notes, is_active as isActive, sort_order as sortOrder,
             created_at as createdAt, updated_at as updatedAt
      FROM arena_model_profiles
    `).all() as any[];

    const profileMap = new Map(profiles.map((p) => [p.modelNormalizedName, p]));

    const data = aggregated.map((m) => {
      const p = profileMap.get(m.normalizedName);
      return {
        normalizedName: m.normalizedName,
        displayName: p?.displayLabel || m.displayName,
        capabilities: m.capabilities,
        stationCount: m.stationCount,
        eligibleBattle: p ? Boolean(p.eligibleBattle) : true,
        eligibleBenchmark: p ? Boolean(p.eligibleBenchmark) : true,
        tags: p ? JSON.parse(p.tagsJson || '[]') : [],
        notes: p?.notes ?? null,
        isActive: p ? Boolean(p.isActive) : true,
        hasProfile: !!p,
      };
    });

    // Sort: active battle-eligible first
    data.sort((a, b) => {
      if (a.eligibleBattle !== b.eligibleBattle) return a.eligibleBattle ? -1 : 1;
      return a.normalizedName.localeCompare(b.normalizedName);
    });

    res.json({ success: true, data } as ApiResponse);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** PUT /api/arena/models/:normalizedName — upsert profile */
router.put('/models/:normalizedName', (req: AuthRequest, res: Response) => {
  try {
    const normalizedName = normalizeModelName(req.params.normalizedName);
    const {
      displayLabel,
      eligibleBattle,
      eligibleBenchmark,
      tags,
      notes,
      isActive,
      sortOrder,
    } = req.body || {};

    const db = getDb();
    const existing = db.prepare(
      'SELECT id FROM arena_model_profiles WHERE model_normalized_name = ?'
    ).get(normalizedName) as any;

    const now = new Date().toISOString();
    if (existing) {
      db.prepare(`
        UPDATE arena_model_profiles SET
          display_label = COALESCE(?, display_label),
          eligible_battle = COALESCE(?, eligible_battle),
          eligible_benchmark = COALESCE(?, eligible_benchmark),
          tags_json = COALESCE(?, tags_json),
          notes = COALESCE(?, notes),
          is_active = COALESCE(?, is_active),
          sort_order = COALESCE(?, sort_order),
          updated_at = ?
        WHERE model_normalized_name = ?
      `).run(
        displayLabel !== undefined ? displayLabel : null,
        eligibleBattle !== undefined ? (eligibleBattle ? 1 : 0) : null,
        eligibleBenchmark !== undefined ? (eligibleBenchmark ? 1 : 0) : null,
        tags !== undefined ? JSON.stringify(tags) : null,
        notes !== undefined ? notes : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        sortOrder !== undefined ? sortOrder : null,
        now,
        normalizedName
      );
    } else {
      db.prepare(`
        INSERT INTO arena_model_profiles (
          id, model_normalized_name, display_label, eligible_battle, eligible_benchmark,
          tags_json, notes, is_active, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        normalizedName,
        displayLabel ?? null,
        eligibleBattle === false ? 0 : 1,
        eligibleBenchmark === false ? 0 : 1,
        JSON.stringify(tags || []),
        notes ?? null,
        isActive === false ? 0 : 1,
        sortOrder ?? 0,
        now,
        now
      );
    }

    const row = db.prepare(`
      SELECT id, model_normalized_name as modelNormalizedName, display_label as displayLabel,
             eligible_battle as eligibleBattle, eligible_benchmark as eligibleBenchmark,
             tags_json as tagsJson, notes, is_active as isActive, sort_order as sortOrder
      FROM arena_model_profiles WHERE model_normalized_name = ?
    `).get(normalizedName) as any;

    res.json({
      success: true,
      data: {
        ...row,
        eligibleBattle: Boolean(row.eligibleBattle),
        eligibleBenchmark: Boolean(row.eligibleBenchmark),
        isActive: Boolean(row.isActive),
        tags: JSON.parse(row.tagsJson || '[]'),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Battles ----------

/**
 * POST /api/arena/battles
 * body: { question: string, models: string[], revealMode?, runImmediately? }
 */
router.post('/battles', async (req: AuthRequest, res: Response) => {
  try {
    const { question, models, revealMode, runImmediately = true } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ success: false, error: 'question is required' });
      return;
    }
    if (!Array.isArray(models) || models.length < 2) {
      res.status(400).json({ success: false, error: 'Select at least 2 models' });
      return;
    }

    const normalizedModels = [...new Set(models.map((m: string) => normalizeModelName(m)))];
    if (normalizedModels.length < 2) {
      res.status(400).json({ success: false, error: 'Need at least 2 distinct models' });
      return;
    }

    const available = new Set(listAggregatedModels().map((m) => m.normalizedName));
    const missing = normalizedModels.filter((m) => !available.has(m));
    if (missing.length) {
      res.status(400).json({ success: false, error: `Models not available: ${missing.join(', ')}` });
      return;
    }

    const db = getDb();
    const sessionId = uuidv4();
    const now = new Date().toISOString();
    const mode = revealMode === 'hidden_until_pick' ? 'hidden_until_pick' : 'always_show_names';

    // Optional shuffle for blind bias reduction when hidden
    const order = [...normalizedModels];
    if (mode === 'hidden_until_pick') {
      order.sort(() => Math.random() - 0.5);
    }

    db.prepare(`
      INSERT INTO arena_battle_sessions (id, question_text, status, reveal_mode, created_by, created_at)
      VALUES (?, ?, 'pending', ?, ?, ?)
    `).run(sessionId, question.trim(), mode, req.user!.id, now);

    const insertCand = db.prepare(`
      INSERT INTO arena_battle_candidates (id, session_id, model_normalized_name, position, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    order.forEach((m, i) => {
      insertCand.run(uuidv4(), sessionId, m, i);
    });

    if (runImmediately) {
      // Run before responding so UI gets full results (V1 simple path)
      await runBattleCandidates(sessionId, question.trim());
    }

    const detail = getBattleDetail(sessionId);
    res.status(201).json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[arena] create battle error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/arena/battles/:id/run — re-run pending/failed */
router.post('/battles/:id/run', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const session = db.prepare(
      'SELECT id, question_text, status FROM arena_battle_sessions WHERE id = ?'
    ).get(req.params.id) as any;
    if (!session) {
      res.status(404).json({ success: false, error: 'Battle not found' });
      return;
    }
    if (session.status === 'completed') {
      res.status(409).json({ success: false, error: 'Battle already completed' });
      return;
    }

    // Reset candidates that are not done? For simplicity re-run all pending/error
    db.prepare(`
      UPDATE arena_battle_candidates SET status = 'pending', content = NULL, error_message = NULL
      WHERE session_id = ? AND status != 'done'
    `).run(session.id);

    await runBattleCandidates(session.id, session.question_text);
    res.json({ success: true, data: getBattleDetail(session.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/arena/battles/:id */
router.get('/battles/:id', (req: AuthRequest, res: Response) => {
  try {
    const detail = getBattleDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, error: 'Battle not found' });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/arena/battles — history */
router.get('/battles', (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset || '0'), 10) || 0;
    const db = getDb();
    const rows = db.prepare(`
      SELECT s.id, s.question_text as questionText, s.status, s.reveal_mode as revealMode,
             s.created_by as createdBy, s.created_at as createdAt, s.completed_at as completedAt,
             sel.selected_model_normalized_name as selectedModel,
             (SELECT COUNT(*) FROM arena_battle_candidates c WHERE c.session_id = s.id) as candidateCount
      FROM arena_battle_sessions s
      LEFT JOIN arena_battle_selections sel ON sel.session_id = s.id
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = (db.prepare('SELECT COUNT(*) as n FROM arena_battle_sessions').get() as any).n;
    res.json({ success: true, data: { items: rows, total, limit, offset } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/arena/battles/:id/select
 * body: { candidateId: string }
 */
router.post('/battles/:id/select', (req: AuthRequest, res: Response) => {
  try {
    const { candidateId } = req.body || {};
    if (!candidateId) {
      res.status(400).json({ success: false, error: 'candidateId is required' });
      return;
    }

    const db = getDb();
    const session = db.prepare(
      'SELECT id, status FROM arena_battle_sessions WHERE id = ?'
    ).get(req.params.id) as any;
    if (!session) {
      res.status(404).json({ success: false, error: 'Battle not found' });
      return;
    }
    if (session.status === 'completed') {
      res.status(409).json({ success: false, error: 'Already selected for this battle' });
      return;
    }
    if (session.status !== 'awaiting_selection' && session.status !== 'running') {
      // allow select only when at least one done
      const done = (db.prepare(
        `SELECT COUNT(*) as n FROM arena_battle_candidates WHERE session_id = ? AND status = 'done'`
      ).get(session.id) as any).n;
      if (!done) {
        res.status(400).json({ success: false, error: 'No successful answers to select' });
        return;
      }
    }

    const existing = db.prepare(
      'SELECT id FROM arena_battle_selections WHERE session_id = ?'
    ).get(session.id);
    if (existing) {
      res.status(409).json({ success: false, error: 'Already selected for this battle' });
      return;
    }

    const candidate = db.prepare(`
      SELECT id, model_normalized_name, status FROM arena_battle_candidates
      WHERE id = ? AND session_id = ?
    `).get(candidateId, session.id) as any;

    if (!candidate) {
      res.status(400).json({ success: false, error: 'Candidate not in this battle' });
      return;
    }
    if (candidate.status !== 'done') {
      res.status(400).json({ success: false, error: 'Can only select a successful answer' });
      return;
    }

    const now = new Date().toISOString();
    const selId = uuidv4();
    db.prepare(`
      INSERT INTO arena_battle_selections
        (id, session_id, selected_candidate_id, selected_model_normalized_name, selector_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(selId, session.id, candidate.id, candidate.model_normalized_name, req.user!.id, now);

    db.prepare(`
      UPDATE arena_battle_sessions SET status = 'completed', completed_at = ? WHERE id = ?
    `).run(now, session.id);

    res.json({ success: true, data: getBattleDetail(session.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Leaderboard & stats ----------

/** GET /api/arena/leaderboard */
router.get('/leaderboard', (req: AuthRequest, res: Response) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : null;
    const to = typeof req.query.to === 'string' ? req.query.to : null;
    const db = getDb();

    // Appearances: candidates in sessions that have a selection (completed battles only for rate denom)
    let dateFilterSessions = '';
    const params: any[] = [];
    if (from) {
      dateFilterSessions += ' AND s.created_at >= ?';
      params.push(from);
    }
    if (to) {
      dateFilterSessions += ' AND s.created_at <= ?';
      params.push(to);
    }

    const appearances = db.prepare(`
      SELECT c.model_normalized_name as model,
             COUNT(*) as appearances,
             SUM(CASE WHEN c.status = 'done' THEN 1 ELSE 0 END) as successCount,
             SUM(CASE WHEN c.status = 'error' THEN 1 ELSE 0 END) as errorCount,
             AVG(CASE WHEN c.latency_ms IS NOT NULL THEN c.latency_ms END) as avgLatencyMs
      FROM arena_battle_candidates c
      JOIN arena_battle_sessions s ON s.id = c.session_id
      WHERE s.status = 'completed' ${dateFilterSessions}
      GROUP BY c.model_normalized_name
    `).all(...params) as any[];

    let selFilter = '';
    const selParams: any[] = [];
    if (from) {
      selFilter += ' AND sel.created_at >= ?';
      selParams.push(from);
    }
    if (to) {
      selFilter += ' AND sel.created_at <= ?';
      selParams.push(to);
    }

    const selections = db.prepare(`
      SELECT sel.selected_model_normalized_name as model, COUNT(*) as selections
      FROM arena_battle_selections sel
      WHERE 1=1 ${selFilter}
      GROUP BY sel.selected_model_normalized_name
    `).all(...selParams) as any[];

    const selMap = new Map(selections.map((r) => [r.model, r.selections as number]));

    const rows = appearances.map((a) => {
      const picks = selMap.get(a.model) || 0;
      const apps = a.appearances as number;
      return {
        modelNormalizedName: a.model,
        appearances: apps,
        selections: picks,
        selectionRate: apps > 0 ? picks / apps : 0,
        successCount: a.successCount,
        errorCount: a.errorCount,
        avgLatencyMs: a.avgLatencyMs != null ? Math.round(a.avgLatencyMs) : null,
      };
    });

    // Include models that only have selections? already in appearances for completed
    rows.sort((a, b) => b.selections - a.selections || b.selectionRate - a.selectionRate);

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/arena/stats/summary */
router.get('/stats/summary', (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const totalBattles = (db.prepare('SELECT COUNT(*) as n FROM arena_battle_sessions').get() as any).n;
    const completedBattles = (db.prepare(
      `SELECT COUNT(*) as n FROM arena_battle_sessions WHERE status = 'completed'`
    ).get() as any).n;
    const awaiting = (db.prepare(
      `SELECT COUNT(*) as n FROM arena_battle_sessions WHERE status = 'awaiting_selection'`
    ).get() as any).n;
    const totalSelections = (db.prepare('SELECT COUNT(*) as n FROM arena_battle_selections').get() as any).n;

    const top = db.prepare(`
      SELECT selected_model_normalized_name as model, COUNT(*) as selections
      FROM arena_battle_selections
      GROUP BY selected_model_normalized_name
      ORDER BY selections DESC
      LIMIT 5
    `).all();

    const today = new Date().toISOString().slice(0, 10);
    const battlesToday = (db.prepare(
      `SELECT COUNT(*) as n FROM arena_battle_sessions WHERE created_at >= ?`
    ).get(today) as any).n;

    const promptCount = (db.prepare('SELECT COUNT(*) as n FROM arena_prompts').get() as any).n;
    const setCount = (db.prepare('SELECT COUNT(*) as n FROM arena_prompt_sets').get() as any).n;
    const expCount = (db.prepare('SELECT COUNT(*) as n FROM arena_prompt_experiments').get() as any).n;
    const benchCount = (db.prepare('SELECT COUNT(*) as n FROM arena_benchmark_runs').get() as any).n;

    res.json({
      success: true,
      data: {
        totalBattles,
        completedBattles,
        awaitingSelection: awaiting,
        totalSelections,
        battlesToday,
        topSelected: top,
        promptCount,
        setCount,
        experimentCount: expCount,
        benchmarkRunCount: benchCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Prompt library ----------

function mapPrompt(row: any) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    systemPrompt: row.system_prompt ?? row.systemPrompt ?? null,
    tags: JSON.parse(row.tags_json || row.tagsJson || '[]'),
    createdBy: row.created_by ?? row.createdBy ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

router.get('/prompts', (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, title, body, system_prompt, tags_json, created_by, created_at, updated_at
      FROM arena_prompts ORDER BY updated_at DESC
    `).all();
    res.json({ success: true, data: rows.map(mapPrompt) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/prompts', (req: AuthRequest, res: Response) => {
  try {
    const { title, body, systemPrompt, tags } = req.body || {};
    if (!title?.trim() || !body?.trim()) {
      res.status(400).json({ success: false, error: 'title and body are required' });
      return;
    }
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO arena_prompts (id, title, body, system_prompt, tags_json, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title.trim(),
      body.trim(),
      systemPrompt?.trim() || null,
      JSON.stringify(tags || []),
      req.user!.id,
      now,
      now
    );
    const row = db.prepare('SELECT * FROM arena_prompts WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: mapPrompt(row) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/prompts/:id', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM arena_prompts WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ success: false, error: 'Prompt not found' });
      return;
    }
    const { title, body, systemPrompt, tags } = req.body || {};
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE arena_prompts SET
        title = COALESCE(?, title),
        body = COALESCE(?, body),
        system_prompt = COALESCE(?, system_prompt),
        tags_json = COALESCE(?, tags_json),
        updated_at = ?
      WHERE id = ?
    `).run(
      title !== undefined ? title.trim() : null,
      body !== undefined ? body.trim() : null,
      systemPrompt !== undefined ? (systemPrompt || null) : null,
      tags !== undefined ? JSON.stringify(tags) : null,
      now,
      req.params.id
    );
    res.json({ success: true, data: mapPrompt(db.prepare('SELECT * FROM arena_prompts WHERE id = ?').get(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/prompts/:id', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const r = db.prepare('DELETE FROM arena_prompts WHERE id = ?').run(req.params.id);
    if (r.changes === 0) {
      res.status(404).json({ success: false, error: 'Prompt not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Prompt sets (for benchmarks) ----------

function getPromptSetDetail(setId: string) {
  const db = getDb();
  const set = db.prepare(`
    SELECT id, name, description, created_by as createdBy, created_at as createdAt
    FROM arena_prompt_sets WHERE id = ?
  `).get(setId) as any;
  if (!set) return null;
  const items = db.prepare(`
    SELECT p.id, p.title, p.body, p.system_prompt, p.tags_json, i.position
    FROM arena_prompt_set_items i
    JOIN arena_prompts p ON p.id = i.prompt_id
    WHERE i.set_id = ?
    ORDER BY i.position ASC
  `).all(setId) as any[];
  return {
    ...set,
    prompts: items.map((p) => ({
      ...mapPrompt(p),
      position: p.position,
    })),
  };
}

router.get('/prompt-sets', (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT s.id, s.name, s.description, s.created_by as createdBy, s.created_at as createdAt,
             (SELECT COUNT(*) FROM arena_prompt_set_items i WHERE i.set_id = s.id) as promptCount
      FROM arena_prompt_sets s
      ORDER BY s.created_at DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/prompt-sets/:id', (req: AuthRequest, res: Response) => {
  try {
    const detail = getPromptSetDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, error: 'Set not found' });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST { name, description?, promptIds?: string[] } */
router.post('/prompt-sets', (req: AuthRequest, res: Response) => {
  try {
    const { name, description, promptIds } = req.body || {};
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO arena_prompt_sets (id, name, description, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name.trim(), description?.trim() || null, req.user!.id, now);

    if (Array.isArray(promptIds)) {
      const ins = db.prepare(
        'INSERT INTO arena_prompt_set_items (set_id, prompt_id, position) VALUES (?, ?, ?)'
      );
      promptIds.forEach((pid: string, i: number) => {
        try {
          ins.run(id, pid, i);
        } catch {
          /* skip invalid */
        }
      });
    }

    res.status(201).json({ success: true, data: getPromptSetDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** PUT { name?, description?, promptIds?: string[] } — replace membership if promptIds given */
router.put('/prompt-sets/:id', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM arena_prompt_sets WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Set not found' });
      return;
    }
    const { name, description, promptIds } = req.body || {};
    if (name !== undefined || description !== undefined) {
      db.prepare(`
        UPDATE arena_prompt_sets SET
          name = COALESCE(?, name),
          description = COALESCE(?, description)
        WHERE id = ?
      `).run(
        name !== undefined ? name.trim() : null,
        description !== undefined ? description : null,
        req.params.id
      );
    }
    if (Array.isArray(promptIds)) {
      db.prepare('DELETE FROM arena_prompt_set_items WHERE set_id = ?').run(req.params.id);
      const ins = db.prepare(
        'INSERT INTO arena_prompt_set_items (set_id, prompt_id, position) VALUES (?, ?, ?)'
      );
      promptIds.forEach((pid: string, i: number) => {
        try {
          ins.run(req.params.id, pid, i);
        } catch {
          /* skip */
        }
      });
    }
    res.json({ success: true, data: getPromptSetDetail(req.params.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/prompt-sets/:id', (req: AuthRequest, res: Response) => {
  try {
    const r = getDb().prepare('DELETE FROM arena_prompt_sets WHERE id = ?').run(req.params.id);
    if (r.changes === 0) {
      res.status(404).json({ success: false, error: 'Set not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Prompt Lab experiments ----------

function getExperimentDetail(id: string) {
  const db = getDb();
  const exp = db.prepare(`
    SELECT id, mode, title, status, created_by as createdBy,
           created_at as createdAt, completed_at as completedAt
    FROM arena_prompt_experiments WHERE id = ?
  `).get(id) as any;
  if (!exp) return null;
  const cells = db.prepare(`
    SELECT id, experiment_id as experimentId, prompt_body as promptBody,
           system_prompt as systemPrompt, model_normalized_name as modelNormalizedName,
           content, status, latency_ms as latencyMs, error_message as errorMessage,
           model_used as modelUsed, selected, finished_at as finishedAt
    FROM arena_prompt_experiment_cells
    WHERE experiment_id = ?
    ORDER BY rowid ASC
  `).all(id) as any[];
  return {
    ...exp,
    cells: cells.map((c) => ({ ...c, selected: Boolean(c.selected) })),
  };
}

async function runExperimentCells(experimentId: string): Promise<void> {
  const db = getDb();
  db.prepare(`UPDATE arena_prompt_experiments SET status = 'running' WHERE id = ?`).run(experimentId);
  const cells = db.prepare(
    `SELECT id, prompt_body, system_prompt, model_normalized_name FROM arena_prompt_experiment_cells WHERE experiment_id = ? AND status = 'pending'`
  ).all(experimentId) as any[];

  // Limited concurrency for relay friendliness
  await mapPool(cells, arenaConcurrency(3), async (cell) => {
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (cell.system_prompt) {
      messages.push({ role: 'system', content: cell.system_prompt });
    }
    messages.push({ role: 'user', content: cell.prompt_body });
    const result = await invokeModel({
      modelNormalizedName: cell.model_normalized_name,
      messages,
    });
    const finished = new Date().toISOString();
    if (result.ok) {
      db.prepare(`
        UPDATE arena_prompt_experiment_cells
        SET status = 'done', content = ?, latency_ms = ?, model_used = ?, finished_at = ?, error_message = NULL
        WHERE id = ?
      `).run(result.content, result.latencyMs, result.modelUsed, finished, cell.id);
    } else {
      db.prepare(`
        UPDATE arena_prompt_experiment_cells
        SET status = 'error', error_message = ?, latency_ms = ?, finished_at = ?
        WHERE id = ?
      `).run(result.error, result.latencyMs, finished, cell.id);
    }
  });

  const pending = (db.prepare(
    `SELECT COUNT(*) as n FROM arena_prompt_experiment_cells WHERE experiment_id = ? AND status = 'pending'`
  ).get(experimentId) as any).n;
  const done = (db.prepare(
    `SELECT COUNT(*) as n FROM arena_prompt_experiment_cells WHERE experiment_id = ? AND status = 'done'`
  ).get(experimentId) as any).n;

  const status = pending > 0 ? 'running' : done > 0 ? 'completed' : 'failed';
  db.prepare(`
    UPDATE arena_prompt_experiments SET status = ?, completed_at = ? WHERE id = ?
  `).run(status, status === 'completed' || status === 'failed' ? new Date().toISOString() : null, experimentId);
}

/**
 * POST /api/arena/prompt-experiments
 * multi_model: { mode, title?, promptBody, systemPrompt?, models: string[] }
 * multi_prompt: { mode, title?, model, prompts: { body, systemPrompt? }[] }
 */
router.post('/prompt-experiments', async (req: AuthRequest, res: Response) => {
  try {
    const { mode, title, promptBody, systemPrompt, models, model, prompts, runImmediately = true } = req.body || {};
    if (mode !== 'multi_model' && mode !== 'multi_prompt') {
      res.status(400).json({ success: false, error: 'mode must be multi_model or multi_prompt' });
      return;
    }

    const db = getDb();
    const available = new Set(listAggregatedModels().map((m) => m.normalizedName));
    const cells: { promptBody: string; systemPrompt: string | null; model: string }[] = [];

    if (mode === 'multi_model') {
      if (!promptBody?.trim() || !Array.isArray(models) || models.length < 1) {
        res.status(400).json({ success: false, error: 'promptBody and models[] required' });
        return;
      }
      for (const m of models) {
        const n = normalizeModelName(m);
        if (!available.has(n)) {
          res.status(400).json({ success: false, error: `Model not available: ${n}` });
          return;
        }
        cells.push({ promptBody: promptBody.trim(), systemPrompt: systemPrompt?.trim() || null, model: n });
      }
    } else {
      if (!model || !Array.isArray(prompts) || prompts.length < 1) {
        res.status(400).json({ success: false, error: 'model and prompts[] required' });
        return;
      }
      const n = normalizeModelName(model);
      if (!available.has(n)) {
        res.status(400).json({ success: false, error: `Model not available: ${n}` });
        return;
      }
      for (const p of prompts) {
        if (!p?.body?.trim()) continue;
        cells.push({
          promptBody: p.body.trim(),
          systemPrompt: p.systemPrompt?.trim() || null,
          model: n,
        });
      }
      if (cells.length < 1) {
        res.status(400).json({ success: false, error: 'At least one prompt body required' });
        return;
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO arena_prompt_experiments (id, mode, title, status, created_by, created_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `).run(id, mode, title?.trim() || null, req.user!.id, now);

    const ins = db.prepare(`
      INSERT INTO arena_prompt_experiment_cells
        (id, experiment_id, prompt_body, system_prompt, model_normalized_name, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    for (const c of cells) {
      ins.run(uuidv4(), id, c.promptBody, c.systemPrompt, c.model);
    }

    if (runImmediately) {
      await runExperimentCells(id);
    }

    res.status(201).json({ success: true, data: getExperimentDetail(id) });
  } catch (err: any) {
    console.error('[arena] experiment error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/prompt-experiments', (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const db = getDb();
    const rows = db.prepare(`
      SELECT e.id, e.mode, e.title, e.status, e.created_by as createdBy,
             e.created_at as createdAt, e.completed_at as completedAt,
             (SELECT COUNT(*) FROM arena_prompt_experiment_cells c WHERE c.experiment_id = e.id) as cellCount
      FROM arena_prompt_experiments e
      ORDER BY e.created_at DESC
      LIMIT ?
    `).all(limit);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/prompt-experiments/:id', (req: AuthRequest, res: Response) => {
  try {
    const detail = getExperimentDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, error: 'Experiment not found' });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Prefer one cell (soft preference, not leaderboard) */
router.post('/prompt-experiments/:id/select-cell', (req: AuthRequest, res: Response) => {
  try {
    const { cellId } = req.body || {};
    if (!cellId) {
      res.status(400).json({ success: false, error: 'cellId required' });
      return;
    }
    const db = getDb();
    const cell = db.prepare(
      `SELECT id, status FROM arena_prompt_experiment_cells WHERE id = ? AND experiment_id = ?`
    ).get(cellId, req.params.id) as any;
    if (!cell) {
      res.status(404).json({ success: false, error: 'Cell not found' });
      return;
    }
    if (cell.status !== 'done') {
      res.status(400).json({ success: false, error: 'Can only prefer a successful cell' });
      return;
    }
    db.prepare(`UPDATE arena_prompt_experiment_cells SET selected = 0 WHERE experiment_id = ?`).run(req.params.id);
    db.prepare(`UPDATE arena_prompt_experiment_cells SET selected = 1 WHERE id = ?`).run(cellId);
    res.json({ success: true, data: getExperimentDetail(req.params.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Benchmarks ----------

function getBenchmarkRunDetail(runId: string) {
  const db = getDb();
  const run = db.prepare(`
    SELECT r.id, r.set_id as setId, r.name, r.status, r.model_list_json as modelListJson,
           r.created_by as createdBy, r.created_at as createdAt,
           r.started_at as startedAt, r.finished_at as finishedAt,
           s.name as setName
    FROM arena_benchmark_runs r
    LEFT JOIN arena_prompt_sets s ON s.id = r.set_id
    WHERE r.id = ?
  `).get(runId) as any;
  if (!run) return null;

  const results = db.prepare(`
    SELECT c.id, c.run_id as runId, c.prompt_id as promptId, c.model_normalized_name as modelNormalizedName,
           c.status, c.content, c.latency_ms as latencyMs, c.error_message as errorMessage,
           c.model_used as modelUsed, c.manual_verdict as manualVerdict, c.finished_at as finishedAt,
           p.title as promptTitle, p.body as promptBody
    FROM arena_benchmark_case_results c
    LEFT JOIN arena_prompts p ON p.id = c.prompt_id
    WHERE c.run_id = ?
    ORDER BY p.title, c.model_normalized_name
  `).all(runId) as any[];

  const summary = {
    total: results.length,
    done: results.filter((r) => r.status === 'done').length,
    error: results.filter((r) => r.status === 'error').length,
    pending: results.filter((r) => r.status === 'pending').length,
    pass: results.filter((r) => r.manualVerdict === 'pass').length,
    fail: results.filter((r) => r.manualVerdict === 'fail').length,
  };

  return {
    ...run,
    models: JSON.parse(run.modelListJson || '[]'),
    results,
    summary,
  };
}

async function executeBenchmarkRun(runId: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE arena_benchmark_runs SET status = 'running', started_at = ? WHERE id = ?`).run(now, runId);

  const pending = db.prepare(`
    SELECT id, prompt_id, model_normalized_name FROM arena_benchmark_case_results
    WHERE run_id = ? AND status = 'pending'
  `).all(runId) as any[];

  // Look up prompt bodies
  const promptCache = new Map<string, { body: string; system: string | null }>();
  const getPrompt = (pid: string) => {
    if (!promptCache.has(pid)) {
      const p = db.prepare('SELECT body, system_prompt FROM arena_prompts WHERE id = ?').get(pid) as any;
      promptCache.set(pid, p ? { body: p.body, system: p.system_prompt } : { body: '', system: null });
    }
    return promptCache.get(pid)!;
  };

  const queue = [...pending];
  await mapPool(queue, arenaConcurrency(2), async (item) => {
    const prompt = getPrompt(item.prompt_id);
    if (!prompt.body) {
      db.prepare(`
        UPDATE arena_benchmark_case_results SET status = 'skipped', error_message = 'prompt missing', finished_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), item.id);
      return;
    }
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (prompt.system) messages.push({ role: 'system', content: prompt.system });
    messages.push({ role: 'user', content: prompt.body });

    const result = await invokeModel({
      modelNormalizedName: item.model_normalized_name,
      messages,
    });
    const finished = new Date().toISOString();
    if (result.ok) {
      db.prepare(`
        UPDATE arena_benchmark_case_results
        SET status = 'done', content = ?, latency_ms = ?, model_used = ?, finished_at = ?, error_message = NULL
        WHERE id = ?
      `).run(result.content, result.latencyMs, result.modelUsed, finished, item.id);
    } else {
      db.prepare(`
        UPDATE arena_benchmark_case_results
        SET status = 'error', error_message = ?, latency_ms = ?, finished_at = ?
        WHERE id = ?
      `).run(result.error, result.latencyMs, finished, item.id);
    }
  });

  const left = (db.prepare(
    `SELECT COUNT(*) as n FROM arena_benchmark_case_results WHERE run_id = ? AND status = 'pending'`
  ).get(runId) as any).n;
  const done = (db.prepare(
    `SELECT COUNT(*) as n FROM arena_benchmark_case_results WHERE run_id = ? AND status = 'done'`
  ).get(runId) as any).n;

  const status = left > 0 ? 'running' : done > 0 ? 'completed' : 'failed';
  db.prepare(`
    UPDATE arena_benchmark_runs SET status = ?, finished_at = ? WHERE id = ?
  `).run(status, new Date().toISOString(), runId);
}

/**
 * POST /api/arena/benchmarks/runs
 * { setId, models: string[], name?, runImmediately?, async? }
 * async:true → return queued immediately and run in background
 */
router.post('/benchmarks/runs', async (req: AuthRequest, res: Response) => {
  try {
    const { setId, models, name, runImmediately = true, async: asyncRun = false } = req.body || {};
    if (!setId || !Array.isArray(models) || models.length < 1) {
      res.status(400).json({ success: false, error: 'setId and models[] required' });
      return;
    }

    const db = getDb();
    const set = db.prepare('SELECT id, name FROM arena_prompt_sets WHERE id = ?').get(setId) as any;
    if (!set) {
      res.status(404).json({ success: false, error: 'Prompt set not found' });
      return;
    }

    const prompts = db.prepare(
      'SELECT prompt_id FROM arena_prompt_set_items WHERE set_id = ? ORDER BY position'
    ).all(setId) as { prompt_id: string }[];
    if (prompts.length === 0) {
      res.status(400).json({ success: false, error: 'Prompt set is empty' });
      return;
    }

    const available = new Set(listAggregatedModels().map((m) => m.normalizedName));
    const modelList = [...new Set(models.map((m: string) => normalizeModelName(m)))];
    for (const m of modelList) {
      if (!available.has(m)) {
        res.status(400).json({ success: false, error: `Model not available: ${m}` });
        return;
      }
    }

    const runId = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO arena_benchmark_runs (id, set_id, name, status, model_list_json, created_by, created_at)
      VALUES (?, ?, ?, 'queued', ?, ?, ?)
    `).run(runId, setId, name?.trim() || set.name, JSON.stringify(modelList), req.user!.id, now);

    const ins = db.prepare(`
      INSERT INTO arena_benchmark_case_results
        (id, run_id, prompt_id, model_normalized_name, status, manual_verdict)
      VALUES (?, ?, ?, ?, 'pending', 'unset')
    `);
    for (const p of prompts) {
      for (const m of modelList) {
        ins.run(uuidv4(), runId, p.prompt_id, m);
      }
    }

    const shouldRun = runImmediately !== false;
    if (shouldRun && asyncRun) {
      // Fire-and-forget background job
      setImmediate(() => {
        executeBenchmarkRun(runId).catch((err) => {
          console.error('[arena] background benchmark failed', runId, err);
        });
      });
      res.status(202).json({
        success: true,
        data: getBenchmarkRunDetail(runId),
        meta: { async: true, estimatedCalls: prompts.length * modelList.length },
      });
      return;
    }

    if (shouldRun) {
      await executeBenchmarkRun(runId);
    }

    res.status(201).json({ success: true, data: getBenchmarkRunDetail(runId) });
  } catch (err: any) {
    console.error('[arena] benchmark run error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/benchmarks/runs', (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const db = getDb();
    const rows = db.prepare(`
      SELECT r.id, r.set_id as setId, r.name, r.status, r.model_list_json as modelListJson,
             r.created_at as createdAt, r.finished_at as finishedAt, s.name as setName,
             (SELECT COUNT(*) FROM arena_benchmark_case_results c WHERE c.run_id = r.id) as caseCount,
             (SELECT COUNT(*) FROM arena_benchmark_case_results c WHERE c.run_id = r.id AND c.status = 'done') as doneCount
      FROM arena_benchmark_runs r
      LEFT JOIN arena_prompt_sets s ON s.id = r.set_id
      ORDER BY r.created_at DESC
      LIMIT ?
    `).all(limit);
    res.json({
      success: true,
      data: rows.map((r: any) => ({
        ...r,
        models: JSON.parse(r.modelListJson || '[]'),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/benchmarks/runs/:id', (req: AuthRequest, res: Response) => {
  try {
    const detail = getBenchmarkRunDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, error: 'Run not found' });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** PATCH /api/arena/benchmarks/results/:id  { manualVerdict: pass|fail|skip|unset } */
router.patch('/benchmarks/results/:id', (req: AuthRequest, res: Response) => {
  try {
    const { manualVerdict } = req.body || {};
    const allowed = ['unset', 'pass', 'fail', 'skip'];
    if (!allowed.includes(manualVerdict)) {
      res.status(400).json({ success: false, error: 'manualVerdict must be unset|pass|fail|skip' });
      return;
    }
    const db = getDb();
    const row = db.prepare('SELECT id, run_id FROM arena_benchmark_case_results WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      res.status(404).json({ success: false, error: 'Result not found' });
      return;
    }
    db.prepare('UPDATE arena_benchmark_case_results SET manual_verdict = ? WHERE id = ?').run(manualVerdict, req.params.id);
    res.json({ success: true, data: getBenchmarkRunDetail(row.run_id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- CSV exports ----------

/** GET /api/arena/export/leaderboard.csv */
router.get('/export/leaderboard.csv', (req: AuthRequest, res: Response) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : null;
    const to = typeof req.query.to === 'string' ? req.query.to : null;
    const db = getDb();

    let dateFilterSessions = '';
    const params: any[] = [];
    if (from) {
      dateFilterSessions += ' AND s.created_at >= ?';
      params.push(from);
    }
    if (to) {
      dateFilterSessions += ' AND s.created_at <= ?';
      params.push(to);
    }

    const appearances = db.prepare(`
      SELECT c.model_normalized_name as model,
             COUNT(*) as appearances,
             SUM(CASE WHEN c.status = 'done' THEN 1 ELSE 0 END) as successCount,
             SUM(CASE WHEN c.status = 'error' THEN 1 ELSE 0 END) as errorCount,
             AVG(CASE WHEN c.latency_ms IS NOT NULL THEN c.latency_ms END) as avgLatencyMs
      FROM arena_battle_candidates c
      JOIN arena_battle_sessions s ON s.id = c.session_id
      WHERE s.status = 'completed' ${dateFilterSessions}
      GROUP BY c.model_normalized_name
    `).all(...params) as any[];

    let selFilter = '';
    const selParams: any[] = [];
    if (from) {
      selFilter += ' AND sel.created_at >= ?';
      selParams.push(from);
    }
    if (to) {
      selFilter += ' AND sel.created_at <= ?';
      selParams.push(to);
    }
    const selections = db.prepare(`
      SELECT sel.selected_model_normalized_name as model, COUNT(*) as selections
      FROM arena_battle_selections sel
      WHERE 1=1 ${selFilter}
      GROUP BY sel.selected_model_normalized_name
    `).all(...selParams) as any[];
    const selMap = new Map(selections.map((r) => [r.model, r.selections as number]));

    const rows = appearances
      .map((a) => {
        const picks = selMap.get(a.model) || 0;
        const apps = a.appearances as number;
        return [
          a.model,
          picks,
          apps,
          apps > 0 ? (picks / apps).toFixed(4) : '0',
          a.successCount,
          a.errorCount,
          a.avgLatencyMs != null ? Math.round(a.avgLatencyMs) : '',
        ];
      })
      .sort((a, b) => Number(b[1]) - Number(a[1]));

    sendCsv(
      res,
      'arena-leaderboard.csv',
      toCsv(
        ['model', 'selections', 'appearances', 'selection_rate', 'success_count', 'error_count', 'avg_latency_ms'],
        rows
      )
    );
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/arena/export/battles.csv */
router.get('/export/battles.csv', (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const sessions = db.prepare(`
      SELECT s.id, s.question_text, s.status, s.reveal_mode, s.created_at, s.completed_at,
             sel.selected_model_normalized_name as selected_model
      FROM arena_battle_sessions s
      LEFT JOIN arena_battle_selections sel ON sel.session_id = s.id
      ORDER BY s.created_at DESC
      LIMIT 2000
    `).all() as any[];

    const candStmt = db.prepare(`
      SELECT model_normalized_name, status, latency_ms, substr(content, 1, 500) as content_preview
      FROM arena_battle_candidates WHERE session_id = ? ORDER BY position
    `);

    const rows: unknown[][] = [];
    for (const s of sessions) {
      const cands = candStmt.all(s.id) as any[];
      if (cands.length === 0) {
        rows.push([s.id, s.created_at, s.status, s.question_text, s.selected_model || '', '', '', '', '']);
        continue;
      }
      for (const c of cands) {
        rows.push([
          s.id,
          s.created_at,
          s.status,
          s.question_text,
          s.selected_model || '',
          c.model_normalized_name,
          c.status,
          c.latency_ms ?? '',
          c.content_preview || '',
        ]);
      }
    }

    sendCsv(
      res,
      'arena-battles.csv',
      toCsv(
        [
          'session_id',
          'created_at',
          'status',
          'question',
          'selected_model',
          'candidate_model',
          'candidate_status',
          'latency_ms',
          'content_preview',
        ],
        rows
      )
    );
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/arena/export/benchmarks/:runId.csv */
router.get('/export/benchmarks/:runId.csv', (req: AuthRequest, res: Response) => {
  try {
    const detail = getBenchmarkRunDetail(req.params.runId);
    if (!detail) {
      res.status(404).json({ success: false, error: 'Run not found' });
      return;
    }
    const rows = (detail.results || []).map((r: any) => [
      detail.id,
      detail.name || '',
      detail.setName || detail.setId,
      r.promptId,
      r.promptTitle || '',
      r.modelNormalizedName,
      r.status,
      r.manualVerdict,
      r.latencyMs ?? '',
      r.errorMessage || '',
      (r.content || '').slice(0, 2000),
    ]);
    sendCsv(
      res,
      `arena-benchmark-${req.params.runId.slice(0, 8)}.csv`,
      toCsv(
        [
          'run_id',
          'run_name',
          'set_name',
          'prompt_id',
          'prompt_title',
          'model',
          'status',
          'manual_verdict',
          'latency_ms',
          'error',
          'content',
        ],
        rows
      )
    );
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/arena/export/experiments/:id.csv */
router.get('/export/experiments/:id.csv', (req: AuthRequest, res: Response) => {
  try {
    const detail = getExperimentDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, error: 'Experiment not found' });
      return;
    }
    const rows = detail.cells.map((c: any) => [
      detail.id,
      detail.mode,
      detail.status,
      c.modelNormalizedName,
      c.promptBody,
      c.status,
      c.selected ? 1 : 0,
      c.latencyMs ?? '',
      c.errorMessage || '',
      (c.content || '').slice(0, 2000),
    ]);
    sendCsv(
      res,
      `arena-experiment-${req.params.id.slice(0, 8)}.csv`,
      toCsv(
        [
          'experiment_id',
          'mode',
          'status',
          'model',
          'prompt',
          'cell_status',
          'preferred',
          'latency_ms',
          'error',
          'content',
        ],
        rows
      )
    );
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
