import { create } from 'zustand';
import type { Station, CreateStationRequest, StationModelRow } from '../types';
import { stationApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';

interface StationState {
  stations: Station[];
  stationModels: Record<string, StationModelRow[]>;
  loading: boolean;
  error: string | null;
  fetchStations: () => Promise<void>;
  createStation: (data: CreateStationRequest) => Promise<void>;
  updateStation: (id: string, data: Partial<Station>) => Promise<void>;
  deleteStation: (id: string) => Promise<void>;
  pullModels: (id: string) => Promise<StationModelRow[]>;
  fetchStationModels: (id: string) => Promise<StationModelRow[]>;
  setModelExposed: (stationId: string, modelRowId: string, enabled: boolean) => Promise<void>;
  setModelAdminEnabled: (stationId: string, modelRowId: string, adminEnabled: boolean) => Promise<void>;
  renameModel: (stationId: string, modelRowId: string, displayName: string) => Promise<void>;
  bulkSetExposed: (stationId: string, flags: { enabled?: boolean; adminEnabled?: boolean }) => Promise<void>;
  healthCheck: (id: string) => Promise<void>;
}

export const useStationStore = create<StationState>((set, get) => ({
  stations: [],
  stationModels: {},
  loading: false,
  error: null,

  fetchStations: async () => {
    set({ loading: true, error: null });
    try {
      const res = await stationApi.list();
      if (res.success && res.data) {
        set({ stations: res.data, loading: false });
      } else {
        set({ error: res.error || 'Failed to fetch stations', loading: false });
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  createStation: async (data: CreateStationRequest) => {
    const res = await stationApi.create(data);
    if (res.success) {
      await get().fetchStations();
    } else {
      throw new Error(res.error || 'Failed to create station');
    }
  },

  updateStation: async (id: string, data: Partial<Station>) => {
    const res = await stationApi.update(id, data);
    if (res.success) {
      await get().fetchStations();
    } else {
      throw new Error(res.error || 'Failed to update station');
    }
  },

  deleteStation: async (id: string) => {
    const res = await stationApi.delete(id);
    if (res.success) {
      const next = { ...get().stationModels };
      delete next[id];
      set({ stationModels: next });
      await get().fetchStations();
    } else {
      throw new Error(res.error || 'Failed to delete station');
    }
  },

  pullModels: async (id: string) => {
    const res = await stationApi.pullModels(id);
    if (!res.success) {
      throw new Error(res.error || 'Failed to pull models');
    }
    const models = res.data || [];
    set((s) => ({
      stationModels: { ...s.stationModels, [id]: models },
    }));
    await get().fetchStations();
    return models;
  },

  fetchStationModels: async (id: string) => {
    const res = await stationApi.listModels(id);
    if (!res.success) {
      throw new Error(res.error || 'Failed to list models');
    }
    const models = res.data || [];
    set((s) => ({
      stationModels: { ...s.stationModels, [id]: models },
    }));
    return models;
  },

  setModelExposed: async (stationId, modelRowId, enabled) => {
    const res = await stationApi.setModelFlags(stationId, modelRowId, { enabled });
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to update model');
    }
    set((s) => {
      const list = s.stationModels[stationId] || [];
      return {
        stationModels: {
          ...s.stationModels,
          [stationId]: list.map((m) => (m.id === modelRowId ? { ...m, ...res.data } : m)),
        },
      };
    });
  },

  setModelAdminEnabled: async (stationId, modelRowId, adminEnabled) => {
    const res = await stationApi.setModelFlags(stationId, modelRowId, { adminEnabled });
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to update model');
    }
    set((s) => {
      const list = s.stationModels[stationId] || [];
      return {
        stationModels: {
          ...s.stationModels,
          [stationId]: list.map((m) => (m.id === modelRowId ? { ...m, ...res.data } : m)),
        },
      };
    });
  },

  renameModel: async (stationId, modelRowId, displayName) => {
    const res = await stationApi.setModelDisplayName(stationId, modelRowId, displayName);
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to rename model');
    }
    set((s) => {
      const list = s.stationModels[stationId] || [];
      return {
        stationModels: {
          ...s.stationModels,
          [stationId]: list.map((m) => (m.id === modelRowId ? { ...m, ...res.data } : m)),
        },
      };
    });
  },

  bulkSetExposed: async (stationId, flags) => {
    const res = await stationApi.bulkSetModelsEnabled(stationId, flags);
    if (!res.success) {
      throw new Error(res.error || 'Failed to bulk update');
    }
    const models = res.data || [];
    set((s) => ({
      stationModels: { ...s.stationModels, [stationId]: models },
    }));
  },

  healthCheck: async (id: string) => {
    const res = await stationApi.healthCheck(id);
    if (res.success) {
      await get().fetchStations();
    } else {
      throw new Error(res.error || 'Health check failed');
    }
  },
}));
