import { Bot, User, FileIcon } from 'lucide-react';
import type { Message } from '../../types';
import ReactMarkdown from 'react-markdown';
import { ToolCallBlock } from './ToolCallBlock';
import { useTranslation } from '../../i18n';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { t } = useTranslation();

  return (
    <div className="group px-4 py-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors duration-150">
      <div className="max-w-[768px] lg:max-w-[840px] mx-auto flex gap-4">
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
                att.type === 'image' ? (
                  <div key={att.id} className="max-w-sm rounded-lg overflow-hidden border border-[var(--color-border-light)]">
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="w-full h-auto max-h-[300px] object-contain"
                    />
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
              <ReactMarkdown>{message.content}</ReactMarkdown>
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
