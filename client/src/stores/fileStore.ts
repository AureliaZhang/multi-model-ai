import { create } from 'zustand';
import type { FileLibraryEntry, FileFolder } from '../types';
import { fileApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';

interface FileState {
  files: FileLibraryEntry[];
  folders: FileFolder[];
  currentFolderId: string | null;
  breadcrumb: { id: string; name: string }[];
  selectedFileIds: string[];
  loading: boolean;
  uploading: boolean;
  error: string | null;

  fetchFiles: (folderId?: string | null) => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  navigateToFolder: (folderId: string | null) => Promise<void>;
  uploadFiles: (files: File[], folderId?: string | null) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  reindexFile: (id: string) => Promise<void>;
  setSelectedFiles: (ids: string[]) => void;
  toggleSelectedFile: (id: string) => void;
  clearSelection: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  folders: [],
  currentFolderId: null,
  breadcrumb: [],
  selectedFileIds: [],
  loading: false,
  uploading: false,
  error: null,

  fetchFiles: async (folderId?: string | null) => {
    const targetFolderId = folderId !== undefined ? folderId : get().currentFolderId;
    set({ loading: true, error: null });
    try {
      const res = await fileApi.list({ limit: 100, folderId: targetFolderId || undefined });
      if (res.success && res.data) {
        set({
          folders: res.data.folders || [],
          files: res.data.files,
          currentFolderId: targetFolderId || null,
          loading: false,
        });
      } else {
        set({ error: res.error || 'Failed to load files', loading: false });
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  createFolder: async (name: string, parentId?: string | null) => {
    try {
      const res = await fileApi.folders.create(name, parentId || get().currentFolderId || undefined);
      if (res.success && res.data) {
        set(state => ({ folders: [...state.folders, res.data!] }));
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    }
  },

  renameFolder: async (id: string, name: string) => {
    try {
      const res = await fileApi.folders.rename(id, name);
      if (res.success && res.data) {
        set(state => ({
          folders: state.folders.map(f => f.id === id ? { ...f, name } : f),
        }));
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    }
  },

  deleteFolder: async (id: string) => {
    try {
      const res = await fileApi.folders.delete(id);
      if (res.success) {
        // Refresh to get files that were moved to root
        await get().fetchFiles();
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    }
  },

  navigateToFolder: async (folderId: string | null) => {
    set({ currentFolderId: folderId, breadcrumb: folderId ? get().breadcrumb : [] });
    await get().fetchFiles(folderId);
    // Fetch breadcrumb if in a folder
    if (folderId) {
      try {
        const pathRes = await fileApi.folders.getPath(folderId);
        if (pathRes.success && pathRes.data) {
          set({ breadcrumb: pathRes.data });
        }
      } catch {
        // Ignore breadcrumb errors
      }
    } else {
      set({ breadcrumb: [] });
    }
  },

  uploadFiles: async (files: File[], folderId?: string | null) => {
    const targetFolderId = folderId !== undefined ? folderId : get().currentFolderId;
    set({ uploading: true, error: null });
    try {
      const res = await fileApi.upload(files, targetFolderId || undefined);
      if (res.success && res.data) {
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
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), uploading: false });
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
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    }
  },

  reindexFile: async (id: string) => {
    try {
      const res = await fileApi.reindex(id);
      if (res.success) {
        set(state => ({
          files: state.files.map(f =>
            f.id === id ? { ...f, status: 'processing' as const, errorMessage: null } : f
          ),
        }));
        setTimeout(() => get().fetchFiles(), 3000);
        setTimeout(() => get().fetchFiles(), 8000);
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
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
