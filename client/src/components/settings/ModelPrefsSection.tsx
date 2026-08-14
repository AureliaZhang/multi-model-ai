import { useEffect, useState } from 'react';
import { usePrefsStore } from '../../stores/prefsStore';
import { useTranslation } from '../../i18n';
import { Check, Loader2 } from 'lucide-react';

/**
 * Default model slots (v0.7.92), replacing the daily-model modal.
 *
 * The modal asked you to commit to today's models on first entry and could not
 * be reopened afterwards, which fit a "decide once each morning" workflow the
 * owner never wanted — she wants to switch freely, Cherry Studio style. So the
 * three slots live here, editable at any time.
 *
 * Note the division of labour: the CHAT slot is only a starting point. The
 * header selector wins for the message you are about to send (see ChatInput);
 * this is what the app opens with. Image and TTS have no per-message picker,
 * so for them this really is the setting.
 */
export function ModelPrefsSection() {
  const { t } = useTranslation();
  const prefs = usePrefsStore((s) => s.prefs);
  const catalog = usePrefsStore((s) => s.catalog);
  const fetchPrefs = usePrefsStore((s) => s.fetchPrefs);
  const fetchCatalog = usePrefsStore((s) => s.fetchCatalog);
  const savePrefs = usePrefsStore((s) => s.savePrefs);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    fetchPrefs();
    fetchCatalog();
  }, [fetchPrefs, fetchCatalog]);

  const commit = async (patch: Parameters<typeof savePrefs>[0]) => {
    setSaving(true);
    const ok = await savePrefs(patch);
    setSaving(false);
    if (ok) setSavedAt(Date.now());
  };

  const onChat = (value: string) => {
    // Keep the header selector in step — they are two views of one choice, and
    // letting them disagree is what made a stale default hijack every send.
    if (value) localStorage.setItem('selected_model', value);
    commit({ chatModel: value || null });
  };

  const selectCls =
    'w-full rounded-xl bg-[var(--overlay-4)] border border-[var(--color-border-light)] px-3 py-2 text-sm text-[var(--color-text-primary)]';

  const slots = [
    { key: 'chat' as const, label: t('prefs.chatModel'), value: prefs?.chatModel || '', hint: t('prefs.chatSlotHint'), onChange: onChat },
    { key: 'image' as const, label: t('prefs.imageModel'), value: prefs?.imageModel || '', hint: t('prefs.imageSlotHint'), onChange: (v: string) => commit({ imageModel: v || null }) },
    { key: 'tts' as const, label: t('prefs.ttsModel'), value: prefs?.ttsModel || '', hint: t('prefs.ttsSlotHint'), onChange: (v: string) => commit({ ttsModel: v || null }) },
  ];

  return (
    <div className="mb-5 p-4 rounded-2xl bg-[var(--color-main-surface-secondary)] border border-[var(--color-border-light)]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-medium text-sm text-[var(--color-text-primary)]">{t('prefs.sectionTitle')}</h3>
        <span className="text-[11px] text-[var(--color-text-tertiary)] flex items-center gap-1">
          {saving && <Loader2 size={12} className="animate-spin" />}
          {!saving && savedAt > 0 && (
            <>
              <Check size={12} className="text-[var(--color-accent-main)]" />
              {t('prefs.saved')}
            </>
          )}
        </span>
      </div>
      <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3 leading-relaxed">{t('prefs.sectionDesc')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {slots.map((slot) => (
          <label key={slot.key} className="block text-[12px] text-[var(--color-text-secondary)]">
            {slot.label}
            <select
              className={`${selectCls} mt-1`}
              value={slot.value}
              onChange={(e) => slot.onChange(e.target.value)}
            >
              <option value="">{t('prefs.optional')}</option>
              {(catalog?.[slot.key] || []).map((m) => (
                <option key={m.normalizedName} value={m.normalizedName}>
                  {m.displayName}
                </option>
              ))}
            </select>
            <span className="block mt-1 text-[11px] text-[var(--color-text-tertiary)] leading-snug">{slot.hint}</span>
          </label>
        ))}
      </div>

      {/* Only reachable once a TTS model exists — until v0.7.92 this flag was
          hard-set to true by the modal with no way back, so picking a TTS model
          meant every reply read itself aloud, permanently. */}
      {prefs?.ttsModel && (
        <label className="mt-3 flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(prefs?.autoTts)}
            onChange={(e) => commit({ autoTts: e.target.checked })}
          />
          {t('prefs.autoTts')}
        </label>
      )}
    </div>
  );
}
