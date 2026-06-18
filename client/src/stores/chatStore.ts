import { create } from 'zustand';
import type { Conversation, Message, PendingAttachment, ToolCallInfo } from '../types';
import { conversationApi, streamChat } from '../services/api';

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  abortController: AbortController | null;
  pendingToolCalls: ToolCallInfo[];

  fetchConversations: () => Promise<void>;
  createConversation: (modelNormalizedName: string, title?: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  sendMessage: (message: string, modelNormalizedName: string, attachments?: PendingAttachment[]) => void;
  doSendMessage: (convId: string, message: string, modelNormalizedName: string, attachments?: PendingAttachment[]) => void;
  stopStreaming: () => void;
  clearError: () => void;
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

  fetchConversations: async () => {
    try {
      const res = await conversationApi.list();
      if (res.success && res.data) {
        set({ conversations: res.data });
      }
    } catch (err: any) {
      console.error('Failed to fetch conversations:', err);
    }
  },

  createConversation: async (modelNormalizedName: string, title?: string) => {
    const res = await conversationApi.create({ modelNormalizedName, title });
    if (res.success && res.data) {
      set(state => ({
        conversations: [res.data!, ...state.conversations],
        currentConversationId: res.data!.id,
        messages: [],
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
      get().selectConversation(currentConversationId);
    } else {
      set({ messages: [] });
    }
  },

  selectConversation: async (id: string) => {
    set({ currentConversationId: id, messages: [], error: null });
    try {
      const res = await conversationApi.getMessages(id);
      if (res.success && res.data) {
        set({ messages: res.data });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  sendMessage: (message: string, modelNormalizedName: string, attachments?: PendingAttachment[]) => {
    const { currentConversationId, isStreaming } = get();
    if (isStreaming) return;

    let convId = currentConversationId;

    // If no conversation, create one first
    if (!convId) {
      get().createConversation(modelNormalizedName, message.substring(0, 50)).then(id => {
        get().doSendMessage(id, message, modelNormalizedName, attachments);
      });
      return;
    }

    get().doSendMessage(convId, message, modelNormalizedName, attachments);
  },

  doSendMessage: (convId: string, message: string, modelNormalizedName: string, attachments?: PendingAttachment[]) => {
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
      apiAttachments
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
}));
