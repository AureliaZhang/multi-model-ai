/**
 * SQLite row shapes (snake_case, as better-sqlite3 returns them).
 *
 * Domain/API types in `types.ts` stay camelCase; route mappers convert Row → domain.
 * Only covers tables typed in the P2 row-cast sweep so far — expand as files are cleaned.
 */

// --- conversations / messages ---

export interface ConversationRow {
  id: string;
  title: string;
  model_normalized_name: string;
  /** Added by migration; always present after initTables. */
  visibility: string;
  /** 0 | 1 integer flag */
  self_review: number;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  model_used: string | null;
  created_at: string;
}

/** Import payload entry (camelCase, from export JSON or bare array). */
export interface ConversationImportItem {
  id?: string;
  title?: string;
  modelNormalizedName?: string;
  visibility?: string;
  selfReview?: boolean;
  createdAt?: string;
  updatedAt?: string;
  messages?: MessageImportItem[];
}

export interface MessageImportItem {
  id?: string;
  role?: string;
  content?: string | null;
  modelUsed?: string | null;
  createdAt?: string;
}

// --- stations / station_models ---

export interface StationRow {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  enabled: number;
  health_status: string;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
}

export interface StationModelRow {
  id: string;
  station_id: string;
  model_id: string;
  display_name: string;
  /** JSON string, e.g. '["text","vision"]' */
  capabilities: string;
  /** Public pool: 0 | 1 */
  enabled: number;
  /** Admin pool; migration default 1. May be absent on very old rows before migration runs. */
  admin_enabled?: number | null;
  created_at: string;
}

// --- rooms (§10.6) ---

export type RoomAiState = 'idle' | 'occupying_input' | 'ai_running';

export interface RoomRow {
  id: string;
  name: string;
  owner_id: string;
  member_cap: number;
  chat_model: string | null;
  image_model: string | null;
  tts_model: string | null;
  model_locked_until: string | null;
  ai_state: RoomAiState | string;
  occupant_user_id: string | null;
  occupancy_until: string | null;
  created_at: string;
  updated_at: string;
}

/** List query joins member count. */
export interface RoomListRow extends RoomRow {
  memberCount: number;
}

export interface RoomMemberInfoRow {
  userId: string;
  role: string;
  username: string;
  displayName: string | null;
}

// --- memory store ---

export interface MemoryEntryRow {
  id: string;
  conversation_id: string;
  message_id: string;
  role: string;
  content: string;
  summary: string | null;
  /** JSON string array */
  keywords: string;
  /** JSON string array */
  tags: string;
  /** JSON string of number[] or null/empty */
  embedding: string | null;
  model_used: string | null;
  importance: number;
  /** Migration column */
  user_id?: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Join alias from `LEFT JOIN users u ON me.user_id = u.id`
   * (`u.username as user_username`). Not a physical column.
   */
  user_username?: string | null;
}

export interface MemoryTagRow {
  id: string;
  name: string;
  color: string | null;
  entry_count: number;
  created_at: string;
}

export interface MemoryConfigRow {
  id: number;
  auto_save: number;
  context_injection: number;
  max_context_memories: number;
  retention_days: number;
  semantic_search: number;
  auto_summarize: number;
  summarize_threshold: number;
  embedding_api_base_url?: string | null;
  embedding_api_key?: string | null;
  embedding_model?: string | null;
}

// --- file library ---

