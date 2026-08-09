import { useState } from 'react';
import { usePrefsStore, generateImage } from '../../stores/prefsStore';
import { useChatStore } from '../../stores/chatStore';
import { useTranslation } from '../../i18n';
import { ImageIcon, X } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

export function ImageConfirmModal() {
  const imageConfirm = usePrefsStore((s) => s.imageConfirm);
  const closeImageConfirm = usePrefsStore((s) => s.closeImageConfirm);
  const prefs = usePrefsStore((s) => s.prefs);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!imageConfirm?.open) return null;

  const onConfirm = async () => {
    const model = prefs?.imageModel;
    if (!model) {
      setError(t('prefs.needImageModel'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await generateImage(model, imageConfirm.prompt);
      if (!res.success || !res.data?.images?.length) {
        setError(res.error || t('prefs.imageFailed'));
        setLoading(false);
        return;
      }
      const url = res.data.images[0].url;
      if (!url) {
        setError(t('prefs.imageFailed'));
        setLoading(false);
        return;
      }
      // Inject as assistant message with image attachment
      const now = new Date().toISOString();
      const msg = {
        id: `img-${Date.now()}`,
        conversationId: useChatStore.getState().currentConversationId || '',
        role: 'assistant' as const,
        content: t('prefs.imageReady'),
        attachments: [
          {
            id: `att-${Date.now()}`,
            type: 'image' as const,
            filename: 'generated.png',
            mimeType: 'image/png',
            url,
          },
        ],
        modelUsed: res.data.modelUsed,
        createdAt: now,
      };
      useChatStore.setState((s) => ({
        messages: [...s.messages, msg],
      }));
      closeImageConfirm();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || t('prefs.imageFailed'));
    }
    setLoading(false);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t('prefs.imageConfirmTitle')} className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-primary)] p-5 relative dialog-panel overflow-y-auto">
        <button
          type="button"
          onClick={closeImageConfirm}
          className="absolute top-3 right-3 p-1.5 text-[var(--color-text-tertiary)]"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 mb-3 text-[var(--color-accent-main)]">
          <ImageIcon size={20} />
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t('prefs.imageConfirmTitle')}
          </h2>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-2">{t('prefs.imageConfirmDesc')}</p>
        <div className="text-[13px] rounded-xl border border-[var(--color-border-light)] bg-[var(--overlay-3)] p-3 mb-4 max-h-28 overflow-y-auto whitespace-pre-wrap text-[var(--color-text-primary)]">
          {imageConfirm.prompt}
        </div>
        {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeImageConfirm}
            className="flex-1 py-2 rounded-xl border border-[var(--color-border-light)] text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-[var(--color-accent-main)] text-white text-sm disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('prefs.confirmDraw')}
          </button>
        </div>
      </div>
    </div>
  );
}
