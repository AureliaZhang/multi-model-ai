import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { useTranslation } from '../../i18n';

/**
 * Always-visible theme switch — sits just left of the LanguageToggle (top-right).
 * Toggles the `.dark` class on <html> via the theme store.
 */
export function ThemeToggle({
  className,
}: {
  className?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={
        className ??
        'fixed top-4 right-16 z-[60] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--overlay-20)] backdrop-blur-sm border border-[var(--color-border-light)] hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors text-sm shadow-sm'
      }
      title={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
      aria-label={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
