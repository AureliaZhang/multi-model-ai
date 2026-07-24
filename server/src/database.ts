import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { runMigrations, type Migration } from './migrations';
import { encryptSecret, isEncrypted, encryptionEnabled } from './utils/crypto';
import { getErrorMessage } from './utils/errors';

export const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

let db: Database.Database;

/**
 * Ordered, append-only schema migration list (§10.8 Phase 2). Applied by
 * `runMigrations` via the `schema_migrations` ledger — each entry runs exactly
 * once, ever, in a transaction.
 *
 * v1 "baseline-schema" is the ENTIRE pre-migration-runner schema (`initTables`,
 * which is fully idempotent: CREATE TABLE IF NOT EXISTS + guarded ALTERs). It
 * therefore safely absorbs BOTH a brand-new DB and any existing production DB
 * created before the ledger existed (the guarded ALTERs no-op on columns that
 * are already there), then records itself as v1.
 *
 * From here on, EVERY schema change is a NEW entry (v2, v3, …) with a single-run
 * `up` — never edit v1, never add another swallow-everything `try { ALTER }`.
 */
export const SCHEMA_MIGRATIONS: Migration[] = [
  { version: 1, name: 'baseline-schema', up: (d) => initTables(d) },
  // v2: per-user monthly token quota (§10.8 Phase 3). 0 = unlimited (no cap).
  // First real incremental migration on top of the baseline — single-run, recorded.
  {
    version: 2,
    name: 'users-monthly-token-limit',
    up: (d) => d.exec(`ALTER TABLE users ADD COLUMN monthly_token_limit INTEGER NOT NULL DEFAULT 0`),
  },
  // v3: shared persona / system-prompt library (§10.8 Phase 4 FE-B). Team-visible
  // reusable roles ("文案","代码审查","翻译") a member applies to a conversation in
  // one click. Distinct from arena_prompts (admin battle tooling) and from the
  // per-conversation conversations.system_prompt (v0.7.33) this library feeds into.
  {
    version: 3,
    name: 'persona-library',
    up: (d) =>
      d.exec(`
        CREATE TABLE IF NOT EXISTS persona_library (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          description TEXT,
          created_by TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_persona_library_created ON persona_library(created_at);
      `),
  },
  // v4: per-file visibility for the "default-private, opt-in team-shared" file
  // library (§10.8 Phase 4 FE-B + TC0 #4). New uploads default to 'private' (only
  // the uploader + admins see them); a member may flip a file to 'team' to share
  // it with everyone. EXISTING files are migrated to 'team' so the current
  // team-wide-readable behaviour is preserved (nothing suddenly disappears);
  // only NEW uploads after this migration start out private.
  {
    version: 4,
    name: 'file-library-visibility',
    up: (d) => {
      d.exec(
        `ALTER TABLE file_library ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','team'))`
      );
      // Preserve prior behaviour: everything that already existed stays visible team-wide.
      d.exec(`UPDATE file_library SET visibility = 'team'`);
      d.exec(`CREATE INDEX IF NOT EXISTS idx_file_library_visibility ON file_library(visibility)`);
    },
  },
  // v5: cache extracted text per attachment (§10.8 TC2 #1 perf). Non-image
  // attachments (PDF/text/code) were re-extracted on EVERY chat turn — a PDF in
  // turn 1 got re-parsed (CPU-blocking pdf-parse) on turns 2..N. We now extract
  // once and store the result here; historical turns read the column instead of
  // re-parsing. NULL = not yet extracted (lazily filled on first use); empty
  // string is a valid "extracted, but no text" result (distinct from NULL).
  {
    version: 5,
    name: 'attachments-extracted-text-cache',
    up: (d) => d.exec(`ALTER TABLE attachments ADD COLUMN extracted_text TEXT`),
  },
];

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');
    runMigrations(db, SCHEMA_MIGRATIONS);
    // Per-boot reconciliation (NOT a migration — must run every start; see fn doc).
    refreshModelCapabilities(db);
    seedDefaultAdmin(db);
    seedVirtualPlaceholderUser(db);
    seedDefaultStation(db);
    // If ENCRYPTION_KEY is configured, upgrade any legacy plaintext station keys
    // to ciphertext in place (self-healing whenever the key is first set).
    encryptPlaintextStationKeys(db);
  }
  return db;
}

