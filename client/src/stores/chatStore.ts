import { create } from 'zustand';
import type { Conversation, ConversationVisibility, Message, PendingAttachment, ToolCallInfo } from '../types';
import { conversationApi, streamChat } from '../services/api';

// Generation counter to prevent stale selectConversation results from being applied.
// Each call to selectConversation increments this; only the latest call's result is used.
let _selectGeneration = 0;
// Guard to prevent concurrent fetchConversations from double-auto-selecting
let _fetchConvRunning = false;

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  abortController: AbortController | null;
  pendingToolCalls: ToolCallInfo[];
  currentVisibility: ConversationVisibility;
  currentSelfReview: boolean;

  fetchConversations: () => Promise<void>;
  createConversation: (modelNormalizedName: string, title?: string, visibility?: ConversationVisibility, selfReview?: boolean) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  updateConversation: (id: string, data: { title?: string; visibility?: ConversationVisibility; selfReview?: boolean }) => Promise<void>;
  sendMessage: (message: string, modelNormalizedName: string, attachments?: PendingAttachment[], fileIds?: string[]) => void;
  doSendMessage: (convId: string, message: string, modelNormalizedName: string, attachments?: PendingAttachment[], fileIds?: string[]) => void;
  stopStreaming: () => void;
  clearError: () => void;
  setVisibility: (v: ConversationVisibility) => void;
  setSelfReview: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  error: null,
  abortController: null,
  pendingToolCalls: [],
  currentVisibility: 'public',
  currentSelfReview: false,

  fetchConversations: async () => {
    // Prevent concurrent fetchConversations from double-auto-selecting (StrictMode double-mount)
    if (_fetchConvRunning) {
      console.log('[chatStore] fetchConversations: already running, skipping');
      return;
    }
    _fetchConvRunning = true;
    try {
      const res = await conversationApi.list();
      if (res.success && res.data) {
        const conversations = res.data;
        const lastConvId = localStorage.getItem('last_conversation_id');
        const hasValidLast = lastConvId && conversations.some(c => c.id === lastConvId);

        // Clear stale localStorage if the conversation no longer exists
        if (lastConvId && !hasValidLast) {
          localStorage.removeItem('last_conversation_id');
        }

        set({ conversations });

        // Auto-select last active conversation after refresh
        // Only select if no conversation is currently selected (prevents double-select in StrictMode)
        const currentId = get().currentConversationId;
        if (!currentId) {
          const targetId = hasValidLast ? lastConvId! : (conversations.length > 0 ? conversations[0].id : null);
          if (targetId) {
            await get().selectConversation(targetId);
          }
        }
      }
    } catch (err: any) {
      console.error('[chatStore] fetchConversations failed:', err);
    } finally {
      _fetchConvRunning = false;
    }
  },

  createConversation: async (modelNormalizedName: string, title?: string, visibility?: ConversationVisibility, selfReview?: boolean) => {
    const res = await conversationApi.create({
      modelNormalizedName,
      title,
      visibility: visibility || get().currentVisibility,
      selfReview: selfReview !== undefined ? selfReview : get().currentSelfReview,
    });
    if (res.success && res.data) {
      localStorage.setItem('last_conversation_id', res.data!.id);
      set(state => ({
        conversations: [res.data!, ...state.conversations],
        currentConversationId: res.data!.id,
        messages: [],
        currentVisibility: res.data!.visibility,
        currentSelfReview: res.data!.selfReview,
      }));
      return res.data.id;
    }
    throw new Error(res.error || 'Failed to create conversation');
  },

  deleteConversation: async (id: string) => {
    await conversationApi.delete(id);
    set(state => {
      const conversations = state.conversations.filter(c => c.id !== id);
      const currentConversationId = state.currentConversationId === id
        ? (conversations[0]?.id || null)
        : state.currentConversationId;
      return { conversations, currentConversationId };
    });
    // Reload messages if we switched conversation
    const { currentConversationId } = get();
    if (currentConversationId) {
      await get().selectConversation(currentConversationId);
    } else {
      set({ messages: [], currentVisibility: 'public', currentSelfReview: false });
    }
  },

  selectConversation: async (id: string) => {
    const gen = ++_selectGeneration;
    const prevId = get().currentConversationId;
    const isSwitching = prevId !== id;

    localStorage.setItem('last_conversation_id', id);
    // Only clear messages if switching to a DIFFERENT conversation
    // Don't clear if re-selecting the same one (prevents StrictMode double-mount from blanking the screen)
    set({ currentConversationId: id, error: null, ...(isSwitching ? { messages: [] } : {}) });

    try {
      // Find conversation in local state to set visibility/selfReview
      const conv = get().conversations.find(c => c.id === id);
      if (conv) {
        set({ currentVisibility: conv.visibility, currentSelfReview: conv.selfReview });
      }

      // Load messages
      let res = await conversationApi.getMessages(id);

      // Retry once on failure
      if (!res.success || !res.data) {
        await new Promise(resolve => setTimeout(resolve, 300));
        res = await conversationApi.getMessages(id);
      }

      // Generation guard: only apply result if this is still the latest selectConversation call.
      // This prevents stale results from race conditions (e.g. StrictMode double-mount).
      if (_selectGeneration !== gen) {
        return;
      }

      if (res.success && res.data) {
        set({ messages: res.data, error: null });
      } else {
        set({ error: res.error || 'Failed to load messages' });
      }
    } catch (err: any) {
      if (_selectGeneration !== gen) return;
      set({ error: err.message || 'Failed to load conversation' });
    }
  },

  updateConversation: async (id: string, data: { title?: string; visibility?: ConversationVisibility; selfReview?: boolean }) => {
    try {
      const res = await conversationApi.update(id, data);
      if (res.success && res.data) {
        set(state => {
          const conversations = state.conversations.map(c => c.id === id ? res.data! : c);
          const updates: Partial<ChatState> = { conversations };
          if (state.currentConversationId === id) {
            if (data.visibility !== undefined) updates.currentVisibility = data.visibility;
            if (data.selfReview !== undefined) updates.currentSelfReview = data.selfReview;
          }
          return updates;
        });
      }
    } catch (err: any) {
      console.error('Failed to update conversation:', err);
    }
  },

  sendMessage: (message: string, modelNormalizedName: string, attachments?: PendingAttachment[], fileIds?: string[]) => {
    const { currentConversationId, isStreaming } = get();
    if (isStreaming) return;

    let convId = currentConversationId;

    // If no conversation, create one first
    if (!convId) {
      get().createConversation(modelNormalizedName, message.substring(0, 50)).then(id => {
        get().doSendMessage(id, message, modelNormalizedName, attachments, fileIds);
      });
      return;
    }

    get().doSendMessage(convId, message, modelNormalizedName, attachments, fileIds);
  },

  doSendMessage: (convId: string, message: string, modelNormalizedName: string, attachments?: PendingAttachment[], fileIds?: string[]) => {
    // Add user message to UI immediately
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content: message,
      attachments: attachments?.map(a => ({
        id: a.id,
        type: a.file.type.startsWith('image/') ? 'image' as const : 'file' as const,
        filename: a.file.name,
        mimeType: a.file.type,
        url: a.previewUrl || '',
      })),
      createdAt: new Date().toISOString(),
    };

    set(state => ({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingContent: '',
      error: null,
      pendingToolCalls: [],
    }));

    // Convert attachments to API format
    const apiAttachments = attachments?.map(a => ({
      filename: a.file.name,
      mimeType: a.file.type,
      base64: a.base64 || '',
    }));

    const controller = streamChat(
      convId,
      modelNormalizedName,
      message,
      {
        // onChunk
        onChunk: (content) => {
          set(state => ({ streamingContent: state.streamingContent + content }));
        },
        // onDone
        onDone: () => {
          const { streamingContent, pendingToolCalls } = get();
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            conversationId: convId,
            role: 'assistant',
            content: streamingContent,
            toolCalls: pendingToolCalls.length > 0 ? [...pendingToolCalls] : undefined,
            createdAt: new Date().toISOString(),
          };
          set(state => ({
            messages: [...state.messages, assistantMsg],
            isStreaming: false,
            streamingContent: '',
            abortController: null,
            pendingToolCalls: [],
          }));
          // Refresh conversation list to update title
          get().fetchConversations();
        },
        // onReviewedContent — replaces streaming content with self-reviewed version
        onReviewedContent: (reviewedContent: string) => {
          set({ streamingContent: reviewedContent });
        },
        // onRegexContent — replaces streaming content with regex-transformed version
        onRegexContent: (regexContent: string) => {
          set({ streamingContent: regexContent });
        },
        // onError
        onError: (error) => {
          set({ isStreaming: false, streamingContent: '', error, abortController: null, pendingToolCalls: [] });
        },
        // onToolCall
        onToolCall: (toolCall) => {
          set(state => ({
            pendingToolCalls: [...state.pendingToolCalls, {
              id: toolCall.id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            }],
          }));
        },
        // onToolResult
        onToolResult: (toolResult) => {
          set(state => ({
            pendingToolCalls: state.pendingToolCalls.map(tc =>
              tc.id === toolResult.id ? { ...tc, result: toolResult.result } : tc
            ),
          }));
        },
      },
      apiAttachments,
      fileIds && fileIds.length > 0 ? fileIds : undefined,
    );

    set({ abortController: controller });
  },

  stopStreaming: () => {
    const { abortController, streamingContent, currentConversationId } = get();
    if (abortController) {
      abortController.abort();
    }
    // Save partial content
    if (streamingContent && currentConversationId) {
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        conversationId: currentConversationId,
        role: 'assistant',
        content: streamingContent + '\n\n*[Generation stopped]*',
        createdAt: new Date().toISOString(),
      };
      set(state => ({
        messages: [...state.messages, assistantMsg],
        isStreaming: false,
        streamingContent: '',
        abortController: null,
        pendingToolCalls: [],
      }));
    } else {
      set({ isStreaming: false, streamingContent: '', abortController: null, pendingToolCalls: [] });
    }
  },

  clearError: () => set({ error: null }),
  setVisibility: (v: ConversationVisibility) => set({ currentVisibility: v }),
  setSelfReview: (v: boolean) => set({ currentSelfReview: v }),
}));
