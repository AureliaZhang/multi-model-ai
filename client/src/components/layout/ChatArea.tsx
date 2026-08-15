import { useEffect, useRef, useState, useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { ModelSelector } from '../chat/ModelSelector';
import { ChatInput } from '../chat/ChatInput';
import { MessageBubble } from '../chat/MessageBubble';
import { SystemPromptModal } from '../chat/SystemPromptModal';
import { ErrorBoundary } from '../ErrorBoundary';
import { Sparkles, ChevronUp, PanelLeft, Wand2 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { friendlyErrorKey } from '../../utils/errors';
import { TopRightToggles } from './TopRightToggles';

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
  const errorDetail = useChatStore(s => s.errorDetail);
  const clearError = useChatStore(s => s.clearError);
  const lastFailedSend = useChatStore(s => s.lastFailedSend);
  const retryLastSend = useChatStore(s => s.retryLastSend);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  /** Whether new content should scroll itself into view — see handleMessagesScroll. */
  const followBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [personaOpen, setPersonaOpen] = useState(false);
  const conversations = useChatStore(s => s.conversations);

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

  // Opening a different conversation starts at its bottom, whatever the scroll
  // position of the one you left.
  useEffect(() => {
    followBottomRef.current = true;
  }, [currentConversationId]);

  useEffect(() => {
    const grew = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    // Sending puts you back in follow mode — you just added the thing at the bottom.
    if (grew && messages[messages.length - 1]?.role === 'user') {
      followBottomRef.current = true;
    }

    // Only follow if the reader is already at the bottom (v0.7.97). This effect
    // also runs on every streamed token, and it used to scroll unconditionally:
    // scrolling up mid-answer was impossible, because the next token yanked you
    // back — and `behavior: 'smooth'` layered a fresh animation over the last one
    // dozens of times a second, so the view fought the wheel rather than ignoring
    // it. Token updates now jump instantly (no animation to queue) while a whole
    // new message still glides.
    if (!followBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: grew ? 'smooth' : 'auto' });
  }, [messages, streamingContent]);

  /**
   * Follow the bottom only while the reader is there. 40px of slack: a container
   * resting at the bottom is often a fraction of a pixel short, and a phone's
   * elastic overscroll lands nearby rather than exactly.
   */
  const handleMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    followBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const hasPersona = !!conversations.find(c => c.id === currentConversationId)?.systemPrompt?.trim();

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Header: open-sidebar (when collapsed) + model selector — same row, no overlap */}
      <div
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-5 py-2 sm:py-3 border-b border-[var(--color-border-light)] bg-[var(--color-main-surface-primary)]"
        style={{ minHeight: '52px' }}
      >
        {sidebarCollapsed && onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[var(--overlay-5)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            title={t('layout.openSidebar')}
            aria-label={t('layout.openSidebar')}
          >
            <PanelLeft size={20} strokeWidth={1.5} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <ModelSelector />
        </div>
        {!isGuest && (
          <button
            type="button"
            onClick={() => setPersonaOpen(true)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              hasPersona
                ? 'text-[var(--color-accent-main)] bg-[var(--overlay-5)] hover:bg-[var(--overlay-6)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--overlay-5)]'
            }`}
            title={t('persona.title')}
            aria-label={t('persona.title')}
          >
            <Wand2 size={16} strokeWidth={1.75} />
            <span className="hidden sm:inline">{t('persona.button')}</span>
          </button>
        )}
        <TopRightToggles variant="inline" />
      </div>

      {personaOpen && <SystemPromptModal onClose={() => setPersonaOpen(false)} />}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto" ref={messagesScrollRef} onScroll={handleMessagesScroll}>
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
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)] transition-colors"
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
              <div className="mx-4 mb-4 p-3 rounded-xl bg-[var(--color-surface-error)] border border-[rgba(239,68,68,0.2)] text-[var(--color-text-error)] text-sm">
                <div className="flex items-center justify-between">
                  <span title={error}>
                    {(() => { const k = friendlyErrorKey(error); return k ? t(k) : error; })()}
                    {/* Name the model the request actually carried (v0.7.91).
                        The server quotes it in every station-pool message; the
                        localized text alone left "this model" ambiguous, which
                        cost an afternoon when the name sent was not the one
                        showing in the selector. */}
                    {(() => {
                      const named = friendlyErrorKey(error) && error.match(/"([^"]+)"/)?.[1];
                      return named ? <span className="opacity-70"> （{named}）</span> : null;
                    })()}
                  </span>
                  <div className="flex items-center gap-3 ml-2 shrink-0">
                    {lastFailedSend && (
                      <button onClick={retryLastSend} className="text-[var(--color-text-error)] hover:opacity-70 text-xs font-medium">{t('common.retry')}</button>
                    )}
                    <button onClick={clearError} className="text-[var(--color-text-error)] hover:opacity-70 text-xs font-medium">{t('common.dismiss')}</button>
                  </div>
                </div>
                {/* What each station actually answered (v0.7.90, admins only —
                    the server omits it otherwise). Collapsed by default so a
                    401 body doesn't shove the composer down the screen, and a
                    real element rather than a title= tooltip, which a phone
                    cannot hover. */}
                {errorDetail && (
                  <details
                    className="mt-2"
                    // The banner sits inside the scrolling message list, so
                    // expanding it otherwise grows the box below the fold —
                    // exactly the text the user opened it to read.
                    onToggle={(e) => {
                      if (e.currentTarget.open) e.currentTarget.scrollIntoView({ block: 'nearest' });
                    }}
                  >
                    <summary className="cursor-pointer text-xs opacity-80 hover:opacity-100 select-none">
                      {t('error.stationDetails')}
                    </summary>
                    <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed opacity-90 font-mono">
                      {errorDetail}
                    </pre>
                  </details>
                )}
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
