import type {
  ApiResponse,
  Station,
  CreateStationRequest,
  UpdateStationRequest,
  StationModelRow,
  UsageLogItem,
  UsageSummary,
  AggregatedModel,
  Conversation,
  Persona,
  Message,
  MemoryEntry,
  MemoryConfig,
  PaginatedResponse,
  McpServer,
  McpTool,
  CreateMcpServerRequest,
  UpdateMcpServerRequest,
  FileFolder,
  FileLibraryEntry,
  FileLibraryResponse,
  FileSearchResult,
  RegexScript,
  RegexPreset,
  RegexTestResult,
  RegexExportData,
  ArenaModelRow,
  BattleDetail,
  BattleListItem,
  LeaderboardRow,
  ArenaStatsSummary,
  ArenaPrompt,
  ArenaPromptSet,
  PromptExperiment,
  BenchmarkRun,
} from '../types';
import { getToken, removeToken } from './auth';
import { getErrorMessage } from '../utils/errors';

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

  const fullUrl = `${BASE_URL}${url}`;
  let res: Response;
  try {
    res = await fetch(fullUrl, { ...options, headers });
  } catch (fetchErr: unknown) {
    console.error(`[request] Fetch failed for ${fullUrl}:`, getErrorMessage(fetchErr));
    return { success: false, error: `Network error: ${getErrorMessage(fetchErr)}` } as ApiResponse<T>;
  }

  // Global 401 handling: token is invalid (user deleted, DB wiped, etc.)
  if (res.status === 401 && token) {
    console.warn(`[request] 401 for ${fullUrl} — removing token and reloading`);
    removeToken();
    // Reload the page to show login screen
    window.location.reload();
    return { success: false, error: 'Session expired. Please log in again.' } as ApiResponse<T>;
  }

  try {
    const data = await res.json();
    return data as ApiResponse<T>;
  } catch (jsonErr: unknown) {
    console.error(`[request] JSON parse failed for ${fullUrl} (status ${res.status}):`, getErrorMessage(jsonErr));
    return { success: false, error: `Invalid response from server (HTTP ${res.status})` } as ApiResponse<T>;
  }
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
    request<StationModelRow[]>(`/stations/${id}/pull-models`, { method: 'POST' }),
  healthCheck: (id: string) =>
    request(`/stations/${id}/health-check`, { method: 'POST' }),
  listModels: (stationId: string) =>
    request<StationModelRow[]>(`/stations/${stationId}/models`),
  setModelEnabled: (stationId: string, modelRowId: string, enabled: boolean) =>
    request<StationModelRow>(`/stations/${stationId}/models/${modelRowId}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),
  setModelFlags: (
    stationId: string,
    modelRowId: string,
    flags: { enabled?: boolean; adminEnabled?: boolean; displayName?: string }
  ) =>
    request<StationModelRow>(`/stations/${stationId}/models/${modelRowId}`, {
      method: 'PUT',
      body: JSON.stringify(flags),
    }),
  setModelDisplayName: (stationId: string, modelRowId: string, displayName: string) =>
    request<StationModelRow>(`/stations/${stationId}/models/${modelRowId}`, {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
    }),
  bulkSetModelsEnabled: (
    stationId: string,
    flags: { enabled?: boolean; adminEnabled?: boolean },
    modelRowIds?: string[]
  ) =>
    request<StationModelRow[]>(`/stations/${stationId}/models-bulk`, {
      method: 'PUT',
      body: JSON.stringify({ ...flags, modelRowIds }),
    }),
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
  create: (data: { title?: string; modelNormalizedName: string; visibility?: 'public' | 'private'; selfReview?: boolean; systemPrompt?: string | null }) =>
    request<Conversation>('/conversations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { title?: string; modelNormalizedName?: string; visibility?: 'public' | 'private'; selfReview?: boolean; systemPrompt?: string | null }) =>
    request<Conversation>(`/conversations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/conversations/${id}`, { method: 'DELETE' }),
  getMessages: (id: string) =>
    request<Message[]>(`/conversations/${id}/messages`),
  // Search in-scope conversations by title + message content.
  search: (q: string) =>
    request<Conversation[]>(`/conversations/search?q=${encodeURIComponent(q)}`),
  // Delete a message and every message after it (powers edit-resend / regenerate).
  truncate: (id: string, messageId: string) =>
    request<{ deleted: number }>(`/conversations/${id}/truncate`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    }),
  // Download all in-scope conversations (+ messages) as a JSON file.
  downloadExport: async () => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/conversations/export`, { headers });
    if (res.status === 401 && token) {
      removeToken();
      window.location.reload();
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error || 'Export failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `conversations-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  import: (payload: unknown) =>
    request<{
      importedConversations: number;
      importedMessages: number;
      importedAttachments?: number;
      total: number;
    }>(
      '/conversations/import',
      { method: 'POST', body: JSON.stringify(payload) }
    ),
};

