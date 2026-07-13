import { useEffect, useRef, useState, useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { ModelSelector } from '../chat/ModelSelector';
import { ChatInput } from '../chat/ChatInput';
import { MessageBubble } from '../chat/MessageBubble';
import { ErrorBoundary } from '../ErrorBoundary';
import { Sparkles, ChevronUp, PanelLeft } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface ChatAreaProps {
  isGuest?: boolean;
  onSignIn?: () => void;
  /** When true, show open-sidebar control next to model selector (not floating over it). */
  sidebarCollapsed?: boolean;
  onOpenSidebar?: () => void;
}

const PAGE_SIZE = 50;

export function ChatArea({ isGuest = false, onSignIn, sidebarCollapsed = false, onOpenSidebar }: ChatAreaProps) {
  const messages = useChatStore(s => s.messages);
  const isStreaming = useChatStore(s => s.isStreaming);
  const streamingContent = useChatStore(s => s.streamingContent);
  const error = useChatStore(s => s.error);
  const clearError = useChatStore(s => s.clearError);
  const lastFailedSend = useChatStore(s => s.lastFailedSend);
  const retryLastSend = useChatStore(s => s.retryLastSend);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset visible count when conversation changes
  const prevConversationId = useRef<string | null>(null);
  const currentConversationId = useChatStore(s => s.currentConversationId);
  useEffect(() => {
    if (currentConversationId !== prevConversationId.current) {
      prevConversationId.current = currentConversationId;
      setVisibleCount(PAGE_SIZE);
    }
  }, [currentConversationId]);

  // Auto-increase visible count when new messages arrive
  useEffect(() => {
    setVisibleCount(prev => Math.max(prev, messages.length));
  }, [messages.length]);

  const visibleMessages = useMemo(() => {
    if (messages.length <= visibleCount) return messages;
    return messages.slice(messages.length - visibleCount);
  }, [messages, visibleCount]);

  const hasMore = messages.length > visibleCount;

  const handleLoadMore = () => {
    setVisibleCount(prev => Math.min(prev + PAGE_SIZE, messages.length));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Header: open-sidebar (when collapsed) + model selector — same row, no overlap */}
      <div
        className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-main-surface-primary)]"
        style={{ minHeight: '52px' }}
      >
        {sidebarCollapsed && onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            title={t('layout.openSidebar')}
            aria-label={t('layout.openSidebar')}
          >
            <PanelLeft size={20} strokeWidth={1.5} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <ModelSelector />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isStreaming && !error ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-accent-main)] flex items-center justify-center mb-5">
              <Sparkles size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-[var(--color-text-primary)]">
              {isGuest ? t('chat.browseMode') : t('chat.howCanIHelp')}
            </h2>
            <p className="text-[var(--color-text-tertiary)] text-sm max-w-md leading-6">
              {isGuest
                ? t('chat.guestCannotSend')
                : t('chat.aiDisclaimer')}
            </p>
          </div>
        ) : (
          <div className="max-w-[768px] lg:max-w-[960px] xl:max-w-[1200px] mx-auto">
            {hasMore && (
              <div className="flex justify-center py-3">
                <button
                  onClick={handleLoadMore}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                >
                  <ChevronUp size={14} />
                  {t('chat.loadMore', { count: String(Math.min(PAGE_SIZE, messages.length - visibleCount)) })}
                </button>
              </div>
            )}

            {visibleMessages.map(msg => (
              <ErrorBoundary key={msg.id}>
                <MessageBubble message={msg} />
              </ErrorBoundary>
            ))}

            {isStreaming && (
              <ErrorBoundary>
                <MessageBubble
                  message={{
                    id: 'streaming',
                    conversationId: '',
                    role: 'assistant',
                    content: streamingContent,
                    createdAt: new Date().toISOString(),
                  }}
                  isStreaming
                />
              </ErrorBoundary>
            )}

            {error && (
              <div className="mx-4 mb-4 p-3 rounded-xl bg-[var(--color-surface-error)] border border-[rgba(239,68,68,0.2)] text-[var(--color-text-error)] text-sm flex items-center justify-between">
                <span>{error}</span>
                <div className="flex items-center gap-3 ml-2 shrink-0">
                  {lastFailedSend && (
                    <button onClick={retryLastSend} className="text-[var(--color-text-error)] hover:opacity-70 text-xs font-medium">{t('common.retry')}</button>
                  )}
                  <button onClick={clearError} className="text-[var(--color-text-error)] hover:opacity-70 text-xs font-medium">{t('common.dismiss')}</button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput isGuest={isGuest} onSignIn={onSignIn} />
    </div>
  );
}
