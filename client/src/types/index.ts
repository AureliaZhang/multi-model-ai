// ============================================================
// Shared TypeScript types for the frontend
// ============================================================

export type ModelCapability = 'text' | 'vision' | 'image-gen' | 'code';

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

export interface StationModel {
  id: string;
  stationId: string;
  modelId: string;
  displayName: string;
  capabilities: ModelCapability[];
  enabled: boolean;
  createdAt: string;
}

export interface AggregatedModel {
  displayName: string;
  normalizedName: string;
  capabilities: ModelCapability[];
  stations: { stationId: string; stationName: string; modelId: string; healthy: boolean }[];
}

export type ConversationVisibility = 'public' | 'private';

export interface Conversation {
  id: string;
  title: string;
  modelNormalizedName: string;
  visibility: ConversationVisibility;
  selfReview: boolean;
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
