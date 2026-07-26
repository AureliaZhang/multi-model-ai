import { create, type StoreApi } from 'zustand';
import type { Conversation, ConversationVisibility, Message, PendingAttachment, ToolCallInfo } from '../types';
import { conversationApi, streamChat } from '../services/api';
import { synthesizeSpeech, usePrefsStore } from './prefsStore';
import { getErrorMessage } from '../utils/errors';

// Generation counter to prevent stale selectConversation results from being applied.
// Each call to selectConversation increments this; only the latest call's result is used.
let _selectGeneration = 0;
// Guard to prevent concurrent fetchConversations from double-auto-selecting
let _fetchConvRunning = false;

/**
 * Kick off a streaming chat request and wire all SSE callbacks into the store.
 *
 * Shared by the first send (doSendMessage, which inserts the user bubble first)
 * and retryLastSend (which reuses the bubble already in the list). It therefore
 * does NOT touch `messages` on entry — the caller owns inserting the user turn.
 *
 * On failure we stash the originating params in `lastFailedSend` so the error
 * banner can offer a retry; on success we clear it.
 */
function startStream(
  set: StoreApi<ChatState>['setState'],
  get: StoreApi<ChatState>['getState'],
  params: FailedSend,
): void {
  const { convId, message, modelNormalizedName, attachments, fileIds } = params;

  set({ isStreaming: true, streamingContent: '', error: null, pendingToolCalls: [] });

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
          lastFailedSend: null,
        }));
        // Refresh conversation list to update title
        get().fetchConversations();

        // Auto TTS: speak assistant text with user-selected TTS model (OpenAI-compatible)
        try {
          const prefs = usePrefsStore.getState().prefs;
          if (prefs?.autoTts && prefs.ttsModel && streamingContent.trim()) {
            const speakText = streamingContent.replace(/```[\s\S]*?```/g, ' ').slice(0, 3000);
            synthesizeSpeech(prefs.ttsModel, speakText).then((ttsRes) => {
              if (ttsRes.success && ttsRes.data?.dataUrl) {
                const audioMsg: Message = {
                  id: `tts-${Date.now()}`,
                  conversationId: convId,
                  role: 'assistant',
                  content: '',
                  attachments: [{
                    id: `tts-att-${Date.now()}`,
                    type: 'file',
                    filename: 'speech.mp3',
                    mimeType: ttsRes.data.mimeType || 'audio/mpeg',
                    url: ttsRes.data.dataUrl,
                  }],
                  modelUsed: ttsRes.data.modelUsed,
                  createdAt: new Date().toISOString(),
                };
                set((state) => ({ messages: [...state.messages, audioMsg] }));
                try {
                  const a = new Audio(ttsRes.data.dataUrl);
                  a.play().catch(() => undefined);
                } catch {
                  /* ignore */
                }
              }
            }).catch(() => undefined);
          }
        } catch {
          /* prefs optional */
        }
      },
      // onReviewedContent — replaces streaming content with self-reviewed version
      onReviewedContent: (reviewedContent: string) => {
        set({ streamingContent: reviewedContent });
      },
      // onRegexContent — replaces streaming content with regex-transformed version
      onRegexContent: (regexContent: string) => {
        set({ streamingContent: regexContent });
      },
      // onError — keep the params so the user can retry (e.g. all stations down)
      onError: (error) => {
        set({
          isStreaming: false,
          streamingContent: '',
          error,
          abortController: null,
          pendingToolCalls: [],
          lastFailedSend: params,
        });
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
}

/** Params of the most recent send that failed, kept so the user can retry it. */
interface FailedSend {
  convId: string;
  message: string;
  modelNormalizedName: string;
  attachments?: PendingAttachment[];
  fileIds?: string[];
}

/**
 * Map a (possibly client-ephemeral) message id in the local list to its real DB
 * id on the server. Real DB ids (uuids) are returned as-is; ephemeral ids
 * (`temp-`/`assistant-`/`tts-`) are resolved by position among persisted
 * (non-tts) messages — the server list is exactly the persisted turns in order,
 * and client-only TTS bubbles are the only local entries not on the server.
 */