// Team-shared persona / system-prompt library (everyone reads & uses; creator
// or admin edits/deletes). Distinct from the per-conversation persona.
export const personaApi = {
  list: () => request<Persona[]>('/personas'),
  create: (data: { title: string; body: string; description?: string | null }) =>
    request<Persona>('/personas', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { title?: string; body?: string; description?: string | null }) =>
    request<Persona>(`/personas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/personas/${id}`, { method: 'DELETE' }),
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
  onRegexContent?: (content: string) => void;
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
              if (parsed.regexContent) {
                callbacks.onRegexContent?.(parsed.regexContent);
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
  fetchEmbeddingModels: (baseUrl: string, apiKey: string) =>
    request<{ id: string; name: string }[]>('/memories/fetch-embedding-models', {
      method: 'POST',
      body: JSON.stringify({ baseUrl, apiKey }),
    }),
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
  // Folder operations
  folders: {
    list: (parentId?: string) => {
      const params = new URLSearchParams();
      if (parentId) params.set('parent_id', parentId);
      return request<FileFolder[]>(`/files/folders?${params}`);
    },
    create: (name: string, parentId?: string) =>
      request<FileFolder>('/files/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parentId }),
      }),
    rename: (id: string, name: string) =>
      request<FileFolder>(`/files/folders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      }),
    delete: (id: string) => request(`/files/folders/${id}`, { method: 'DELETE' }),
    getPath: (id: string) => request<{ id: string; name: string }[]>(`/files/folders/${id}/path`),
  },
  // File operations
  list: (params?: { page?: number; limit?: number; folderId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.folderId) searchParams.set('folder_id', params.folderId);
    return request<FileLibraryResponse>(`/files?${searchParams}`);
  },
  getOne: (id: string) => request<FileLibraryEntry>(`/files/${id}`),
  delete: (id: string) => request(`/files/${id}`, { method: 'DELETE' }),
  reindex: (id: string) => request<{ status: string }>(`/files/${id}/reindex`, { method: 'POST' }),
  moveFile: (id: string, folderId: string | null) =>
    request<FileLibraryEntry>(`/files/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ folderId }),
    }),
  search: (query: string, fileIds?: string[], limit?: number) =>
    request<FileSearchResult[]>('/files/search', {
      method: 'POST',
      body: JSON.stringify({ query, fileIds, limit }),
    }),
  upload: async (files: File[], folderId?: string | null): Promise<ApiResponse<FileLibraryEntry[]>> => {
    const token = getToken();
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (folderId) formData.append('folder_id', folderId);
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

// --- Regex Scripts & Presets ---
export const regexApi = {
  // Scripts
  listScripts: () =>
    request<RegexScript[]>('/regex/scripts'),
  createScript: (data: Partial<RegexScript>) =>
    request<RegexScript>('/regex/scripts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateScript: (id: string, data: Partial<RegexScript>) =>
    request<RegexScript>(`/regex/scripts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteScript: (id: string) =>
    request<void>(`/regex/scripts/${id}`, { method: 'DELETE' }),
  reorderScripts: (ids: string[]) =>
    request<void>('/regex/scripts/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    }),

  // Presets
  listPresets: () =>
    request<RegexPreset[]>('/regex/presets'),
  createPreset: (data: { name: string; description?: string; scriptIds?: string[] }) =>
    request<RegexPreset>('/regex/presets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePreset: (id: string, data: { name?: string; description?: string; isDefault?: boolean }) =>
    request<RegexPreset>(`/regex/presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePreset: (id: string) =>
    request<void>(`/regex/presets/${id}`, { method: 'DELETE' }),
  setPresetScripts: (presetId: string, scriptIds: string[]) =>
    request<void>(`/regex/presets/${presetId}/scripts`, {
      method: 'POST',
      body: JSON.stringify({ scriptIds }),
    }),
  activatePreset: (presetId: string, conversationId: string) =>
    request<void>(`/regex/presets/${presetId}/activate`, {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    }),
  exportPreset: (presetId: string) =>
    request<RegexExportData>(`/regex/presets/${presetId}/export`),
  importPreset: (data: RegexExportData) =>
    request<RegexPreset>('/regex/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  testRegex: (pattern: string, flags: string, replacement: string, text: string) =>
    request<RegexTestResult>(`/regex/test?pattern=${encodeURIComponent(pattern)}&flags=${encodeURIComponent(flags)}&replacement=${encodeURIComponent(replacement)}&text=${encodeURIComponent(text)}`),
};

// --- Arena (admin) ---
export const arenaApi = {
  listModels: () => request<ArenaModelRow[]>('/arena/models'),
  updateModel: (
    normalizedName: string,
    data: Partial<{
      displayLabel: string;
      eligibleBattle: boolean;
      eligibleBenchmark: boolean;
      tags: string[];
      notes: string | null;
      isActive: boolean;
      sortOrder: number;
    }>
  ) =>
    request(`/arena/models/${encodeURIComponent(normalizedName)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  createBattle: (data: {
    question: string;
    models: string[];
    revealMode?: 'hidden_until_pick' | 'always_show_names';
    runImmediately?: boolean;
  }) =>
    request<BattleDetail>('/arena/battles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getBattle: (id: string) => request<BattleDetail>(`/arena/battles/${id}`),
  listBattles: (limit = 50, offset = 0) =>
    request<{ items: BattleListItem[]; total: number; limit: number; offset: number }>(
      `/arena/battles?limit=${limit}&offset=${offset}`
    ),
  selectCandidate: (battleId: string, candidateId: string) =>
    request<BattleDetail>(`/arena/battles/${battleId}/select`, {
      method: 'POST',
      body: JSON.stringify({ candidateId }),
    }),
  leaderboard: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return request<LeaderboardRow[]>(`/arena/leaderboard${qs ? `?${qs}` : ''}`);
  },
  statsSummary: () => request<ArenaStatsSummary>('/arena/stats/summary'),

  // prompts
  listPrompts: () => request<ArenaPrompt[]>('/arena/prompts'),
  createPrompt: (data: { title: string; body: string; systemPrompt?: string; tags?: string[] }) =>
    request<ArenaPrompt>('/arena/prompts', { method: 'POST', body: JSON.stringify(data) }),
  updatePrompt: (id: string, data: Partial<{ title: string; body: string; systemPrompt: string | null; tags: string[] }>) =>
    request<ArenaPrompt>(`/arena/prompts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePrompt: (id: string) => request(`/arena/prompts/${id}`, { method: 'DELETE' }),

  // prompt sets
  listPromptSets: () => request<ArenaPromptSet[]>('/arena/prompt-sets'),
  getPromptSet: (id: string) => request<ArenaPromptSet>(`/arena/prompt-sets/${id}`),
  createPromptSet: (data: { name: string; description?: string; promptIds?: string[] }) =>
    request<ArenaPromptSet>('/arena/prompt-sets', { method: 'POST', body: JSON.stringify(data) }),
  updatePromptSet: (id: string, data: { name?: string; description?: string | null; promptIds?: string[] }) =>
    request<ArenaPromptSet>(`/arena/prompt-sets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePromptSet: (id: string) => request(`/arena/prompt-sets/${id}`, { method: 'DELETE' }),

  // prompt lab
  createExperiment: (data: Record<string, unknown>) =>
    request<PromptExperiment>('/arena/prompt-experiments', { method: 'POST', body: JSON.stringify(data) }),
  listExperiments: (limit = 50) =>
    request<PromptExperiment[]>(`/arena/prompt-experiments?limit=${limit}`),
  getExperiment: (id: string) => request<PromptExperiment>(`/arena/prompt-experiments/${id}`),
  selectExperimentCell: (experimentId: string, cellId: string) =>
    request<PromptExperiment>(`/arena/prompt-experiments/${experimentId}/select-cell`, {
      method: 'POST',
      body: JSON.stringify({ cellId }),
    }),

  // benchmarks
  createBenchmarkRun: (data: {
    setId: string;
    models: string[];
    name?: string;
    runImmediately?: boolean;
    async?: boolean;
  }) =>
    request<BenchmarkRun>('/arena/benchmarks/runs', { method: 'POST', body: JSON.stringify(data) }),
  listBenchmarkRuns: (limit = 50) =>
    request<BenchmarkRun[]>(`/arena/benchmarks/runs?limit=${limit}`),
  getBenchmarkRun: (id: string) => request<BenchmarkRun>(`/arena/benchmarks/runs/${id}`),
  setBenchmarkVerdict: (resultId: string, manualVerdict: 'unset' | 'pass' | 'fail' | 'skip') =>
    request<BenchmarkRun>(`/arena/benchmarks/results/${resultId}`, {
      method: 'PATCH',
      body: JSON.stringify({ manualVerdict }),
    }),

  /** Download CSV with auth header (returns blob URL helper) */
  downloadExport: async (path: string, filename: string) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    if (res.status === 401 && token) {
      removeToken();
      window.location.reload();
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error || 'Export failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};


// --- §10.6 Rooms (group chat + shared Group AI) ---
export const roomApi = {
  list: () => request<import('../types').Room[]>('/rooms'),
  create: (name: string, memberUserIds: string[]) =>
    request<import('../types').Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, memberUserIds }),
    }),
  get: (id: string) => request<import('../types').Room>(`/rooms/${id}`),
  disband: (id: string) => request<void>(`/rooms/${id}`, { method: 'DELETE' }),
  invite: (id: string, userIds: string[]) =>
    request<import('../types').RoomMemberInfo[]>(`/rooms/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }),
  kick: (id: string, userId: string) =>
    request<import('../types').RoomMemberInfo[]>(`/rooms/${id}/members/${userId}`, { method: 'DELETE' }),

  // left track (human)
  listMessages: (id: string) => request<import('../types').RoomMessage[]>(`/rooms/${id}/messages`),
  sendMessage: (id: string, content: string, attachments?: unknown[]) =>
    request<import('../types').RoomMessage>(`/rooms/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, attachments }),
    }),

  // right track (AI)
  listAi: (id: string) => request<import('../types').RoomAiMessage[]>(`/rooms/${id}/ai`),
  ask: (id: string, content: string, fileIds?: string[]) =>
    request<{ userMessageId: string; assistant: import('../types').RoomAiMessage }>(`/rooms/${id}/ai/ask`, {
      method: 'POST',
      body: JSON.stringify({ content, fileIds }),
    }),

  // occupancy (@AI input lock)
  claim: (id: string) => request<import('../types').Room>(`/rooms/${id}/occupancy/claim`, { method: 'POST' }),
  renew: (id: string) => request<import('../types').Room>(`/rooms/${id}/occupancy/renew`, { method: 'POST' }),
  release: (id: string) => request<import('../types').Room>(`/rooms/${id}/occupancy/release`, { method: 'POST' }),

  // group model prefs (shared 5-min cooldown)
  setModels: (id: string, models: { chatModel?: string | null; imageModel?: string | null; ttsModel?: string | null }) =>
    request<import('../types').Room>(`/rooms/${id}/models`, {
      method: 'PUT',
      body: JSON.stringify(models),
    }),

  // group files
  listFiles: (id: string) => request<import('../types').RoomFile[]>(`/rooms/${id}/files`),
  uploadFile: (id: string, name: string, mimeType: string, content: string, fileSize: number) =>
    request<import('../types').RoomFile>(`/rooms/${id}/files`, {
      method: 'POST',
      body: JSON.stringify({ name, mimeType, content, fileSize }),
    }),
  deleteFile: (id: string, fileId: string) =>
    request<void>(`/rooms/${id}/files/${fileId}`, { method: 'DELETE' }),

  /**
   * Export the group AI replies as a real .docx. Returns a Blob (binary), so it
   * does its own fetch instead of going through `request` (which assumes JSON).
   * The server builds OOXML from the markdown contents (see rooms route).
   */
  exportDocx: async (id: string, contents: string[], title: string): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/rooms/${id}/ai/export/docx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ contents, title }),
    });
    if (!res.ok) {
      let msg = `Export failed (HTTP ${res.status})`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch { /* body was not JSON */ }
      throw new Error(msg);
    }
    return res.blob();
  },

  // §10.6.14 group notepad (pinned sticky note + edit-permission flow)
  getNotepad: (id: string) =>
    request<import('../types').RoomNotepad>(`/rooms/${id}/notepad`),
  saveNotepad: (id: string, content: string) =>
    request<import('../types').RoomNotepad>(`/rooms/${id}/notepad`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  requestNotepadEdit: (id: string) =>
    request<import('../types').RoomNotepad>(`/rooms/${id}/notepad/request`, { method: 'POST' }),
  resolveNotepadRequest: (id: string, reqId: string, approve: boolean) =>
    request<import('../types').RoomNotepad>(`/rooms/${id}/notepad/requests/${reqId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
    }),
  revokeNotepadEditor: (id: string, userId: string) =>
    request<import('../types').RoomNotepad>(`/rooms/${id}/notepad/editors/${userId}`, { method: 'DELETE' }),
};

// --- Users (list for invite picker; admin creates, but members list is needed for group invite) ---
export const usersApi = {
  listBasic: () => request<import('../types').UserPublic[]>('/rooms/util/users'),
};

// --- Usage logs (admin) ---
export const usageApi = {
  list: (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    kind?: string;
    username?: string;
    from?: string;
    to?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.status) q.set('status', params.status);
    if (params?.kind) q.set('kind', params.kind);
    if (params?.username) q.set('username', params.username);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    return request<{
      items: UsageLogItem[];
      total: number;
      limit: number;
      offset: number;
      summary: { errors: number; totalTokens: number };
    }>(`/usage?${q}`);
  },
  getSummary: (params?: { kind?: string; username?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.kind) q.set('kind', params.kind);
    if (params?.username) q.set('username', params.username);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    return request<UsageSummary>(`/usage/summary?${q}`);
  },
};
