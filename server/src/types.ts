// ============================================================
// Shared TypeScript types for the Multi-Model AI Integration Platform
// ============================================================

import { Request } from 'express';

// --- User & Auth ---

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  mode?: 'username' | 'phone'; // If specified, restrict which field to match
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

export interface AuthRequest extends Request {
  user?: UserPublic;
}

// --- Station & Model ---

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

export type ModelCapability = 'text' | 'vision' | 'image-gen' | 'code';

export interface AggregatedModel {
  displayName: string;
  normalizedName: string;
  capabilities: ModelCapability[];
  stations: { stationId: string; stationName: string; modelId: string; healthy: boolean }[];
}

// --- Conversation & Message ---

export type ConversationVisibility = 'public' | 'private';

export interface Conversation {
  id: string;
  title: string;
  modelNormalizedName: string;
  visibility: ConversationVisibility;
  selfReview: boolean;
  systemPrompt?: string | null;
  userId?: string;
  /** Pinned conversations sort first in the sidebar (migration v6). */
  pinned: boolean;
  /** Sidebar folder label; null = not in a folder (migration v6). */
  folder?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  modelUsed?: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  messageId: string;
  type: 'image' | 'file';
  filename: string;
  mimeType: string;
  url: string;
}

// --- Memory Store ---

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

export interface MemoryTag {
  id: string;
  name: string;
  color?: string;
  entryCount: number;
  createdAt: string;
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

// --- API Request/Response ---

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

// --- MCP (Model Context Protocol) ---

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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
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
  /** 'private' = only the uploader + admins; 'team' = everyone. */
  visibility: 'private' | 'team';
  createdAt: string;
  updatedAt: string;
}

export interface FileChunk {
  id: string;
  fileId: string;
  chunkIndex: number;
  content: string;
  embedding: string | null;
  tokenCount: number;
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface RegexPreset {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  isDefault: boolean;
  scripts?: RegexScript[];
  createdAt: string;
  updatedAt: string;
}

export interface PresetScript {
  presetId: string;
  scriptId: string;
  order: number;
}
