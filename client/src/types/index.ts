// ============================================================
// Shared TypeScript types for the frontend
// ============================================================

export type ModelCapability = 'text' | 'vision' | 'image-gen' | 'code' | 'tts' | 'embedding';

export interface Station {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Alias used by settings admin model picker */
export type StationModelRow = StationModel;

export interface StationModel {
  id: string;
  stationId: string;
  modelId: string;
  displayName: string;
  capabilities: ModelCapability[] | string[];
  /** Selected into admin pool (admin can use) */
  adminEnabled?: boolean;
  /** When true, model is exposed to end-user home selector */
  enabled: boolean;
  publicEnabled?: boolean;
  createdAt: string;
}

export interface UsageLogItem {
  id: string;
  userId?: string | null;
  username?: string | null;
  role?: string | null;
  kind: string;
  modelNormalized?: string | null;
  modelUsed?: string | null;
  stationId?: string | null;
  stationName?: string | null;
  conversationId?: string | null;
  status: string;
  httpStatus?: number | null;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  createdAt: string;
}

export interface UsageUserAgg {
  userId?: string | null;
  username?: string | null;
  requests: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  errors: number;
}
export interface UsageModelAgg {
  modelNormalized?: string | null;
  requests: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
}
export interface UsageSummary {
  byUser: UsageUserAgg[];
  byModel: UsageModelAgg[];
  totals: { requests: number; tokens: number; errors: number; users: number };
}


export interface AggregatedModel {
  displayName: string;
  normalizedName: string;
  capabilities: ModelCapability[];
  stations: { stationId: string; stationName: string; modelId: string; healthy: boolean }[];
}

/** Team-shared reusable persona from the persona library (§10.8 Phase 4). */
export interface Persona {
  id: string;
  title: string;
  body: string;
  description: string | null;
  createdBy: string | null;
  ownerUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ConversationVisibility = 'public' | 'private';

export interface Conversation {
  id: string;
  title: string;
  modelNormalizedName: string;
  visibility: ConversationVisibility;
  selfReview: boolean;
  systemPrompt?: string | null;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  toolCalls?: ToolCallInfo[];
  modelUsed?: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  messageId?: string;
  type: 'image' | 'file';
  filename: string;
  mimeType: string;
  url: string;
}

export interface MemoryEntry {
  id: string;
  conversationId: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
  keywords: string[];
  tags: string[];
  embedding?: number[];
  modelUsed?: string;
  importance: number;
  userId?: string | null;
  username?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryConfig {
  autoSave: boolean;
  contextInjection: boolean;
  maxContextMemories: number;
  retentionDays: number;
  semanticSearch: boolean;
  autoSummarize: boolean;
  summarizeThreshold: number;
  embeddingApiBaseUrl?: string | null;
  embeddingApiKey?: string | null;
  embeddingModel?: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateStationRequest {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface UpdateStationRequest {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  enabled?: boolean;
}

export interface ChatRequest {
  conversationId: string;
  modelNormalizedName: string;
  message: string;
  attachments?: { filename: string; mimeType: string; base64: string }[];
  fileIds?: string[];
}

export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string; // for images
  base64?: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

// --- MCP ---

export interface McpServer {
  id: string;
  name: string;
  url: string;
  description: string | null;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'unknown';
  lastConnected: string | null;
  createdAt: string;
  updatedAt: string;
  toolCount?: number;
}

export interface McpTool {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface CreateMcpServerRequest {
  name: string;
  url: string;
  description?: string;
}

export interface UpdateMcpServerRequest {
  name?: string;
  url?: string;
  description?: string;
  enabled?: boolean;
}

export interface PaginatedResponse<T> {
  entries: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- User & Auth ---

export type UserRole = 'admin' | 'user';

export interface UserPublic {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  /** System seat-filler for group create; cannot log in. */
  isVirtual?: boolean;
  /** Monthly token cap (0 = unlimited). Admin-set. */
  monthlyTokenLimit?: number;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  displayName?: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  displayName?: string;
  role?: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
  mode?: 'username' | 'phone';
}

export interface AuthResponse {
  token: string;
  user: UserPublic;
}

export interface UpdateUserRequest {
  email?: string;
  phone?: string;
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
  monthlyTokenLimit?: number;
}

// --- File Library ---

export interface FileFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileLibraryEntry {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  fileSize: number;
  chunkCount: number;
  status: 'processing' | 'ready' | 'error';
  errorMessage: string | null;
  folderId: string | null;
  uploadedBy: string | null;
  /** 'private' = only the uploader + admins; 'team' = shared with everyone. */
  visibility: 'private' | 'team';
  createdAt: string;
  updatedAt: string;
}

export interface FileLibraryResponse {
  folders: FileFolder[];
  files: FileLibraryEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FileSearchResult {
  chunkId: string;
  fileId: string;
  fileName: string;
  content: string;
  similarity: number;
}

// --- Regex Scripts & Presets ---

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
  ownerUsername?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegexPreset {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  ownerUsername?: string;
  isDefault: boolean;
  scripts?: RegexScript[];
  createdAt: string;
  updatedAt: string;
}

export interface RegexTestResult {
  result: string;
  matches: number;
  error?: string;
}

export interface RegexExportData {
  version: number;
  preset: { name: string; description?: string };
  scripts: {
    name: string;
    findPattern: string;
    replacement: string;
    flags: string;
    placement: 'input' | 'output' | 'both';
    enabled: boolean;
    order: number;
  }[];
}

// --- Arena (admin battle / eval) ---

export interface ArenaModelRow {
  normalizedName: string;
  displayName: string;
  capabilities: ModelCapability[];
  stationCount: number;
  eligibleBattle: boolean;
  eligibleBenchmark: boolean;
  tags: string[];
  notes: string | null;
  isActive: boolean;
  hasProfile: boolean;
}

export type BattleStatus =
  | 'pending'
  | 'running'
  | 'awaiting_selection'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface BattleCandidate {
  id: string;
  sessionId: string;
  modelNormalizedName: string;
  stationId?: string | null;
  position: number;
  status: 'pending' | 'streaming' | 'done' | 'error';
  content?: string | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
  modelUsed?: string | null;
  finishedAt?: string | null;
  _hidden?: boolean;
}

export interface BattleSelection {
  id: string;
  sessionId: string;
  selectedCandidateId: string;
  selectedModelNormalizedName: string;
  selectorUserId?: string;
  createdAt: string;
}

export interface BattleDetail {
  id: string;
  questionText: string;
  promptId?: string | null;
  status: BattleStatus;
  revealMode: 'hidden_until_pick' | 'always_show_names';
  createdBy?: string;
  createdAt: string;
  completedAt?: string | null;
  candidates: BattleCandidate[];
  selection: BattleSelection | null;
}

export interface BattleListItem {
  id: string;
  questionText: string;
  status: BattleStatus;
  revealMode: string;
  createdBy?: string;
  createdAt: string;
  completedAt?: string | null;
  selectedModel?: string | null;
  candidateCount: number;
}

export interface LeaderboardRow {
  modelNormalizedName: string;
  appearances: number;
  selections: number;
  selectionRate: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number | null;
}

export interface ArenaStatsSummary {
  totalBattles: number;
  completedBattles: number;
  awaitingSelection: number;
  totalSelections: number;
  battlesToday: number;
  topSelected: { model: string; selections: number }[];
  promptCount?: number;
  setCount?: number;
  experimentCount?: number;
  benchmarkRunCount?: number;
}

export interface ArenaPrompt {
  id: string;
  title: string;
  body: string;
  systemPrompt?: string | null;
  tags: string[];
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string;
  position?: number;
}

export interface ArenaPromptSet {
  id: string;
  name: string;
  description?: string | null;
  createdBy?: string;
  createdAt: string;
  promptCount?: number;
  prompts?: ArenaPrompt[];
}

export interface PromptExperimentCell {
  id: string;
  experimentId: string;
  promptBody: string;
  systemPrompt?: string | null;
  modelNormalizedName: string;
  content?: string | null;
  status: 'pending' | 'done' | 'error';
  latencyMs?: number | null;
  errorMessage?: string | null;
  modelUsed?: string | null;
  selected: boolean;
  finishedAt?: string | null;
}

export interface PromptExperiment {
  id: string;
  mode: 'multi_model' | 'multi_prompt';
  title?: string | null;
  status: string;
  createdBy?: string;
  createdAt: string;
  completedAt?: string | null;
  cells: PromptExperimentCell[];
  cellCount?: number;
}

export interface BenchmarkCaseResult {
  id: string;
  runId: string;
  promptId: string;
  modelNormalizedName: string;
  status: 'pending' | 'done' | 'error' | 'skipped';
  content?: string | null;
  latencyMs?: number | null;
  errorMessage?: string | null;
  modelUsed?: string | null;
  manualVerdict: 'unset' | 'pass' | 'fail' | 'skip';
  finishedAt?: string | null;
  promptTitle?: string;
  promptBody?: string;
}

export interface BenchmarkRun {
  id: string;
  setId: string;
  setName?: string;
  name?: string | null;
  status: string;
  models: string[];
  createdBy?: string;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  caseCount?: number;
  doneCount?: number;
  results?: BenchmarkCaseResult[];
  summary?: {
    total: number;
    done: number;
    error: number;
    pending: number;
    pass: number;
    fail: number;
  };
}

// --- §10.6 Collaborative group chat + shared Group AI ---

export type RoomAiState = 'idle' | 'occupying_input' | 'ai_running';

export interface RoomMemberInfo {
  userId: string;
  role: 'owner' | 'member';
  username: string;
  displayName: string | null;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  memberCap: number;
  chatModel: string | null;
  imageModel: string | null;
  ttsModel: string | null;
  modelLockedUntil: string | null;
  aiState: RoomAiState;
  occupantUserId: string | null;
  occupancyUntil: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  members?: RoomMemberInfo[];
}

export interface RoomMessage {
  id: string;
  userId: string | null;
  username?: string;
  displayName?: string | null;
  kind: 'text' | 'ai_stub' | 'system';
  content: string;
  aiMessageId?: string | null;
  attachments: { name: string; mimeType?: string; url?: string }[];
  createdAt: string;
}

export interface RoomAiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  authorId?: string | null;
  authorName?: string | null;
  status: 'thinking' | 'streaming' | 'done' | 'error';
  errorMessage?: string | null;
  modelUsed?: string | null;
  fileIds?: string[];
  createdAt: string;
}

export interface RoomFile {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy?: string | null;
  createdAt: string;
}

/** §10.6.14 Group notepad (pinned sticky note) + edit-permission flow. */
export interface RoomNotepadRequest {
  id: string;
  userId?: string;
  username?: string;
  displayName?: string | null;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
}

export interface RoomNotepad {
  content: string;
  updatedBy: string | null;
  updatedAt: string | null;
  /** Whether the current caller may edit (owner or granted editor). */
  canEdit: boolean;
  /** Whether the current caller is the room owner. */
  isOwner: boolean;
  /** Member ids granted edit rights (owner is implicit, not listed). */
  editors: string[];
  /** Owner: all pending requests. Member: their own latest request (0-1). */
  requests: RoomNotepadRequest[];
}
