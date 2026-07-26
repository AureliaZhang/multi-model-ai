import { useEffect, useState } from 'react';
import { Megaphone, X, Loader2 } from 'lucide-react';
import { announcementApi } from '../../services/api';
import { useTranslation } from '../../i18n';

/**
 * Team announcement manager (v0.7.76, owner feedback). Announcements are
 * occasional, so the settings page shows a compact card + button instead of an
 * always-open editor. Flow: button → edit dialog → PREVIEW (rendered exactly
 * like the member-facing banner) → confirm → published. A published
 * announcement can be edited or retracted (撤回) at any time; retracting keeps
 * the text so it can be re-published later.
 */
export function AnnouncementManager() {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Dialog state: null = closed; 'edit' | 'preview' are the two wizard steps.
  const [step, setStep] = useState<null | 'edit' | 'preview'>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    announcementApi.get().then((res) => {
      if (!cancelled && res.success && res.data) {
        setContent(res.data.content);
        setEnabled(res.data.enabled);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const openEditor = () => {
    setDraft(content);
    setStep('edit');
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await announcementApi.set({ content: draft.trim(), enabled: true });
      if (res.success && res.data) {
        setContent(res.data.content);
        setEnabled(res.data.enabled);
        setStep(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const retract = async () => {
    if (!window.confirm(t('announcement.retractConfirm'))) return;
    setBusy(true);
    try {
      // Keep the text — only flip the switch, so it can be re-published later.
      const res = await announcementApi.set({ enabled: false });
      if (res.success) setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5 p-4 rounded-2xl bg-[var(--color-main-surface-secondary)] border border-[var(--color-border-light)]">
      <div className="flex items-center gap-2.5 flex-wrap">
        <Megaphone size={15} className="text-[var(--color-accent-main)] flex-shrink-0" />
        <h3 className="font-medium text-sm text-[var(--color-text-primary)]">{t('announcement.title')}</h3>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
            enabled
              ? 'bg-[var(--color-surface-success)] text-[var(--color-text-success)]'
              : 'bg-[var(--overlay-5)] text-[var(--color-text-tertiary)]'
          }`}
        >
          {enabled ? t('announcement.statusOn') : t('announcement.statusOff')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {enabled && (
            <button
              type="button"
              onClick={() => void retract()}
              disabled={busy || !loaded}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border-light)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)] transition-colors disabled:opacity-40"
            >
              {t('announcement.retract')}
            </button>
          )}
          <button
            type="button"
            onClick={openEditor}
            disabled={!loaded}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-accent-main)] hover:opacity-90 text-white text-xs font-medium transition-opacity disabled:opacity-40"
          >
            {enabled ? t('announcement.editBtn') : t('announcement.publish')}
          </button>
        </div>
      </div>

      {/* Published content, shown small so the lead remembers what's live */}
      {enabled && content && (
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)] whitespace-pre-wrap break-words line-clamp-2">
          {content}
        </p>
      )}

      {/* Wizard dialog */}
      {step !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setStep(null)}>
          <div
            className="w-full max-w-lg rounded-2xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <Megaphone size={15} className="text-[var(--color-accent-main)]" />
                {step === 'edit' ? t('announcement.title') : t('announcement.previewTitle')}
              </h3>
              <button
                onClick={() => setStep(null)}
                className="p-1 rounded-md hover:bg-[var(--overlay-5)] text-[var(--color-text-tertiary)]"
                aria-label={t('common.cancel')}
              >
                <X size={16} />
              </button>
            </div>

            {step === 'edit' ? (
              <>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mb-2">{t('announcement.desc')}</p>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('announcement.placeholder')}
                  rows={4}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-[var(--composer-bg)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-main)] resize-y"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setStep(null)}
                    className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)]"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => setStep('preview')}
                    disabled={!draft.trim()}
                    className="px-4 py-1.5 rounded-lg bg-[var(--color-accent-main)] hover:opacity-90 disabled:opacity-40 text-white text-xs font-medium"
                  >
                    {t('announcement.next')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mb-2">{t('announcement.previewHint')}</p>
                {/* Rendered exactly like the member-facing banner */}
                <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg border border-[var(--color-border-light)] bg-[var(--accent-tint-8)] text-[13px] text-[var(--color-text-primary)]">
                  <Megaphone size={15} className="text-[var(--color-accent-main)] flex-shrink-0 mt-0.5" />
                  <p className="flex-1 min-w-0 whitespace-pre-wrap leading-relaxed">{draft.trim()}</p>
                  <X size={14} className="text-[var(--color-text-tertiary)] flex-shrink-0 mt-0.5" />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setStep('edit')}
                    className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)]"
                  >
                    {t('announcement.backEdit')}
                  </button>
                  <button
                    onClick={() => void publish()}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--color-accent-main)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium"
                  >
                    {busy && <Loader2 size={12} className="animate-spin" />}
                    {t('announcement.confirmPublish')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
