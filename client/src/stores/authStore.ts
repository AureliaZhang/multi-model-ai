import { create } from 'zustand';
import type { UserPublic } from '../types';
import { authApi, setToken, removeToken, getToken } from '../services/auth';

interface AuthState {
  user: UserPublic | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string, displayName?: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    const token = getToken();
    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }

    try {
      const res = await authApi.me();
      if (res.success && res.data) {
        set({ user: res.data, isAuthenticated: true, isLoading: false });
      } else {
        removeToken();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      removeToken();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (username: string, password: string) => {
    set({ error: null });
    try {
      const res = await authApi.login({ username, password });
      if (res.success && res.data) {
        setToken(res.data.token);
        set({ user: res.data.user, isAuthenticated: true, error: null });
      } else {
        set({ error: res.error || 'Login failed' });
      }
    } catch (err: any) {
      set({ error: err.message || 'Login failed' });
    }
  },

  register: async (username: string, password: string, email?: string, displayName?: string) => {
    set({ error: null });
    try {
      const res = await authApi.register({ username, password, email, displayName });
      if (res.success && res.data) {
        setToken(res.data.token);
        set({ user: res.data.user, isAuthenticated: true, error: null });
      } else {
        set({ error: res.error || 'Registration failed' });
      }
    } catch (err: any) {
      set({ error: err.message || 'Registration failed' });
    }
  },

  logout: () => {
    removeToken();
    set({ user: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),
}));

export { getToken };
