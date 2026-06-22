import type {
  ApiResponse,
  Station,
  CreateStationRequest,
  UpdateStationRequest,
  AggregatedModel,
  Conversation,
  Message,
  MemoryEntry,
  MemoryConfig,
  PaginatedResponse,
  McpServer,
  McpTool,
  CreateMcpServerRequest,
  UpdateMcpServerRequest,
  FileLibraryEntry,
  FileLibraryResponse,
  FileSearchResult,
} from '../types';
import { getToken, removeToken } from './auth';

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  // Global 401 handling: token is invalid (user deleted, DB wiped, etc.)
  if (res.status === 401 && token) {
    removeToken();
    // Reload the page to show login screen
    window.location.reload();
    return { success: false, error: 'Session expired. Please log in again.' } as ApiResponse<T>;
  }

  return res.json() as Promise<ApiResponse<T>>;
}

// --- Stations ---
export const stationApi = {
  list: () => request<Station[]>('/stations'),
  create: (data: CreateStationRequest) =>
    request<Station>('/stations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateStationRequest) =>
    request<Station>(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/stations/${id}`, { method: 'DELETE' }),
  pullModels: (id: string) =>
    request(`/stations/${id}/pull-models`, { method: 'POST' }),
  healthCheck: (id: string) =>
    request(`/stations/${id}/health-check`, { method: 'POST' }),
};

// --- Models ---
export const modelApi = {
  list: () => request<AggregatedModel[]>('/models'),
  getStations: (normalizedName: string) =>
    request(`/models/${normalizedName}/stations`),
};

// --- Conversations ---
export const conversationApi = {
  list: () => request<Conversation[]>('/conversations'),
  create: (data: { title?: string; modelNormalizedName: string; visibility?: 'public' | 'private'; selfReview?: boolean }) =>
    request<Conversation>('/conversations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { title?: string; modelNormalizedName?: string; visibility?: 'public' | 'private'; selfReview?: boolean }) =>
    request<Conversation>(`/conversations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/conversations/${id}`, { method: 'DELETE' }),
  getMessages: (id: string) =>
    request<Message[]>(`/conversations/${id}/messages`),
};

// --- Chat (SSE streaming) ---
export interface StreamChatCallbacks {
  onChunk: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onToolCall?: (toolCall: { id: string; name: string; arguments: Record<string, unknown> }) => void;
  onToolResult?: (toolResult: { id: string; name: string; result: string }) => void;
  onAttachments?: (attachments: { id: string; type: string; filename: string; mimeType: string }[]) => void;
  onReviewedContent?: (content: string) => void;
}

export function streamChat(
  conversationId: string,
  modelNormalizedName: string,
  message: string,
  callbacks: StreamChatCallbacks,
  attachments?: { filename: string; mimeType: string; base64: string }[],
  fileIds?: string[]
): AbortController {
  const controller = new AbortController();

  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const body: Record<string, unknown> = { conversationId, modelNormalizedName, message };
  if (attachments && attachments.length > 0) {
    body.attachments = attachments;
  }
  if (fileIds && fileIds.length > 0) {
    body.fileIds = fileIds;
  }

  fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json();
        callbacks.onError(data.error || `HTTP ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              callbacks.onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                callbacks.onError(parsed.error);
                return;
              }
              if (parsed.attachments) {
                callbacks.onAttachments?.(parsed.attachments);
              }
              if (parsed.content) {
                callbacks.onChunk(parsed.content);
              }
              if (parsed.toolCall) {
                callbacks.onToolCall?.(parsed.toolCall);
              }
              if (parsed.toolResult) {
                callbacks.onToolResult?.(parsed.toolResult);
              }
              if (parsed.reviewedContent) {
                callbacks.onReviewedContent?.(parsed.reviewedContent);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
      callbacks.onDone();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError(err.message);
      }
    });

  return controller;
}

