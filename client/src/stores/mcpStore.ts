import { create } from 'zustand';
import type { McpServer, McpTool, CreateMcpServerRequest, UpdateMcpServerRequest } from '../types';
import { mcpApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';

interface McpState {
  servers: (McpServer & { toolCount: number })[];
  selectedServerId: string | null;
  tools: McpTool[];
  loading: boolean;
  error: string | null;

  fetchServers: () => Promise<void>;
  createServer: (data: CreateMcpServerRequest) => Promise<void>;
  updateServer: (id: string, data: UpdateMcpServerRequest) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  connectServer: (id: string) => Promise<{ toolsCount: number; tools: { name: string; description?: string }[] }>;
  selectServer: (id: string | null) => Promise<void>;
  fetchTools: (serverId: string) => Promise<void>;
  toggleTool: (toolId: string, enabled: boolean) => Promise<void>;
  clearError: () => void;
}

export const useMcpStore = create<McpState>((set, get) => ({
  servers: [],
  selectedServerId: null,
  tools: [],
  loading: false,
  error: null,

  fetchServers: async () => {
    set({ loading: true });
    try {
      const res = await mcpApi.listServers();
      if (res.success && res.data) {
        set({ servers: res.data, loading: false });
      } else {
        set({ loading: false, error: res.error || 'Failed to fetch MCP servers' });
      }
    } catch (err: unknown) {
      set({ loading: false, error: getErrorMessage(err) });
    }
  },

  createServer: async (data: CreateMcpServerRequest) => {
    try {
      const res = await mcpApi.createServer(data);
      if (res.success && res.data) {
        set(state => ({
          servers: [{ ...res.data!, toolCount: 0 }, ...state.servers],
        }));
      } else {
        throw new Error(res.error || 'Failed to create MCP server');
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
      throw err;
    }
  },

  updateServer: async (id: string, data: UpdateMcpServerRequest) => {
    try {
      const res = await mcpApi.updateServer(id, data);
      if (res.success && res.data) {
        set(state => ({
          servers: state.servers.map(s => s.id === id ? { ...s, ...res.data! } : s),
        }));
      } else {
        throw new Error(res.error || 'Failed to update MCP server');
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
      throw err;
    }
  },

  deleteServer: async (id: string) => {
    try {
      const res = await mcpApi.deleteServer(id);
      if (res.success) {
        set(state => ({
          servers: state.servers.filter(s => s.id !== id),
          selectedServerId: state.selectedServerId === id ? null : state.selectedServerId,
          tools: state.selectedServerId === id ? [] : state.tools,
        }));
      } else {
        throw new Error(res.error || 'Failed to delete MCP server');
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
      throw err;
    }
  },

  connectServer: async (id: string) => {
    try {
      const res = await mcpApi.connectServer(id);
      if (res.success && res.data) {
        // Refresh server list to update status
        get().fetchServers();
        // Refresh tools if this server is selected
        if (get().selectedServerId === id) {
          get().fetchTools(id);
        }
        return res.data;
      } else {
        throw new Error(res.error || 'Failed to connect to MCP server');
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
      throw err;
    }
  },

  selectServer: async (id: string | null) => {
    set({ selectedServerId: id, tools: [] });
    if (id) {
      await get().fetchTools(id);
    }
  },

  fetchTools: async (serverId: string) => {
    try {
      const res = await mcpApi.listTools(serverId);
      if (res.success && res.data) {
        set({ tools: res.data });
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    }
  },

  toggleTool: async (toolId: string, enabled: boolean) => {
    try {
      const res = await mcpApi.toggleTool(toolId, enabled);
      if (res.success) {
        set(state => ({
          tools: state.tools.map(t => t.id === toolId ? { ...t, enabled } : t),
        }));
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    }
  },

  clearError: () => set({ error: null }),
}));