async function resolveServerMessageId(
  get: StoreApi<ChatState>['getState'],
  convId: string,
  clientMessageId: string,
): Promise<string | null> {
  const local = get().messages;
  const idx = local.findIndex((m) => m.id === clientMessageId);
  if (idx < 0) return null;
  if (!/^(temp|assistant|tts)-/.test(clientMessageId)) return clientMessageId; // already a real DB id
  const persistedIndex = local.slice(0, idx + 1).filter((m) => !m.id.startsWith('tts-')).length - 1;
  const res = await conversationApi.getMessages(convId);
  if (!res.success || !res.data) return null;
  return res.data[persistedIndex]?.id ?? null;
}

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
  /** Set when a send fails (e.g. all stations down); powers the retry button. */
  lastFailedSend: FailedSend | null;

  fetchConversations: () => Promise<void>;
  createConversation: (modelNormalizedName: string, title?: string, visibility?: ConversationVisibility, selfReview?: boolean) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  updateConversation: (id: string, data: { title?: string; visibility?: ConversationVisibility; selfReview?: boolean; systemPrompt?: string | null; pinned?: boolean; folder?: string | null }) => Promise<void>;
  sendMessage: (message: string, modelNormalizedName: string, attachments?: PendingAttachment[], fileIds?: string[]) => void;
  doSendMessage: (convId: string, message: string, modelNormalizedName: string, attachments?: PendingAttachment[], fileIds?: string[]) => void;
  /** Re-run the last failed send without inserting a duplicate user message. */
  retryLastSend: () => void;
  /** Regenerate the assistant reply for the user turn at/preceding `messageId`. */
  regenerateMessage: (messageId: string) => Promise<void>;
  /** Replace a user message's text and resend, truncating the rest of the thread. */
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  /** Download all visible conversations (+ messages) as a JSON file. */
  exportConversations: () => Promise<void>;
  /** Import conversations from a parsed export file; refreshes the list. Returns a summary. */
  importConversations: (data: unknown) => Promise<{
    importedConversations: number;
    importedMessages: number;
    importedAttachments?: number;
    total: number;
  }>;
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
  currentVisibility: 'private', // team default (v0.7.58): new chats start private
  currentSelfReview: false,
  lastFailedSend: null,

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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      if (_selectGeneration !== gen) return;
      set({ error: getErrorMessage(err) || 'Failed to load conversation' });
    }
  },

  updateConversation: async (id: string, data: { title?: string; visibility?: ConversationVisibility; selfReview?: boolean; pinned?: boolean; folder?: string | null }) => {
    try {
      const res = await conversationApi.update(id, data);
      if (res.success && res.data) {
        set(state => {
          const conversations = state.conversations.map(c => c.id === id ? res.data! : c);
          // Keep the sidebar invariant (pinned first, then most-recent) after a
          // pin/unpin without a refetch — mirrors the server's ORDER BY.
          if (data.pinned !== undefined) {
            conversations.sort((a, b) =>
              Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)
            );
          }
          const updates: Partial<ChatState> = { conversations };
          if (state.currentConversationId === id) {
            if (data.visibility !== undefined) updates.currentVisibility = data.visibility;
            if (data.selfReview !== undefined) updates.currentSelfReview = data.selfReview;
          }
          return updates;
        });
      } else if (res.error) {
        console.error('[updateConversation] API error:', res.error);
        // If conversation not found on server, re-sync the conversation list
        if (res.error === 'Conversation not found') {
          console.warn('[updateConversation] Conversation not found on server, re-fetching conversations');
          get().fetchConversations();
        }
      }
    } catch (err: unknown) {
      console.error('Failed to update conversation:', err);
    }
  },

  exportConversations: async () => {
    await conversationApi.downloadExport();
  },

  importConversations: async (data: unknown) => {
    const res = await conversationApi.import(data);
    if (!res.success) {
      throw new Error(res.error || 'Import failed');
    }
    await get().fetchConversations();
    return res.data as {
      importedConversations: number;
      importedMessages: number;
      importedAttachments?: number;
      total: number;
    };
  },

  sendMessage: (message: string, modelNormalizedName: string, attachments?: PendingAttachment[], fileIds?: string[]) => {
    const { currentConversationId, isStreaming } = get();
    if (isStreaming) return;

    const convId = currentConversationId;

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

    set(state => ({ messages: [...state.messages, userMsg] }));

    startStream(set, get, { convId, message, modelNormalizedName, attachments, fileIds });
  },

  // Re-run the last failed send. The user bubble is already in the list, so we
  // just restart the stream with the same params — no duplicate message.
  retryLastSend: () => {
    const { lastFailedSend, isStreaming } = get();
    if (!lastFailedSend || isStreaming) return;
    startStream(set, get, lastFailedSend);
  },

  regenerateMessage: async (messageId: string) => {
    const { messages, currentConversationId, isStreaming, conversations } = get();
    if (isStreaming || !currentConversationId) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    // Find the user turn that prompted this assistant reply.
    let userIdx = -1;
    for (let i = idx; i >= 0; i--) {
      if (messages[i].role === 'user') { userIdx = i; break; }
    }
    if (userIdx < 0) return;
    const userMsg = messages[userIdx];
    const model =
      localStorage.getItem('selected_model') ||
      conversations.find((c) => c.id === currentConversationId)?.modelNormalizedName ||
      '';
    if (!model) { set({ error: 'No model selected' }); return; }

    // Truncate the old turn on the server (best-effort), drop it locally, resend.
    const dbId = await resolveServerMessageId(get, currentConversationId, userMsg.id);
    if (dbId) await conversationApi.truncate(currentConversationId, dbId);
    set({ messages: messages.slice(0, userIdx) }); // doSendMessage re-adds the user message
    get().doSendMessage(currentConversationId, userMsg.content, model);
  },

  editMessage: async (messageId: string, newContent: string) => {
    const { messages, currentConversationId, isStreaming, conversations } = get();
    if (isStreaming || !currentConversationId) return;
    const text = newContent.trim();
    if (!text) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0 || messages[idx].role !== 'user') return;
    const model =
      localStorage.getItem('selected_model') ||
      conversations.find((c) => c.id === currentConversationId)?.modelNormalizedName ||
      '';
    if (!model) { set({ error: 'No model selected' }); return; }

    const dbId = await resolveServerMessageId(get, currentConversationId, messages[idx].id);
    if (dbId) await conversationApi.truncate(currentConversationId, dbId);
    set({ messages: messages.slice(0, idx) });
    get().doSendMessage(currentConversationId, text, model);
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
