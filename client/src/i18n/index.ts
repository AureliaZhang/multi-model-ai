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

    // `{s}` is the English plural marker ("{count} file{s} selected"). It used to
    // be the caller's job to pass it, and four of the six call sites forgot — so
    // the English UI literally rendered "3 script{s}" / "2 file{s} selected".
    // The station-count site got it wrong the other way (`count > 1 ? 's' : ''`
    // renders "0 station available"). Deriving it here from `count` kills the whole
    // bug class: there is nothing left for a call site to forget or get wrong.
    // An explicitly passed `s` still wins, because the loop above already ran.
    if (typeof value === 'string' && value.includes('{s}')) {
      const n = params?.count;
      value = value.replace(/\{s\}/g, Number(n) === 1 ? '' : 's');
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
