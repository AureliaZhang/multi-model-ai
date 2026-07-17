import { Globe } from 'lucide-react';
import { useTranslation } from '../../i18n';

/**
 * Always-visible language switch — same corner as the login page (top-right).
 */
export function LanguageToggle({
  className,
}: {
  className?: string;
}) {
  const { locale, setLocale } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
      className={
        className ??
        'fixed top-4 right-4 z-[60] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--overlay-20)] backdrop-blur-sm border border-[var(--color-border-light)] hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors text-sm shadow-sm'
      }
      title={locale === 'en' ? '切换到中文' : 'Switch to English'}
    >
      <Globe size={16} />
      <span>{locale === 'en' ? '中文' : 'EN'}</span>
    </button>
  );
}
