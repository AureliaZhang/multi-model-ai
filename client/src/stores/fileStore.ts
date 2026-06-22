import { create } from 'zustand';
import type { FileLibraryEntry } from '../types';
import { fileApi } from '../services/api';

interface FileState {
  files: FileLibraryEntry[];
  selectedFileIds: string[];
  loading: boolean;
  uploading: boolean;
  error: string | null;

  fetchFiles: () => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  reindexFile: (id: string) => Promise<void>;
  setSelectedFiles: (ids: string[]) => void;
  toggleSelectedFile: (id: string) => void;
  clearSelection: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  selectedFileIds: [],
  loading: false,
  uploading: false,
  error: null,

  fetchFiles: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fileApi.list({ limit: 100 });
      if (res.success && res.data) {
        set({ files: res.data.files, loading: false });
      } else {
        set({ error: res.error || 'Failed to load files', loading: false });
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  uploadFiles: async (files: File[]) => {
    set({ uploading: true, error: null });
    try {
      const res = await fileApi.upload(files);
      if (res.success && res.data) {
        // Add new files to the list and refresh to get updated status
        set(state => ({
          files: [...res.data!, ...state.files],
          uploading: false,
        }));
        // Poll for status updates (files start as 'processing')
        setTimeout(() => get().fetchFiles(), 3000);
        setTimeout(() => get().fetchFiles(), 8000);
      } else {
        set({ error: res.error || 'Upload failed', uploading: false });
      }
    } catch (err: any) {
      set({ error: err.message, uploading: false });
    }
  },

  deleteFile: async (id: string) => {
    try {
      const res = await fileApi.delete(id);
      if (res.success) {
        set(state => ({
          files: state.files.filter(f => f.id !== id),
          selectedFileIds: state.selectedFileIds.filter(fid => fid !== id),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  reindexFile: async (id: string) => {
    try {
      const res = await fileApi.reindex(id);
      if (res.success) {
        // Update status to processing
        set(state => ({
          files: state.files.map(f =>
            f.id === id ? { ...f, status: 'processing' as const, errorMessage: null } : f
          ),
        }));
        // Poll for completion
        setTimeout(() => get().fetchFiles(), 3000);
        setTimeout(() => get().fetchFiles(), 8000);
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setSelectedFiles: (ids: string[]) => {
    set({ selectedFileIds: ids });
  },

  toggleSelectedFile: (id: string) => {
    set(state => {
      const exists = state.selectedFileIds.includes(id);
      return {
        selectedFileIds: exists
          ? state.selectedFileIds.filter(fid => fid !== id)
          : [...state.selectedFileIds, id],
      };
    });
  },

  clearSelection: () => {
    set({ selectedFileIds: [] });
  },
}));
