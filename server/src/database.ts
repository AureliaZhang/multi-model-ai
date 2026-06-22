import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables(db);
    seedDefaultAdmin(db);
    seedDefaultStation(db);
  }
  return db;
}

function initTables(db: Database.Database): void {
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
      uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  // Migration: add phone column to users if not exists
  try {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
  } catch {
    // Column already exists
  }

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_visibility ON conversations(visibility)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
}

function seedDefaultAdmin(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!existing) {
    const { v4: uuidv4 } = require('uuid');
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), 'admin', 'admin@localhost', passwordHash, 'Administrator', 'admin');
    console.log('🔑 Default admin user created (username: admin, password: admin123)');
  }
}

function seedDefaultStation(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM stations WHERE name = ?').get('mimo');
  if (!existing) {
    const { v4: uuidv4 } = require('uuid');
    const now = new Date().toISOString();
    const stationId = uuidv4();
    db.prepare(`
      INSERT INTO stations (id, name, base_url, api_key, enabled, health_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, 'unknown', ?, ?)
    `).run(stationId, 'mimo', 'https://token-plan-ams.xiaomimimo.com/v1', 'tp-ezxquyluif0136bh28ke2j9k2131q1nce4ywsg70znqkdeuh', now, now);

    // Seed known models
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

    // Mark as healthy since we pre-seeded the models
    db.prepare('UPDATE stations SET health_status = ?, last_health_check = ? WHERE id = ?')
      .run('healthy', now, stationId);

    console.log('🌐 Default mimo station seeded with ' + models.length + ' models');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
