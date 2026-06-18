import { Bot, User, FileIcon } from 'lucide-react';
import type { Message } from '../../types';
import ReactMarkdown from 'react-markdown';
import { ToolCallBlock } from './ToolCallBlock';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-4 px-4 py-5 fade-in ${isUser ? '' : 'bg-[rgba(255,255,255,0.02)]'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-sm flex items-center justify-center ${
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
          {isUser ? 'You' : 'Assistant'}
        </div>

        {/* Attachments (images inline, files as chips) */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.attachments.map(att => (
              att.type === 'image' ? (
                <div key={att.id} className="max-w-[300px] rounded-lg overflow-hidden border border-[var(--color-border-light)]">
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
          <div className="mb-2">
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
            <ReactMarkdown>{message.content || ' '}</ReactMarkdown>
          )}
        </div>
        {message.modelUsed && !isUser && (
          <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            {message.modelUsed}
          </div>
        )}
      </div>
    </div>
  );
}