/** The v1 "baseline" schema (see `SCHEMA_MIGRATIONS`): creates every table and
 *  runs the idempotent column back-fills. Pure DDL — no seeding, no requires —
 *  so it is safe to run against a fresh (including in-memory) DB and idempotent
 *  against an existing one. Exported for tests. */
export function initTables(db: Database.Database): void {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Stations table
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      health_status TEXT NOT NULL DEFAULT 'unknown',
      last_health_check TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Station models table
    CREATE TABLE IF NOT EXISTS station_models (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      capabilities TEXT NOT NULL DEFAULT '["text"]',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
    );

    -- Conversations table
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      model_normalized_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      model_used TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    -- Attachments table
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('image', 'file')),
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      url TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    -- Memory entries table
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      summary TEXT,
      keywords TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      embedding TEXT,
      model_used TEXT,
      importance REAL NOT NULL DEFAULT 0.5,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Memory tags table
    CREATE TABLE IF NOT EXISTS memory_tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      entry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Memory config table (single row)
    CREATE TABLE IF NOT EXISTS memory_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      auto_save INTEGER NOT NULL DEFAULT 1,
      context_injection INTEGER NOT NULL DEFAULT 1,
      max_context_memories INTEGER NOT NULL DEFAULT 5,
      retention_days INTEGER NOT NULL DEFAULT 0,
      semantic_search INTEGER NOT NULL DEFAULT 0,
      auto_summarize INTEGER NOT NULL DEFAULT 0,
      summarize_threshold INTEGER NOT NULL DEFAULT 20
    );

    -- Insert default memory config if not exists
    INSERT OR IGNORE INTO memory_config (id) VALUES (1);

    -- MCP Servers table
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('connected', 'disconnected', 'error', 'unknown')),
      last_connected TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- MCP Tools table (cached from MCP servers)
    CREATE TABLE IF NOT EXISTS mcp_tools (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      input_schema TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
    );

    -- File Folders table
    CREATE TABLE IF NOT EXISTS file_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES file_folders(id) ON DELETE CASCADE
    );

    -- File Library table
    CREATE TABLE IF NOT EXISTS file_library (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'ready', 'error')),
      error_message TEXT,
      folder_id TEXT,
      uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (folder_id) REFERENCES file_folders(id) ON DELETE SET NULL
    );

    -- File Chunks table
    CREATE TABLE IF NOT EXISTS file_chunks (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT,
      token_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (file_id) REFERENCES file_library(id) ON DELETE CASCADE
    );

    -- Regex Scripts table
    CREATE TABLE IF NOT EXISTS regex_scripts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      find_pattern TEXT NOT NULL,
      replacement TEXT NOT NULL DEFAULT '',
      flags TEXT NOT NULL DEFAULT 'g',
      placement TEXT NOT NULL DEFAULT 'both' CHECK(placement IN ('input', 'output', 'both')),
      enabled INTEGER NOT NULL DEFAULT 1,
      script_order INTEGER NOT NULL DEFAULT 0,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Regex Presets table
    CREATE TABLE IF NOT EXISTS regex_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Preset-Scripts junction table
    CREATE TABLE IF NOT EXISTS preset_scripts (
      preset_id TEXT NOT NULL REFERENCES regex_presets(id) ON DELETE CASCADE,
      script_id TEXT NOT NULL REFERENCES regex_scripts(id) ON DELETE CASCADE,
      script_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (preset_id, script_id)
    );

    -- Conversation-Preset active mapping
    CREATE TABLE IF NOT EXISTS conversation_preset (
      conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
      preset_id TEXT REFERENCES regex_presets(id) ON DELETE SET NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_station_models_station ON station_models(station_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
    CREATE INDEX IF NOT EXISTS idx_memory_conversation ON memory_entries(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_mcp_tools_server ON mcp_tools(server_id);
    CREATE INDEX IF NOT EXISTS idx_file_chunks_file ON file_chunks(file_id);
    CREATE INDEX IF NOT EXISTS idx_regex_scripts_user ON regex_scripts(user_id);
    CREATE INDEX IF NOT EXISTS idx_regex_presets_user ON regex_presets(user_id);
    CREATE INDEX IF NOT EXISTS idx_preset_scripts_preset ON preset_scripts(preset_id);
    CREATE INDEX IF NOT EXISTS idx_conversation_preset ON conversation_preset(conversation_id);
  `);

  // Migration: add user_id column to conversations if not exists
  try {
    db.exec(`ALTER TABLE conversations ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL`);
  } catch {
    // Column already exists
  }

  // Migration: add visibility column to conversations if not exists
  try {
    db.exec(`ALTER TABLE conversations ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'`);
  } catch {
    // Column already exists
  }

  // Migration: add self_review column to conversations if not exists
  try {
    db.exec(`ALTER TABLE conversations ADD COLUMN self_review INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists
  }

  // Migration: add system_prompt column to conversations if not exists
  // Per-conversation persona / system instruction injected as the leading system message.
  try {
    db.exec(`ALTER TABLE conversations ADD COLUMN system_prompt TEXT`);
  } catch {
    // Column already exists
  }

  // Migration: add phone column to users if not exists
  try {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
  } catch {
    // Column already exists
  }

  // Dual-layer model visibility: admin pool vs public
  // admin_enabled = selected for admin use; enabled = public to end users
  try {
    db.exec(`ALTER TABLE station_models ADD COLUMN admin_enabled INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // exists
  }
  // Backfill: previously "enabled" meant exposed; keep that meaning for public.
  // Ensure admin_enabled is at least as broad as public (if public, admin can use too).
  try {
    db.exec(`UPDATE station_models SET admin_enabled = 1 WHERE enabled = 1 AND (admin_enabled IS NULL OR admin_enabled = 0)`);
  } catch {
    /* ignore */
  }

  // API usage logs for admin audit
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      role TEXT,
      kind TEXT NOT NULL DEFAULT 'chat',
      model_normalized TEXT,
      model_used TEXT,
      station_id TEXT,
      station_name TEXT,
      conversation_id TEXT,
      status TEXT NOT NULL DEFAULT 'ok',
      http_status INTEGER,
      error_message TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      latency_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_usage_created ON api_usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_user ON api_usage_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_status ON api_usage_logs(status);
    CREATE INDEX IF NOT EXISTS idx_usage_model ON api_usage_logs(model_normalized);
  `);

  // Migration: add folder_id column to file_library if not exists
  try {
    db.exec(`ALTER TABLE file_library ADD COLUMN folder_id TEXT REFERENCES file_folders(id) ON DELETE SET NULL`);
  } catch {
    // Column already exists
  }

  // Migration: add user_id column to memory_entries if not exists
  try {
    db.exec(`ALTER TABLE memory_entries ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL`);
  } catch {
    // Column already exists
  }

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_visibility ON conversations(visibility)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_file_folders_parent ON file_folders(parent_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_file_library_folder ON file_library(folder_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_user ON memory_entries(user_id)`);

  // Migration: add embedding API config columns to memory_config
  try { db.exec(`ALTER TABLE memory_config ADD COLUMN embedding_api_base_url TEXT`); } catch { /* Column already exists */ }
  try { db.exec(`ALTER TABLE memory_config ADD COLUMN embedding_api_key TEXT`); } catch { /* Column already exists */ }
  try { db.exec(`ALTER TABLE memory_config ADD COLUMN embedding_model TEXT`); } catch { /* Column already exists */ }

  // --- Arena (model battle / eval) tables ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS arena_model_profiles (
      id TEXT PRIMARY KEY,
      model_normalized_name TEXT NOT NULL UNIQUE,
      display_label TEXT,
      eligible_battle INTEGER NOT NULL DEFAULT 1,
      eligible_benchmark INTEGER NOT NULL DEFAULT 1,
      tags_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS arena_battle_sessions (
      id TEXT PRIMARY KEY,
      question_text TEXT NOT NULL,
      prompt_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','running','awaiting_selection','completed','cancelled','failed')),
      reveal_mode TEXT NOT NULL DEFAULT 'always_show_names'
        CHECK(reveal_mode IN ('hidden_until_pick','always_show_names')),
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS arena_battle_candidates (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      model_normalized_name TEXT NOT NULL,
      station_id TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','streaming','done','error')),
      content TEXT,
      error_message TEXT,
      latency_ms INTEGER,
      model_used TEXT,
      finished_at TEXT,
      FOREIGN KEY (session_id) REFERENCES arena_battle_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS arena_battle_selections (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      selected_candidate_id TEXT NOT NULL,
      selected_model_normalized_name TEXT NOT NULL,
      selector_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES arena_battle_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (selected_candidate_id) REFERENCES arena_battle_candidates(id) ON DELETE CASCADE,
      FOREIGN KEY (selector_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_arena_candidates_session ON arena_battle_candidates(session_id);
    CREATE INDEX IF NOT EXISTS idx_arena_selections_model ON arena_battle_selections(selected_model_normalized_name);
    CREATE INDEX IF NOT EXISTS idx_arena_sessions_status ON arena_battle_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_arena_sessions_created ON arena_battle_sessions(created_at);

    -- Prompt library
    CREATE TABLE IF NOT EXISTS arena_prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      system_prompt TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS arena_prompt_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS arena_prompt_set_items (
      set_id TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (set_id, prompt_id),
      FOREIGN KEY (set_id) REFERENCES arena_prompt_sets(id) ON DELETE CASCADE,
      FOREIGN KEY (prompt_id) REFERENCES arena_prompts(id) ON DELETE CASCADE
    );

    -- Prompt Lab experiments
    CREATE TABLE IF NOT EXISTS arena_prompt_experiments (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK(mode IN ('multi_model','multi_prompt')),
      title TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','running','completed','failed','cancelled')),
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS arena_prompt_experiment_cells (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      prompt_body TEXT NOT NULL,
      system_prompt TEXT,
      model_normalized_name TEXT NOT NULL,
      content TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','done','error')),
      latency_ms INTEGER,
      error_message TEXT,
      model_used TEXT,
      selected INTEGER NOT NULL DEFAULT 0,
      finished_at TEXT,
      FOREIGN KEY (experiment_id) REFERENCES arena_prompt_experiments(id) ON DELETE CASCADE
    );

    -- Benchmark runs
    CREATE TABLE IF NOT EXISTS arena_benchmark_runs (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'queued'
        CHECK(status IN ('queued','running','completed','failed','cancelled')),
      model_list_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY (set_id) REFERENCES arena_prompt_sets(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS arena_benchmark_case_results (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      model_normalized_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','done','error','skipped')),
      content TEXT,
      latency_ms INTEGER,
      error_message TEXT,
      model_used TEXT,
      manual_verdict TEXT NOT NULL DEFAULT 'unset'
        CHECK(manual_verdict IN ('unset','pass','fail','skip')),
      finished_at TEXT,
      FOREIGN KEY (run_id) REFERENCES arena_benchmark_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (prompt_id) REFERENCES arena_prompts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_arena_exp_cells ON arena_prompt_experiment_cells(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_arena_bench_results_run ON arena_benchmark_case_results(run_id);
    CREATE INDEX IF NOT EXISTS idx_arena_bench_runs_status ON arena_benchmark_runs(status);

    -- Per-user default models (chat / image / tts) + daily modal prefs
    CREATE TABLE IF NOT EXISTS user_model_prefs (
      user_id TEXT PRIMARY KEY,
      chat_model TEXT,
      image_model TEXT,
      tts_model TEXT,
      skip_daily_modal INTEGER NOT NULL DEFAULT 0,
      last_modal_date TEXT,
      auto_tts INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ============================================================
    -- §10.6 Collaborative group chat + shared Group AI
    -- Left track = human social; right track = shared AI thread.
    -- ============================================================

    -- A group room (WeChat-style). Owner = creator (immutable).
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      member_cap INTEGER NOT NULL DEFAULT 10,
      -- group model prefs (one AI per group)
      chat_model TEXT,
      image_model TEXT,
      tts_model TEXT,
      -- shared 5-min cooldown for model changes (whole group)
      model_locked_until TEXT,
      -- room AI task state machine: idle | occupying_input | ai_running
      ai_state TEXT NOT NULL DEFAULT 'idle'
        CHECK(ai_state IN ('idle','occupying_input','ai_running')),
      -- who currently holds the @AI input lock (occupying_input)
      occupant_user_id TEXT,
      occupancy_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Room membership. Owner also has a row here (role='owner').
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Left track: human-to-human messages. AI NEVER reads these.
    -- kind='text' normal chat; kind='ai_stub' = short "X asked AI ..." marker.
    CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT,
      kind TEXT NOT NULL DEFAULT 'text' CHECK(kind IN ('text','ai_stub','system')),
      content TEXT NOT NULL DEFAULT '',
      -- for ai_stub: link to the right-track ai message it summarizes
      ai_message_id TEXT,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Right track: the shared Group AI thread. Only these are sent to the model.
    CREATE TABLE IF NOT EXISTS room_ai_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL DEFAULT '',
      -- who delivered this (for role='user')
      author_id TEXT,
      author_name TEXT,
      -- generation status for assistant rows
      status TEXT NOT NULL DEFAULT 'done'
        CHECK(status IN ('thinking','streaming','done','error')),
      error_message TEXT,
      model_used TEXT,
      -- file ids referenced from the group KB for this delivery
      file_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Group knowledge base files (only this group's AI may read them).
    CREATE TABLE IF NOT EXISTS room_files (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      uploaded_by TEXT,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      content TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    -- §10.6.14 Group notepad (pinned sticky note). One row per room.
    -- Owner can always edit; other members need a granted edit right (below).
    CREATE TABLE IF NOT EXISTS room_notepad (
      room_id TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_by TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Members granted continuous notepad edit rights (owner is implicit, no row).
    CREATE TABLE IF NOT EXISTS room_notepad_editors (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Edit-permission requests: a member asks the owner for edit rights.
    CREATE TABLE IF NOT EXISTS room_notepad_requests (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_room_ai_messages_room ON room_ai_messages(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_room_files_room ON room_files(room_id);
    CREATE INDEX IF NOT EXISTS idx_room_notepad_editors_room ON room_notepad_editors(room_id);
    CREATE INDEX IF NOT EXISTS idx_room_notepad_requests_room ON room_notepad_requests(room_id, status);
  `);
}

/**
 * Per-boot reconciliation of `station_models.capabilities` with the
 * `detectCapabilities()` heuristics. Kept OUT of the versioned baseline
 * migration on purpose: seeded / freshly-pulled rows may carry only `["text"]`,
 * and this must re-run on EVERY boot to refine them (a one-time migration would
 * miss rows seeded after it ran). Guarded so a require cycle during first load
 * is a harmless no-op.
 */
function refreshModelCapabilities(db: Database.Database): void {
  try {
    const { detectCapabilities } = require('./routes/stations');
    const rows = db.prepare('SELECT id, model_id FROM station_models').all() as { id: string; model_id: string }[];
    const upd = db.prepare('UPDATE station_models SET capabilities = ? WHERE id = ?');
    for (const r of rows) {
      upd.run(JSON.stringify(detectCapabilities(r.model_id)), r.id);
    }
  } catch {
    /* ignore if circular during first load */
  }
}

/**
 * One-way upgrade of any plaintext station API keys to encrypted-at-rest
 * (§10.8 TC1 #3). No-op unless `ENCRYPTION_KEY` is set. Runs every boot so it
 * self-heals the first time the key is configured; already-encrypted rows are
 * left untouched. Wrapped in a transaction; failures are logged, not fatal.
 */
function encryptPlaintextStationKeys(db: Database.Database): void {
  if (!encryptionEnabled()) return;
  try {
    const rows = db.prepare('SELECT id, api_key FROM stations').all() as { id: string; api_key: string }[];
    const plaintext = rows.filter((r) => !isEncrypted(r.api_key));
    if (plaintext.length === 0) return;
    const upd = db.prepare('UPDATE stations SET api_key = ? WHERE id = ?');
    db.transaction(() => {
      for (const r of plaintext) upd.run(encryptSecret(r.api_key), r.id);
    })();
    console.log(`🔐 Encrypted ${plaintext.length} plaintext station key(s) at rest`);
  } catch (err) {
    console.error('[crypto] station key encryption sweep failed:', getErrorMessage(err));
  }
}

function seedDefaultAdmin(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!existing) {
    const { v4: uuidv4 } = require('uuid');
    const envPassword = process.env.ADMIN_PASSWORD?.trim();
    // Fresh production start must set an explicit admin password.
    if (!envPassword && process.env.NODE_ENV === 'production') {
      throw new Error('[security] No admin user exists and ADMIN_PASSWORD is not set. Set ADMIN_PASSWORD before first start in production.');
    }
    const password = envPassword || 'admin123';
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), 'admin', 'admin@localhost', passwordHash, 'Administrator', 'admin');
    if (envPassword) {
      console.log('🔑 Default admin user created (username: admin, password: from ADMIN_PASSWORD env)');
    } else {
      console.warn('🔑 Default admin created (username: admin, password: admin123) — CHANGE THIS. Set ADMIN_PASSWORD to override.');
    }
  }
}

/**
 * Always-on seat filler for group create when no real peer is ready yet.
 * Random password hash — login is also blocked in auth routes.
 */
function seedVirtualPlaceholderUser(db: Database.Database): void {
  const {
    VIRTUAL_PLACEHOLDER_USER_ID,
    VIRTUAL_PLACEHOLDER_USERNAME,
    VIRTUAL_PLACEHOLDER_DISPLAY_NAME,
  } = require('./virtualUser');

  const existing = db
    .prepare('SELECT id FROM users WHERE id = ? OR username = ?')
    .get(VIRTUAL_PLACEHOLDER_USER_ID, VIRTUAL_PLACEHOLDER_USERNAME);
  if (existing) return;

  // Unusable password (random hash); auth also rejects this username/id.
  const passwordHash = bcrypt.hashSync(`vp-${Date.now()}-${Math.random()}`, 10);
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name, role, is_active)
    VALUES (?, ?, ?, ?, ?, 'user', 1)
  `).run(
    VIRTUAL_PLACEHOLDER_USER_ID,
    VIRTUAL_PLACEHOLDER_USERNAME,
    null,
    passwordHash,
    VIRTUAL_PLACEHOLDER_DISPLAY_NAME
  );
  console.log('👤 Virtual placeholder user seeded (invite-only seat filler, cannot log in)');
}

/**
 * Optional first-run seed for a default relay station.
 *
 * NEVER hardcode API keys in source — they end up in git history.
 * Provide credentials via env when you want a seeded station:
 *   MIMO_BASE_URL  (default: https://token-plan-ams.xiaomimimo.com/v1)
 *   MIMO_API_KEY   (required to seed; if missing, seed is skipped)
 *
 * Existing local DBs already seeded earlier keep their rows; this only runs
 * when no station named "mimo" exists yet.
 */
function seedDefaultStation(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM stations WHERE name = ?').get('mimo');
  if (existing) return;

  const apiKey = (process.env.MIMO_API_KEY || '').trim();
  if (!apiKey) {
    // Clean install without secrets: admin adds stations via Settings UI.
    return;
  }

  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();
  const stationId = uuidv4();
  const baseUrl = (process.env.MIMO_BASE_URL || 'https://token-plan-ams.xiaomimimo.com/v1').trim();

  db.prepare(`
    INSERT INTO stations (id, name, base_url, api_key, enabled, health_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'unknown', ?, ?)
  `).run(stationId, 'mimo', baseUrl, encryptSecret(apiKey), now, now);

  // Seed known models (ids only — no secrets)
  const models = [
    'mimo-v2-omni', 'mimo-v2-pro', 'mimo-v2-tts',
    'mimo-v2.5', 'mimo-v2.5-asr', 'mimo-v2.5-pro',
    'mimo-v2.5-tts', 'mimo-v2.5-tts-voiceclone', 'mimo-v2.5-tts-voicedesign',
  ];
  const insert = db.prepare(
    'INSERT INTO station_models (id, station_id, model_id, display_name, capabilities, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  for (const modelId of models) {
    insert.run(uuidv4(), stationId, modelId, modelId, '["text"]', now);
  }

  db.prepare('UPDATE stations SET health_status = ?, last_health_check = ? WHERE id = ?')
    .run('healthy', now, stationId);

  console.log('🌐 Default mimo station seeded with ' + models.length + ' models (key from MIMO_API_KEY env)');
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
