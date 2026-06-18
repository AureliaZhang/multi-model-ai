import { create } from 'zustand';
import type { Station, CreateStationRequest } from '../types';
import { stationApi } from '../services/api';

interface StationState {
  stations: Station[];
  loading: boolean;
  error: string | null;
  fetchStations: () => Promise<void>;
  createStation: (data: CreateStationRequest) => Promise<void>;
  updateStation: (id: string, data: Partial<Station>) => Promise<void>;
  deleteStation: (id: string) => Promise<void>;
  pullModels: (id: string) => Promise<void>;
  healthCheck: (id: string) => Promise<void>;
}

export const useStationStore = create<StationState>((set, get) => ({
  stations: [],
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
    } catch (err: any) {
      set({ error: err.message, loading: false });
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
    await get().fetchStations();
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
