import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useModelStore } from '../../stores/modelStore';
import { useTranslation } from '../../i18n';
import { X, Wand2 } from 'lucide-react';

interface SystemPromptModalProps {
  onClose: () => void;
}

/**
 * Per-conversation persona / system prompt editor.
 * Injected as the leading system message on every send (server: routes/chat.ts).
 * If no conversation exists yet, saving creates one (using the currently selected
 * model) so the persona applies from the very first message.
 *
 * Rendered only while open (parent mounts it on demand), so initial textarea state
 * is seeded from the active conversation without a syncing effect.
 */
export function SystemPromptModal({ onClose }: SystemPromptModalProps) {
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const createConversation = useChatStore((s) => s.createConversation);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const models = useModelStore((s) => s.models);
  const { t } = useTranslation();

  const current = conversations.find((c) => c.id === currentConversationId);
  const [value, setValue] = useState(current?.systemPrompt || '');
  const [saving, setSaving] = useState(false);

  const hasExisting = !!(current?.systemPrompt && current.systemPrompt.trim());

  const persist = async (systemPrompt: string | null) => {
    setSaving(true);
    try {
      let convId = currentConversationId;
      if (!convId) {
        const model = localStorage.getItem('selected_model') || models[0]?.normalizedName;
        if (!model) return; // no model available — nothing to attach to
        convId = await createConversation(model);
      }
      await updateConversation(convId, { systemPrompt });
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const onSave = () => void persist(value.trim() ? value : null);
  const onClear = () => {
    setValue('');
    void persist(null);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-primary)] shadow-2xl p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--overlay-6)]"
          aria-label={t('common.dismiss')}
        >
          <X size={16} />
        </button>

        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1 pr-8 flex items-center gap-2">
          <Wand2 size={18} className="text-[var(--color-accent-main)]" />
          {t('persona.title')}
        </h2>
        <p className="text-[12px] text-[var(--color-text-tertiary)] mb-4 leading-5">
          {t('persona.desc')}
        </p>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={7}
          placeholder={t('persona.placeholder')}
          className="w-full rounded-xl bg-[var(--overlay-4)] border border-[var(--color-border-light)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] resize-y leading-6 focus:outline-none focus:border-[var(--color-accent-main)]"
        />

        <div className="flex items-center gap-2 mt-4">
          {hasExisting && (
            <button
              type="button"
              disabled={saving}
              onClick={onClear}
              className="px-3 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)] disabled:opacity-50"
            >
              {t('persona.clear')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-3 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="px-4 py-2.5 rounded-xl bg-[var(--color-accent-main)] text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
