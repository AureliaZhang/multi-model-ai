import type Database from 'better-sqlite3';

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

function rowToRegexScript(row: any): RegexScript {
  return {
    id: row.id,
    name: row.name,
    findPattern: row.find_pattern,
    replacement: row.replacement,
    flags: row.flags,
    placement: row.placement,
    enabled: row.enabled === 1,
    order: row.script_order ?? row.order ?? 0,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Apply all enabled regex scripts to text.
 * @param scripts - Array of enabled, ordered scripts
 * @param text - The text to transform
 * @param placement - Which placement context: 'input' or 'output'
 * @returns Transformed text
 */
export function applyRegexScripts(
  scripts: RegexScript[],
  text: string,
  placement: 'input' | 'output'
): string {
  let result = text;
  const applicable = scripts
    .filter(s => s.enabled && (s.placement === 'both' || s.placement === placement))
    .sort((a, b) => a.order - b.order);

  for (const script of applicable) {
    try {
      const regex = new RegExp(script.findPattern, script.flags);
      result = result.replace(regex, script.replacement);
    } catch (err) {
      console.warn(`[regex] Invalid regex in script "${script.name}": ${script.findPattern}`, err);
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
  ).get(conversationId) as any;

  if (presetRow?.preset_id) {
    const rows = db.prepare(`
      SELECT rs.*, ps.script_order as "order"
      FROM regex_scripts rs
      JOIN preset_scripts ps ON ps.script_id = rs.id
      WHERE ps.preset_id = ? AND rs.enabled = 1
      ORDER BY ps.script_order ASC
    `).all(presetRow.preset_id) as any[];
    if (rows.length > 0) return rows.map(rowToRegexScript);
  }

  // 2. Fallback: load user's default preset scripts
  if (userId) {
    const defaultPreset = db.prepare(
      'SELECT id FROM regex_presets WHERE user_id = ? AND is_default = 1'
    ).get(userId) as any;

    if (defaultPreset) {
      const rows = db.prepare(`
        SELECT rs.*, ps.script_order as "order"
        FROM regex_scripts rs
        JOIN preset_scripts ps ON ps.script_id = rs.id
        WHERE ps.preset_id = ? AND rs.enabled = 1
        ORDER BY ps.script_order ASC
      `).all(defaultPreset.id) as any[];
      if (rows.length > 0) return rows.map(rowToRegexScript);
    }
  }

  // 3. Ultimate fallback: all enabled scripts for the user
  if (userId) {
    const rows = db.prepare(`
      SELECT * FROM regex_scripts
      WHERE user_id = ? AND enabled = 1
      ORDER BY script_order ASC
    `).all(userId) as any[];
    return rows.map(rowToRegexScript);
  }

  return [];
}

/**
 * Test regex on sample text (dry run).
 */
export function testRegex(
  pattern: string,
  flags: string,
  replacement: string,
  testText: string
): { result: string; matches: number; error?: string } {
  try {
    const regex = new RegExp(pattern, flags);
    let matchCount = 0;
    const result = testText.replace(regex, (...args) => {
      matchCount++;
      // Support $1, $2, etc. in replacement
      return replacement.replace(/\$(\d+)/g, (_, idx) => {
        const groupIdx = parseInt(idx, 10);
        return args[groupIdx] ?? '';
      });
    });
    return { result, matches: matchCount };
  } catch (err: any) {
    return { result: testText, matches: 0, error: err.message };
  }
}