export interface FileFolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileLibraryRow {
  id: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  file_size: number;
  chunk_count: number;
  status: string;
  error_message: string | null;
  folder_id: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Chunk list omits embedding for bandwidth (see GET /files/:id/chunks). */
export interface FileChunkListRow {
  id: string;
  file_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  created_at: string;
}

// --- regex scripts / presets ---

export interface RegexScriptRow {
  id: string;
  name: string;
  find_pattern: string;
  replacement: string;
  flags: string;
  placement: string;
  enabled: number;
  script_order: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  /**
   * When joined with preset_scripts, routes often SELECT
   * `ps.script_order as "order"` — optional extra field.
   */
  order?: number;
  /** Join alias from users.username (admin list all scripts). */
  owner_username?: string | null;
}

export interface RegexPresetRow {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  is_default: number;
  created_at: string;
  updated_at: string;
  /** Join alias from users.username when admin lists all presets */
  owner_username?: string | null;
}

export interface ConversationPresetRow {
  conversation_id: string;
  preset_id: string | null;
}

// --- rooms join / list projections (API-facing aliases) ---

/** GET /rooms/:id/messages — already camelCased in SQL. */
export interface RoomMessageListRow {
  id: string;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  kind: string;
  content: string;
  aiMessageId: string | null;
  attachmentsJson: string;
  createdAt: string;
}

/** GET /rooms/:id/ai — already camelCased in SQL. */
export interface RoomAiMessageListRow {
  id: string;
  role: string;
  content: string;
  authorId: string | null;
  authorName: string | null;
  status: string;
  errorMessage: string | null;
  modelUsed: string | null;
  fileIdsJson: string;
  createdAt: string;
}

export interface RoomFileRow {
  id: string;
  room_id: string;
  uploaded_by: string | null;
  original_name: string;
  mime_type: string;
  file_size: number;
  content?: string | null;
  created_at: string;
}

/** Invite picker user row (camelCased aliases). */
export interface InviteUserRow {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  isActive: number;
}

// --- MCP ---

export interface McpServerRow {
  id: string;
  name: string;
  url: string;
  description: string | null;
  enabled: number;
  status: string;
  last_connected: string | null;
  created_at: string;
  updated_at: string;
  /** From COUNT join on list endpoint */
  tool_count?: number;
}

export interface McpToolRow {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
  /** JSON string */
  input_schema: string;
  enabled: number;
  created_at: string;
}

// --- station join used by model routers ---

/** SELECT sm.model_id, s.id, s.name, s.base_url, s.api_key, s.health_status, s.enabled */
export interface StationModelJoinRow {
  model_id: string;
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  health_status: string;
  enabled: number;
}

// --- users / auth / prefs / usage / models list projections ---

/** SELECT with camelCase aliases (users list / get / auth login). */
export interface UserPublicRow {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  role: string;
  isActive: number | boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt?: string;
  /** auth login only */
  passwordHash?: string;
}

export interface UserModelPrefsRow {
  userId: string;
  chatModel: string | null;
  imageModel: string | null;
  ttsModel: string | null;
  skipDailyModal: number;
  lastModalDate: string | null;
  autoTts: number;
  updatedAt: string;
}

export interface UsageLogListRow {
  id: string;
  userId: string | null;
  username: string | null;
  role: string | null;
  kind: string;
  modelNormalized: string | null;
  modelUsed: string | null;
  stationId: string | null;
  stationName: string | null;
  conversationId: string | null;
  status: string;
  httpStatus: number | null;
  errorMessage: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  createdAt: string;
}

/** Aggregated models list join. */
export interface AggregatedModelSourceRow {
  model_id: string;
  display_name: string;
  capabilities: string;
  enabled: number;
  admin_enabled: number;
  station_id: string;
  station_name: string;
  health_status: string;
  base_url?: string;
}

export interface FileChunkSearchRow {
  chunk_id: string;
  file_id: string;
  content: string;
  embedding: string | null;
  original_name: string;
}


// --- arena (mostly camelCase SQL aliases) ---

export interface ArenaBattleSessionRow {
  id: string;
  questionText: string;
  promptId: string | null;
  status: string;
  revealMode: string;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ArenaBattleCandidateRow {
  id: string;
  sessionId: string;
  modelNormalizedName: string;
  stationId: string | null;
  position: number;
  status: string;
  content: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  modelUsed: string | null;
  finishedAt: string | null;
}

export interface ArenaBattleSelectionRow {
  id: string;
  sessionId: string;
  selectedCandidateId: string;
  selectedModelNormalizedName: string;
  selectorUserId: string | null;
  createdAt: string;
}

export interface ArenaModelProfileRow {
  id: string;
  modelNormalizedName: string;
  displayLabel: string | null;
  eligibleBattle: number;
  eligibleBenchmark: number;
  tagsJson: string;
  notes: string | null;
  isActive: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Physical snake_case from SELECT * / mapPrompt. */
export interface ArenaPromptRow {
  id: string;
  title: string;
  body: string;
  system_prompt: string | null;
  tags_json: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Allow camel aliases if a query already aliases */
  systemPrompt?: string | null;
  tagsJson?: string;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArenaPromptSetRow {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  promptCount?: number;
}

export interface ArenaPromptSetItemJoinRow {
  id: string;
  title: string;
  body: string;
  system_prompt: string | null;
  tags_json: string;
  position: number;
}

export interface ArenaExperimentRow {
  id: string;
  mode: string;
  title: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
  cellCount?: number;
}

export interface ArenaExperimentCellRow {
  id: string;
  experimentId: string;
  promptBody: string;
  systemPrompt: string | null;
  modelNormalizedName: string;
  content: string | null;
  status: string;
  latencyMs: number | null;
  errorMessage: string | null;
  modelUsed: string | null;
  selected: number;
  finishedAt: string | null;
}

export interface ArenaBenchmarkRunRow {
  id: string;
  setId: string;
  name: string | null;
  status: string;
  modelListJson: string;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  caseCount?: number;
  doneCount?: number;
}

export interface ArenaBenchmarkCaseRow {
  id: string;
  runId: string;
  promptId: string;
  modelNormalizedName: string;
  status: string;
  content: string | null;
  latencyMs: number | null;
  errorMessage: string | null;
  modelUsed: string | null;
  manualVerdict: string;
  finishedAt: string | null;
}

export interface CountRow {
  n: number;
}

/** Appearances aggregate from leaderboard SQL. */
export interface LeaderboardAppearanceRow {
  model: string;
  appearances: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number | null;
}

/** @deprecated name kept for imports that only need model+count — use LeaderboardAppearanceRow for full. */
export interface LeaderboardModelRow {
  model: string;
  appearances?: number;
  selections?: number;
  successCount?: number;
  errorCount?: number;
  avgLatencyMs?: number | null;
  battles?: number;
  rate?: number;
}

export interface SelectionCountRow {
  model: string;
  selections: number;
}
