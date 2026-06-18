import { create } from 'zustand';
import type { AggregatedModel } from '../types';
import { modelApi } from '../services/api';

interface ModelState {
  models: AggregatedModel[];
  loading: boolean;
  error: string | null;
  fetchModels: () => Promise<void>;
  getModel: (normalizedName: string) => AggregatedModel | undefined;
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  loading: false,
  error: null,

  fetchModels: async () => {
    set({ loading: true, error: null });
    try {
      const res = await modelApi.list();
      if (res.success && res.data) {
        set({ models: res.data, loading: false });
      } else {
        set({ error: res.error || 'Failed to fetch models', loading: false });
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  getModel: (normalizedName: string) => {
    return get().models.find(m => m.normalizedName === normalizedName);
  },
}));
