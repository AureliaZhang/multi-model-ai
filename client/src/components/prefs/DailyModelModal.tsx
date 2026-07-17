import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { usePrefsStore } from '../../stores/prefsStore';
import { useTranslation } from '../../i18n';
import { X } from 'lucide-react';

/**
 * Daily first-entry modal:
 * - Admin: step1 confirm → step2 pick chat/image/tts
 * - User: pick chat/image/tts only
 * Optional "don't show again"
 */
export function DailyModelModal() {
  const user = useAuthStore((s) => s.user);
  const show = usePrefsStore((s) => s.showDailyModal);
  const prefs = usePrefsStore((s) => s.prefs);
  const catalog = usePrefsStore((s) => s.catalog);
  const fetchCatalog = usePrefsStore((s) => s.fetchCatalog);
  const savePrefs = usePrefsStore((s) => s.savePrefs);
  const closeDailyModal = usePrefsStore((s) => s.closeDailyModal);
  const { t } = useTranslation();

  const isAdmin = user?.role === 'admin' || prefs?.role === 'admin';
  const [step, setStep] = useState<1 | 2>(isAdmin ? 1 : 2);
  const [chatModel, setChatModel] = useState(prefs?.chatModel || '');
  const [imageModel, setImageModel] = useState(prefs?.imageModel || '');
  const [ttsModel, setTtsModel] = useState(prefs?.ttsModel || '');
  const [skip, setSkip] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      fetchCatalog();
      setStep(isAdmin ? 1 : 2);
      setChatModel(prefs?.chatModel || '');
      setImageModel(prefs?.imageModel || '');
      setTtsModel(prefs?.ttsModel || '');
    }
  }, [show, isAdmin, fetchCatalog]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  const onSave = async () => {
    setSaving(true);
    await savePrefs({
      chatModel: chatModel || null,
      imageModel: imageModel || null,
      ttsModel: ttsModel || null,
      skipDailyModal: skip,
      markModalSeen: true,
      autoTts: true,
    });
    setSaving(false);
    closeDailyModal();
  };

  const onSkipToday = async () => {
    setSaving(true);
    await savePrefs({ markModalSeen: true, skipDailyModal: skip });
    setSaving(false);
    closeDailyModal();
  };

  const selectCls =
    'w-full rounded-xl bg-[var(--overlay-4)] border border-[var(--color-border-light)] px-3 py-2 text-sm text-[var(--color-text-primary)]';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-primary)] shadow-2xl p-5 relative">
        <button
          type="button"
          onClick={onSkipToday}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--overlay-6)]"
        >
          <X size={16} />
        </button>

        {isAdmin && step === 1 ? (
          <>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2 pr-8">
              {t('prefs.adminStep1Title')}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              {t('prefs.adminStep1Desc')}
            </p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl bg-[var(--color-accent-main)] text-white text-sm font-medium"
            >
              {t('prefs.confirmContinue')}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1 pr-8">
              {isAdmin ? t('prefs.adminStep2Title') : t('prefs.userTitle')}
            </h2>
            <p className="text-[12px] text-[var(--color-text-tertiary)] mb-4">
              {t('prefs.pickDesc')}
            </p>

            <div className="space-y-3">
              <label className="block text-[12px] text-[var(--color-text-secondary)]">
                {t('prefs.chatModel')}
                <select
                  className={`${selectCls} mt-1`}
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                >
                  <option value="">{t('prefs.optional')}</option>
                  {(catalog?.chat || []).map((m) => (
                    <option key={m.normalizedName} value={m.normalizedName}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[12px] text-[var(--color-text-secondary)]">
                {t('prefs.imageModel')}
                <select
                  className={`${selectCls} mt-1`}
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                >
                  <option value="">{t('prefs.optional')}</option>
                  {(catalog?.image || []).map((m) => (
                    <option key={m.normalizedName} value={m.normalizedName}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[12px] text-[var(--color-text-secondary)]">
                {t('prefs.ttsModel')}
                <select
                  className={`${selectCls} mt-1`}
                  value={ttsModel}
                  onChange={(e) => setTtsModel(e.target.value)}
                >
                  <option value="">{t('prefs.optional')}</option>
                  {(catalog?.tts || []).map((m) => (
                    <option key={m.normalizedName} value={m.normalizedName}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-tertiary)] cursor-pointer">
                <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
                {t('prefs.dontShowAgain')}
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-3 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm text-[var(--color-text-secondary)]"
                >
                  {t('prefs.back')}
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={onSave}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-accent-main)] text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? t('common.loading') : t('prefs.save')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
