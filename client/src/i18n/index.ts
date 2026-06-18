import { create } from 'zustand';
import en from './locales/en';
import zh from './locales/zh';

export type Locale = 'en' | 'zh';

const translations: Record<Locale, Record<string, string | string[]>> = { en, zh };

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// Detect browser language
function detectLocale(): Locale {
  const saved = localStorage.getItem('locale');
  if (saved === 'en' || saved === 'zh') return saved;
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: detectLocale(),
  setLocale: (locale: Locale) => {
    localStorage.setItem('locale', locale);
    set({ locale });
  },
  t: (key: string, params?: Record<string, string | number>): string => {
    const { locale } = get();
    const dict = translations[locale] || translations.en;
    let value = dict[key] ?? translations.en[key] ?? key;

    // Handle array values (for multi-line content like howItWorksSteps)
    if (Array.isArray(value)) {
      value = value.join('\n');
    }

    // Replace {param} placeholders
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = (value as string).replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return value as string;
  },
}));

// Convenience hook
export function useTranslation() {
  const t = useI18nStore(s => s.t);
  const locale = useI18nStore(s => s.locale);
  const setLocale = useI18nStore(s => s.setLocale);
  return { t, locale, setLocale };
}
