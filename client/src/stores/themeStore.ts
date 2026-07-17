import { create } from 'zustand';

export type Theme = 'light' | 'dark';

/**
 * Theme store — mirrors the i18n store pattern. Persists to localStorage['theme']
 * and falls back to the OS preference. The initial <html class="dark"> is set by
 * the inline script in index.html (before first paint) to avoid a flash; this
 * store just reads that same source of truth and keeps it in sync on toggle.
 */
function detectTheme(): Theme {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: detectTheme(),
  setTheme: (theme: Theme) => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },
}));
