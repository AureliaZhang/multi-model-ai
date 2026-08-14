import { create } from 'zustand';
import { getToken } from '../services/auth';

export interface PrefsCatalogModel {
  normalizedName: string;
  displayName: string;
  capabilities: string[];
  stationCount: number;
}

export interface UserModelPrefs {
  chatModel: string | null;
  imageModel: string | null;
  ttsModel: string | null;
  autoTts: boolean;
  role?: string;
}

interface PrefsState {
  prefs: UserModelPrefs | null;
  catalog: { chat: PrefsCatalogModel[]; image: PrefsCatalogModel[]; tts: PrefsCatalogModel[] } | null;
  loading: boolean;
  imageConfirm: { open: boolean; prompt: string } | null;

  fetchPrefs: () => Promise<void>;
  fetchCatalog: () => Promise<void>;
  savePrefs: (patch: Partial<UserModelPrefs>) => Promise<boolean>;
  openImageConfirm: (prompt: string) => void;
  closeImageConfirm: () => void;
}

async function api<T>(url: string, options?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${url}`, { ...options, headers });
  return res.json();
}

export const usePrefsStore = create<PrefsState>((set) => ({
  prefs: null,
  catalog: null,
  loading: false,
  imageConfirm: null,

  fetchPrefs: async () => {
    set({ loading: true });
    try {
      const res = await api<UserModelPrefs>('/prefs');
      if (res.success && res.data) {
        set({
          prefs: res.data,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  fetchCatalog: async () => {
    try {
      const res = await api<{ chat: PrefsCatalogModel[]; image: PrefsCatalogModel[]; tts: PrefsCatalogModel[] }>(
        '/prefs/catalog'
      );
      if (res.success && res.data) set({ catalog: res.data });
    } catch {
      /* ignore */
    }
  },

  savePrefs: async (patch) => {
    const body: Record<string, unknown> = {};
    if (patch.chatModel !== undefined) body.chatModel = patch.chatModel;
    if (patch.imageModel !== undefined) body.imageModel = patch.imageModel;
    if (patch.ttsModel !== undefined) body.ttsModel = patch.ttsModel;
    if (patch.autoTts !== undefined) body.autoTts = patch.autoTts;

    const res = await api<UserModelPrefs>('/prefs', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (res.success && res.data) {
      set({ prefs: res.data });
      return true;
    }
    return false;
  },

  openImageConfirm: (prompt) => set({ imageConfirm: { open: true, prompt } }),
  closeImageConfirm: () => set({ imageConfirm: null }),
}));

export function detectImageIntent(text: string): boolean {
  return /画一|画个|画张|生成.*图|出一张图|做一张|插画|封面图|海报|draw\s|generate\s+(an?\s+)?image|picture of|illustration|文生图|ai\s*绘画|帮我画/i.test(
    text
  );
}

export async function generateImage(model: string, prompt: string) {
  return api<{ modelUsed: string; images: { url: string | null }[] }>('/media/images', {
    method: 'POST',
    body: JSON.stringify({ model, prompt }),
  });
}

export async function synthesizeSpeech(model: string, input: string) {
  return api<{ modelUsed: string; dataUrl: string; mimeType: string }>('/media/tts', {
    method: 'POST',
    body: JSON.stringify({ model, input }),
  });
}
