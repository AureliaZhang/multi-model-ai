import { Bot, User, FileIcon } from 'lucide-react';
import type { Message } from '../../types';
import { ToolCallBlock } from './ToolCallBlock';
import { useTranslation } from '../../i18n';
import { MarkdownMessage } from '../common/MarkdownMessage';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { t } = useTranslation();


  return (
    <div className="group px-4 py-4 bg-[var(--overlay-4)] hover:bg-[var(--overlay-7)] transition-colors duration-150 rounded-xl mb-1">
      <div className="max-w-[768px] lg:max-w-[960px] xl:max-w-[1200px] mx-auto flex gap-4">
        {/* Avatar */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser
            ? 'bg-[var(--button-primary-bg)]'
            : 'bg-[#ab68ff]'
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

          {/* Text content */}
          <div className={`markdown-content text-[15px] leading-7 text-[var(--color-text-primary)] ${isStreaming && !isUser ? 'typing-cursor' : ''}`}>
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownMessage content={message.content} />
            )}
          </div>

          {message.modelUsed && !isUser && (
            <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              {message.modelUsed}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
