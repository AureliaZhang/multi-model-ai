import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { announcementApi, type Announcement } from '../../services/api';
import { useTranslation } from '../../i18n';

const DISMISS_KEY = 'announcement_dismissed';

/**
 * Admin broadcast banner (v0.7.63, §10.9 P2 #6). Shown above the chat area
 * when an enabled announcement exists; dismissal is per content version
 * (keyed on updatedAt), so a NEW announcement re-surfaces for everyone.
 */
export function AnnouncementBanner() {
  const { t } = useTranslation();
  const [ann, setAnn] = useState<Announcement | null>(null);
  const [dismissedAt, setDismissedAt] = useState<string | null>(
    () => { try { return localStorage.getItem(DISMISS_KEY); } catch { return null; } }
  );

  useEffect(() => {
    let cancelled = false;
    announcementApi.get().then((res) => {
      if (!cancelled && res.success && res.data) setAnn(res.data);
    }).catch(() => { /* banner is best-effort */ });
    return () => { cancelled = true; };
  }, []);

  if (!ann?.enabled || !ann.content.trim()) return null;
  if (dismissedAt && ann.updatedAt && dismissedAt === ann.updatedAt) return null;

  const dismiss = () => {
    const version = ann.updatedAt || 'unknown';
    try { localStorage.setItem(DISMISS_KEY, version); } catch { /* private mode */ }
    setDismissedAt(version);
  };

  return (
    <div className="flex items-start gap-2.5 px-4 py-2.5 pr-32 border-b border-[var(--color-border-light)] bg-[var(--accent-tint-8)] text-[13px] text-[var(--color-text-primary)]">
      <Megaphone size={15} className="text-[var(--color-accent-main)] flex-shrink-0 mt-0.5" />
      <p className="flex-1 min-w-0 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('announcement.dismiss')}
        title={t('announcement.dismiss')}
        className="p-1 rounded-md hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)] flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
