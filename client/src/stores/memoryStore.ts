import { create } from 'zustand';
import type { MemoryEntry, MemoryConfig } from '../types';
import { memoryApi } from '../services/api';

interface MemoryState {
  entries: MemoryEntry[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  searching: boolean;
  error: string | null;
  searchQuery: string;
  searchResults: MemoryEntry[];
  config: (MemoryConfig & { embeddingStats?: { total: number; embedded: number } }) | null;
  selectedTag: string | null;
  allTags: string[];
  backfillStatus: string | null;

  fetchEntries: (page?: number, tag?: string) => Promise<void>;
  fetchTags: () => Promise<void>;
  searchMemories: (query: string) => Promise<void>;
  clearSearch: () => void;
  fetchConfig: () => Promise<void>;
  updateConfig: (config: Partial<MemoryConfig>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  setSelectedTag: (tag: string | null) => void;
  clearError: () => void;
  backfillEmbeddings: () => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  entries: [],
  total: 0,
  page: 1,
  totalPages: 0,
  loading: false,
  searching: false,
  error: null,
  searchQuery: '',
  searchResults: [],
  config: null,
  selectedTag: null,
  allTags: [],
  backfillStatus: null,

  fetchEntries: async (page = 1, tag?: string) => {
    set({ loading: true });
    try {
      const res = await memoryApi.list({ page, limit: 20, tag: tag || undefined });
      if (res.success && res.data) {
        set({
          entries: res.data.entries,
          total: res.data.total,
          page: res.data.page,
          totalPages: res.data.totalPages,
          loading: false,
        });
      } else {
        set({ loading: false, error: res.error || 'Failed to fetch memories' });
      }
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  searchMemories: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: '' });
      return;
    }
    set({ loading: true, searchQuery: query });
    try {
      const res = await memoryApi.search(query);
      if (res.success && res.data) {
        set({ searchResults: res.data, loading: false });
      } else {
        set({ loading: false, error: res.error || 'Search failed' });
      }
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [] }),

  fetchTags: async () => {
    try {
      const res = await memoryApi.getTags();
      if (res.success && res.data) {
        set({ allTags: res.data.map((t: any) => t.name) });
      }
    } catch (err: any) {
      console.error('Failed to fetch memory tags:', err);
    }
  },

  fetchConfig: async () => {
    try {
      const res = await memoryApi.getConfig();
      if (res.success && res.data) {
        set({ config: res.data });
      }
    } catch (err: any) {
      console.error('Failed to fetch memory config:', err);
    }
  },

  updateConfig: async (config: Partial<MemoryConfig>) => {
    try {
      const res = await memoryApi.updateConfig(config);
      if (res.success && res.data) {
        set({ config: res.data });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteEntry: async (id: string) => {
    try {
      const res = await memoryApi.delete(id);
      if (res.success) {
        set(state => ({
          entries: state.entries.filter(e => e.id !== id),
          searchResults: state.searchResults.filter(e => e.id !== id),
          total: state.total - 1,
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setSelectedTag: (tag: string | null) => {
    set({ selectedTag: tag });
    get().fetchEntries(1, tag || undefined);
  },

  clearError: () => set({ error: null }),

  backfillEmbeddings: async () => {
    set({ loading: true, backfillStatus: 'Starting backfill...' });
    try {
      let totalProcessed = 0;
      let remaining = -1;

      // Process in batches until all done
      while (remaining !== 0) {
        const res = await memoryApi.backfillEmbeddings(10);
        if (res.success && res.data) {
          totalProcessed += res.data.processed;
          remaining = res.data.remainingWithoutEmbeddings;
          set({
            backfillStatus: `Processed ${totalProcessed} entries. ${remaining} remaining...`,
          });
          if (res.data.processed === 0) break; // No more to process
        } else {
          set({ error: res.error || 'Backfill failed', loading: false, backfillStatus: null });
          return;
        }
      }

      set({
        loading: false,
        backfillStatus: `Done! Generated embeddings for ${totalProcessed} entries.`,
      });

      // Refresh config to get updated stats
      get().fetchConfig();
    } catch (err: any) {
      set({ loading: false, error: err.message, backfillStatus: null });
    }
  },
}));
