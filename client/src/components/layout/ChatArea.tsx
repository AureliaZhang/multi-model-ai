import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { ModelSelector } from '../chat/ModelSelector';
import { ChatInput } from '../chat/ChatInput';
import { MessageBubble } from '../chat/MessageBubble';
import { Sparkles } from 'lucide-react';

interface ChatAreaProps {
  isGuest?: boolean;
  onSignIn?: () => void;
}

export function ChatArea({ isGuest = false, onSignIn }: ChatAreaProps) {
  const messages = useChatStore(s => s.messages);
  const isStreaming = useChatStore(s => s.isStreaming);
  const streamingContent = useChatStore(s => s.streamingContent);
  const error = useChatStore(s => s.error);
  const clearError = useChatStore(s => s.clearError);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Header with model selector */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-main-surface-primary)]" style={{ minHeight: '52px' }}>
        <ModelSelector />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isStreaming ? (
          // Empty state - ChatGPT style
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-accent-main)] flex items-center justify-center mb-5">
              <Sparkles size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-[var(--color-text-primary)]">
              {isGuest ? 'Browse Mode' : 'How can I help you today?'}
            </h2>
            <p className="text-[var(--color-text-tertiary)] text-sm max-w-md leading-6">
              {isGuest
                ? 'You are browsing as a guest. Sign in to start chatting with AI models.'
                : 'Select a model from the dropdown above and start chatting. You can also upload files or use image generation models.'}
            </p>
          </div>
        ) : (
          // Message list
          <div className="max-w-[768px] lg:max-w-[840px] mx-auto">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming message */}
            {isStreaming && (
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
            )}

            {/* Error */}
            {error && (
              <div className="mx-4 mb-4 p-3 rounded-xl bg-[var(--color-surface-error)] border border-[rgba(239,68,68,0.2)] text-[var(--color-text-error)] text-sm flex items-center justify-between">
                <span>{error}</span>
                <button onClick={clearError} className="text-[var(--color-text-error)] hover:opacity-70 ml-2 text-xs font-medium">Dismiss</button>
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
