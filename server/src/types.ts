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
  displayName?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserPublic;
}

export interface UpdateUserRequest {
  email?: string;
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
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

export interface Conversation {
  id: string;
  title: string;
  modelNormalizedName: string;
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
