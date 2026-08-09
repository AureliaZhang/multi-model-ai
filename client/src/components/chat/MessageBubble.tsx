import { useState } from 'react';
import { Bot, User, FileIcon, Copy, Check, RefreshCw, Pencil } from 'lucide-react';
import type { Message } from '../../types';
import { ToolCallBlock } from './ToolCallBlock';
import { useTranslation } from '../../i18n';
import { MarkdownMessage } from '../common/MarkdownMessage';
import { useChatStore } from '../../stores/chatStore';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { t } = useTranslation();

  const globalStreaming = useChatStore((s) => s.isStreaming);
  const regenerateMessage = useChatStore((s) => s.regenerateMessage);
  const editMessage = useChatStore((s) => s.editMessage);

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Actions don't apply to the live streaming placeholder.
  const showActions = message.id !== 'streaming';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const startEdit = () => {
    setDraft(message.content);
    setEditing(true);
  };

  const saveEdit = () => {
    const text = draft.trim();
    if (!text) return;
    setEditing(false);
    editMessage(message.id, text);
  };

  return (
    <div className="group px-4 py-4 bg-[var(--overlay-4)] hover:bg-[var(--overlay-7)] transition-colors duration-150 rounded-xl mb-1">
      <div className="max-w-[768px] lg:max-w-[960px] xl:max-w-[1200px] mx-auto flex gap-4">
        {/* Avatar */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser
            ? 'bg-[var(--button-primary-bg)]'
            : 'bg-[var(--color-assistant)]'
        }`}>
          {isUser ? (
            <User size={14} className="text-white" strokeWidth={2} />
          ) : (
            <Bot size={14} className="text-white" strokeWidth={2} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[13px] font-semibold mb-1 text-[var(--color-text-primary)]">
            {isUser ? t('message.you') : t('message.assistant')}
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map(att => (
                att.type === 'image' || att.mimeType?.startsWith('image/') ? (
                  <div key={att.id} className="max-w-sm rounded-lg overflow-hidden border border-[var(--color-border-light)]">
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="w-full h-auto max-h-[300px] object-contain"
                    />
                  </div>
                ) : att.mimeType?.startsWith('audio/') || att.filename?.endsWith('.mp3') || att.filename?.endsWith('.wav') ? (
                  <div key={att.id} className="w-full max-w-md">
                    <audio controls src={att.url} className="w-full h-10" />
                  </div>
                ) : (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 bg-[var(--color-bg-secondary)] rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    <FileIcon size={14} className="text-[var(--color-text-tertiary)]" />
                    <span className="text-[var(--color-text-secondary)]">{att.filename}</span>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Tool calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-2 mb-2">
              {message.toolCalls.map(tc => (
                <ToolCallBlock key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}

          {/* Text content — or inline editor for a user message being edited */}
          {isUser && editing ? (
            <div>
              <textarea
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                rows={Math.min(10, Math.max(2, draft.split('\n').length))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-[15px] leading-7 text-[var(--color-text-primary)] resize-y focus:outline-none focus:border-[var(--color-accent-main)]"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="px-3 py-1.5 rounded-lg bg-[var(--color-accent-main)] text-white text-xs font-medium hover:opacity-90"
                >
                  {t('message.saveResend')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--color-border-light)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)]"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className={`markdown-content text-[15px] leading-7 text-[var(--color-text-primary)] ${isStreaming && !isUser ? 'typing-cursor' : ''}`}>
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <MarkdownMessage content={message.content} />
              )}
            </div>
          )}

          {message.modelUsed && !isUser && (
            <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              {message.modelUsed}
            </div>
          )}

          {/* Message actions (copy / regenerate / edit). Reveal-on-hover ONLY where
              a hover-capable pointer exists — on touch there is no hover, so these
              stay visible or the whole feature is unreachable on a phone. */}
          {showActions && !editing && (
            <div className="flex items-center gap-1 mt-2 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={handleCopy}
                title={t('message.copy')}
                className="touch-target p-1.5 rounded-md hover:bg-[var(--overlay-5)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              >
                {copied ? <Check size={13} className="text-[var(--color-text-success)]" /> : <Copy size={13} />}
              </button>
              {!isUser && (
                <button
                  type="button"
                  onClick={() => regenerateMessage(message.id)}
                  disabled={globalStreaming}
                  title={t('message.regenerate')}
                  className="touch-target p-1.5 rounded-md hover:bg-[var(--overlay-5)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={13} />
                </button>
              )}
              {isUser && (
                <button
                  type="button"
                  onClick={startEdit}
                  disabled={globalStreaming}
                  title={t('message.edit')}
                  className="touch-target p-1.5 rounded-md hover:bg-[var(--overlay-5)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
