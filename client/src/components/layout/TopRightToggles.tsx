import { Sun, Moon, Globe } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { useTranslation } from '../../i18n';

// Compact, subtle icon buttons — no heavy grey block; blends into the UI.
const btnClass =
  'flex items-center gap-1 px-2 py-1 rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--overlay-6)] hover:text-[var(--color-text-primary)] transition-colors text-xs';

/**
 * Theme + language toggle cluster.
 * - variant="fixed" (default): floats top-right — for standalone screens with
 *   no header of their own (login / register).
 * - variant="inline" (v0.7.78): renders as a plain flex group so每个页面的顶栏
 *   can put it IN the button row — perfectly aligned & evenly spaced, and the
 *   whole "floating cluster covers header buttons" bug class disappears.
 */
export function TopRightToggles({ variant = 'fixed' }: { variant?: 'fixed' | 'inline' }) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { t, locale, setLocale } = useTranslation();

  return (
    <div
      className={
        variant === 'inline'
          ? 'flex items-center gap-1 flex-shrink-0'
          : 'fixed top-4 right-4 z-[60] flex items-center gap-2'
      }
    >
      <button
        type="button"
        onClick={toggleTheme}
        className={btnClass}
        title={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
        aria-label={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <button
        type="button"
        onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
        className={btnClass}
        title={locale === 'en' ? '切换到中文' : 'Switch to English'}
      >
        <Globe size={16} />
        <span>{locale === 'en' ? '中文' : 'EN'}</span>
      </button>
    </div>
  );
}
