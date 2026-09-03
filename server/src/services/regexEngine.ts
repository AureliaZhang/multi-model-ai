import type Database from 'better-sqlite3';
import type { RegexScriptRow, RegexPresetRow, ConversationPresetRow } from '../dbRows';
import { getErrorMessage } from '../utils/errors';
import { runRegexWithTimeout, RegexTimeoutError } from './regexSafety';

// ============================================================
// Regex Engine — applies regex scripts to message text
// ============================================================

export interface RegexScript {
  id: string;
  name: string;
  findPattern: string;
  replacement: string;
  flags: string;
  placement: 'input' | 'output' | 'both';
  enabled: boolean;
  order: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

function rowToRegexScript(row: RegexScriptRow): RegexScript {
  return {
    id: row.id,
    name: row.name,
    findPattern: row.find_pattern,
    replacement: row.replacement,
    flags: row.flags,
    placement: row.placement as RegexScript['placement'],
    enabled: row.enabled === 1,
    order: row.script_order ?? row.order ?? 0,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Apply all enabled regex scripts to text.
 *
 * 每个脚本都在 worker 线程里限时执行（v0.8.1）。这些 pattern 是用户自己存的，
 * 一个 `(a+)+b` 会让**每一次聊天**都把事件循环焊死 —— 全站瘫掉且不自愈。
 * 单个脚本超时就跳过它、保留上一步的结果，继续跑后面的：聊天不该因为一条坏
 * 脚本整个失败。
 *
 * @param scripts - Array of enabled, ordered scripts
 * @param text - The text to transform
 * @param placement - Which placement context: 'input' or 'output'
 * @returns Transformed text
 */
export async function applyRegexScripts(
  scripts: RegexScript[],
  text: string,
  placement: 'input' | 'output'
): Promise<string> {
  let result = text;
  const applicable = scripts
    .filter(s => s.enabled && (s.placement === 'both' || s.placement === placement))
    .sort((a, b) => a.order - b.order);

  for (const script of applicable) {
    try {
      const run = await runRegexWithTimeout(
        script.findPattern,
        script.flags,
        script.replacement,
        result
      );
      if (run.error) {
        console.warn(`[regex] Invalid regex in script "${script.name}": ${script.findPattern} — ${run.error}`);
        continue;
      }
      result = run.result;
    } catch (err) {
      if (err instanceof RegexTimeoutError) {
        console.warn(`[regex] Script "${script.name}" timed out and was skipped: ${script.findPattern}`);
      } else {
        console.warn(`[regex] Script "${script.name}" failed: ${getErrorMessage(err)}`);
      }
    }
  }
  return result;
}

/**
 * Fetch active regex scripts for a user and conversation.
 * Resolution order:
 *   1. Active preset for the conversation
 *   2. User's default preset
 *   3. All enabled scripts for the user
 */
export function getActiveScripts(
  db: Database.Database,
  userId: string | null,
  conversationId: string
): RegexScript[] {
  // 1. Check if conversation has an active preset
  const presetRow = db.prepare(
    'SELECT preset_id FROM conversation_preset WHERE conversation_id = ?'
  ).get(conversationId) as ConversationPresetRow | undefined;

  if (presetRow?.preset_id) {
    const rows = db.prepare(`
      SELECT rs.*, ps.script_order as "order"
      FROM regex_scripts rs
      JOIN preset_scripts ps ON ps.script_id = rs.id
      WHERE ps.preset_id = ? AND rs.enabled = 1
      ORDER BY ps.script_order ASC
    `).all(presetRow.preset_id) as RegexScriptRow[];
    if (rows.length > 0) return rows.map(rowToRegexScript);
  }

  // 2. Fallback: load user's default preset scripts
  if (userId) {
    const defaultPreset = db.prepare(
      'SELECT id FROM regex_presets WHERE user_id = ? AND is_default = 1'
    ).get(userId) as RegexPresetRow | undefined;

    if (defaultPreset) {
      const rows = db.prepare(`
        SELECT rs.*, ps.script_order as "order"
        FROM regex_scripts rs
        JOIN preset_scripts ps ON ps.script_id = rs.id
        WHERE ps.preset_id = ? AND rs.enabled = 1
        ORDER BY ps.script_order ASC
      `).all(defaultPreset.id) as RegexScriptRow[];
      if (rows.length > 0) return rows.map(rowToRegexScript);
    }
  }

  // 3. Ultimate fallback: all enabled scripts for the user
  if (userId) {
    const rows = db.prepare(`
      SELECT * FROM regex_scripts
      WHERE user_id = ? AND enabled = 1
      ORDER BY script_order ASC
    `).all(userId) as RegexScriptRow[];
    return rows.map(rowToRegexScript);
  }

  return [];
}
