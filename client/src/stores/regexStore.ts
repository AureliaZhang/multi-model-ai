import { create } from 'zustand';
import { regexApi } from '../services/api';
import type { RegexScript, RegexPreset } from '../types';

interface RegexState {
  scripts: RegexScript[];
  presets: RegexPreset[];
  loading: boolean;
  error: string | null;

  fetchScripts: () => Promise<void>;
  createScript: (data: Partial<RegexScript>) => Promise<void>;
  updateScript: (id: string, data: Partial<RegexScript>) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
  reorderScripts: (ids: string[]) => Promise<void>;

  fetchPresets: () => Promise<void>;
  createPreset: (data: { name: string; description?: string; scriptIds?: string[] }) => Promise<void>;
  updatePreset: (id: string, data: { name?: string; description?: string; isDefault?: boolean }) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  setPresetScripts: (presetId: string, scriptIds: string[]) => Promise<void>;
  activatePreset: (conversationId: string, presetId: string) => Promise<void>;
  exportPreset: (presetId: string) => Promise<unknown>;
  importPreset: (data: unknown) => Promise<void>;
}

export const useRegexStore = create<RegexState>((set, get) => ({
  scripts: [],
  presets: [],
  loading: false,
  error: null,

  fetchScripts: async () => {
    try {
      set({ loading: true, error: null });
      const res = await regexApi.listScripts();
      if (res.success && res.data) {
        set({ scripts: res.data, loading: false });
      } else {
        set({ loading: false, error: res.error || 'Failed to fetch scripts' });
      }
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  createScript: async (data) => {
    try {
      const res = await regexApi.createScript(data);
      if (res.success && res.data) {
        set(state => ({ scripts: [...state.scripts, res.data!] }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateScript: async (id, data) => {
    try {
      const res = await regexApi.updateScript(id, data);
      if (res.success) {
        // Refetch to get updated data
        get().fetchScripts();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteScript: async (id) => {
    try {
      const res = await regexApi.deleteScript(id);
      if (res.success) {
        set(state => ({ scripts: state.scripts.filter(s => s.id !== id) }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  reorderScripts: async (ids) => {
    try {
      await regexApi.reorderScripts(ids);
      set(state => {
        const scriptMap = new Map(state.scripts.map(s => [s.id, s]));
        const reordered = ids
          .map((id, index) => {
            const script = scriptMap.get(id);
            if (script) return { ...script, order: index };
            return null;
          })
          .filter(Boolean) as RegexScript[];
        return { scripts: reordered };
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchPresets: async () => {
    try {
      const res = await regexApi.listPresets();
      if (res.success && res.data) {
        set({ presets: res.data });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createPreset: async (data) => {
    try {
      const res = await regexApi.createPreset(data);
      if (res.success && res.data) {
        set(state => ({ presets: [...state.presets, res.data!] }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updatePreset: async (id, data) => {
    try {
      await regexApi.updatePreset(id, data);
      get().fetchPresets();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deletePreset: async (id) => {
    try {
      const res = await regexApi.deletePreset(id);
      if (res.success) {
        set(state => ({ presets: state.presets.filter(p => p.id !== id) }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setPresetScripts: async (presetId, scriptIds) => {
    try {
      await regexApi.setPresetScripts(presetId, scriptIds);
      get().fetchPresets();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  activatePreset: async (conversationId, presetId) => {
    try {
      await regexApi.activatePreset(presetId, conversationId);
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  exportPreset: async (presetId) => {
    try {
      const res = await regexApi.exportPreset(presetId);
      if (res.success && res.data) {
        return res.data;
      }
      return null;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  importPreset: async (data) => {
    try {
      const res = await regexApi.importPreset(data as any);
      if (res.success && res.data) {
        set(state => ({ presets: [...state.presets, res.data!] }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