// --- Memories ---
export const memoryApi = {
  list: (params?: { page?: number; limit?: number; tag?: string; conversationId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.conversationId) searchParams.set('conversationId', params.conversationId);
    return request<PaginatedResponse<MemoryEntry>>(`/memories?${searchParams}`);
  },
  search: (q: string) => request<MemoryEntry[]>(`/memories/search?q=${encodeURIComponent(q)}`),
  semanticSearch: (query: string, limit?: number) =>
    request<MemoryEntry[]>('/memories/search/semantic', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),
  getContext: (q: string, limit?: number) =>
    request<MemoryEntry[]>(`/memories/context?q=${encodeURIComponent(q)}&limit=${limit || 5}`),
  getTags: () => request<{ id: string; name: string; color?: string; entryCount: number }[]>('/memories/tags'),
  getConfig: () => request<MemoryConfig>('/memories/config'),
  updateConfig: (config: Partial<MemoryConfig>) =>
    request<MemoryConfig>('/memories/config', { method: 'PUT', body: JSON.stringify(config) }),
  getOne: (id: string) => request<MemoryEntry>(`/memories/${id}`),
  delete: (id: string) => request(`/memories/${id}`, { method: 'DELETE' }),
  deleteByConversation: (convId: string) =>
    request(`/memories/conversation/${convId}`, { method: 'DELETE' }),
  export: () => request<MemoryEntry[]>('/memories/export', { method: 'POST' }),
  import: (entries: Partial<MemoryEntry>[]) =>
    request('/memories/import', { method: 'POST', body: JSON.stringify(entries) }),
  summarize: (convId: string) =>
    request(`/memories/summarize/${convId}`, { method: 'POST' }),
  backfillEmbeddings: (batchSize?: number) =>
    request<{ processed: number; failed: number; remainingWithoutEmbeddings: number; message: string }>(
      '/memories/backfill-embeddings',
      { method: 'POST', body: JSON.stringify({ batchSize: batchSize || 10 }) }
    ),
};

// --- MCP Servers ---
export const mcpApi = {
  listServers: () => request<(McpServer & { toolCount: number })[]>('/mcp/servers'),
  createServer: (data: CreateMcpServerRequest) =>
    request<McpServer>('/mcp/servers', { method: 'POST', body: JSON.stringify(data) }),
  updateServer: (id: string, data: UpdateMcpServerRequest) =>
    request<McpServer>(`/mcp/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteServer: (id: string) =>
    request(`/mcp/servers/${id}`, { method: 'DELETE' }),
  connectServer: (id: string) =>
    request<{ toolsCount: number; tools: { name: string; description?: string }[] }>(
      `/mcp/servers/${id}/connect`,
      { method: 'POST' }
    ),
  listTools: (serverId: string) =>
    request<McpTool[]>(`/mcp/servers/${serverId}/tools`),
  toggleTool: (toolId: string, enabled: boolean) =>
    request(`/mcp/tools/${toolId}/toggle`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
};

// --- File Library ---
export const fileApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    return request<FileLibraryResponse>(`/files?${searchParams}`);
  },
  getOne: (id: string) => request<FileLibraryEntry>(`/files/${id}`),
  delete: (id: string) => request(`/files/${id}`, { method: 'DELETE' }),
  reindex: (id: string) => request<{ status: string }>(`/files/${id}/reindex`, { method: 'POST' }),
  search: (query: string, fileIds?: string[], limit?: number) =>
    request<FileSearchResult[]>('/files/search', {
      method: 'POST',
      body: JSON.stringify({ query, fileIds, limit }),
    }),
  upload: async (files: File[]): Promise<ApiResponse<FileLibraryEntry[]>> => {
    const token = getToken();
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    // Global 401 handling
    if (res.status === 401 && token) {
      removeToken();
      window.location.reload();
      return { success: false, error: 'Session expired. Please log in again.' };
    }

    return res.json() as Promise<ApiResponse<FileLibraryEntry[]>>;
  },
};
