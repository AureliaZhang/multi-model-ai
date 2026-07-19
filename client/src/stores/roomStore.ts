import { create } from 'zustand';
import { roomApi } from '../services/api';
import { roomSocket, type RoomSocketEvent, type RoomSocketStatus } from '../services/roomSocket';
import type { Room, RoomMessage, RoomAiMessage, RoomFile, RoomNotepad } from '../types';

/**
 * §10.6 Group chat store.
 * - Left track (human) + right track (AI) are kept separate.
 * - While a room is open we prefer a WebSocket for live updates; if the
 *   socket drops we fall back to 3s polling until it reconnects.
 * - Occupancy (@AI input lock) state comes from the room object itself.
 */

interface RoomState {
  rooms: Room[];
  roomsLoading: boolean;
  currentRoom: Room | null;
  messages: RoomMessage[]; // left track
  aiMessages: RoomAiMessage[]; // right track
  files: RoomFile[];
  loadingRoom: boolean;
  error: string | null;
  asking: boolean; // an @AI request is in flight from THIS client
  socketStatus: RoomSocketStatus | 'idle';
  _pollTimer: ReturnType<typeof setInterval> | null;
  notepad: RoomNotepad | null;

  fetchRooms: () => Promise<void>;
  createRoom: (name: string, memberUserIds: string[]) => Promise<Room | null>;
  openRoom: (id: string) => Promise<void>;
  closeRoom: () => void;
  refreshRoom: () => Promise<void>;

  sendMessage: (content: string, attachments?: RoomMessage['attachments']) => Promise<void>;

  claim: () => Promise<boolean>;
  renew: () => Promise<void>;
  release: () => Promise<void>;
  /** Send an @AI prompt. Returns an error string on failure, or null on success. */
  ask: (content: string, fileIds?: string[]) => Promise<string | null>;
  clearError: () => void;

  setModels: (models: { chatModel?: string | null; imageModel?: string | null; ttsModel?: string | null }) => Promise<string | null>;

  invite: (userIds: string[]) => Promise<void>;
  kick: (userId: string) => Promise<void>;
  disband: () => Promise<void>;

  fetchFiles: () => Promise<void>;
  uploadFile: (name: string, mimeType: string, content: string, fileSize: number) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;

  // §10.6.14 group notepad
  fetchNotepad: () => Promise<void>;
  saveNotepad: (content: string) => Promise<string | null>;
  requestNotepadEdit: () => Promise<string | null>;
  resolveNotepadRequest: (reqId: string, approve: boolean) => Promise<void>;
  revokeNotepadEditor: (userId: string) => Promise<void>;
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [...list, item];
  const next = list.slice();
  next[idx] = { ...list[idx], ...item };
  return next;
}

function applySocketEvent(
  set: (partial: Partial<RoomState> | ((s: RoomState) => Partial<RoomState>)) => void,
  get: () => RoomState,
  event: RoomSocketEvent,
): void {
  switch (event.type) {
    case 'message': {
      const message = event.message as RoomMessage;
      if (!message?.id) return;
      set({ messages: upsertById(get().messages, message) });
      break;
    }
    case 'ai': {
      const message = event.message as RoomAiMessage;
      if (!message?.id) return;
      // Streaming updates arrive many times per second: merge by id so
      // content grows in place (thinking → streaming → done|error).
      set({ aiMessages: upsertById(get().aiMessages, message) });
      break;
    }
    case 'room': {
      const room = event.room as Room;
      if (!room?.id) return;
      // Only update if this is still the open room
      if (get().currentRoom?.id === room.id) {
        set({ currentRoom: { ...get().currentRoom!, ...room } });
      }
      break;
    }
    case 'members': {
      // Cheap refresh of room (includes members when backend returns them)
      void get().refreshRoom();
      break;
    }
    case 'disband': {
      get().closeRoom();
      void get().fetchRooms();
      break;
    }
    case 'notepad':
    case 'notepadRequest': {
      // Notepad content / editors / request-queue changed. The payloads are
      // partial (some carry only {resolved} or {revoked}), so just re-fetch the
      // authoritative notepad state for the open room.
      void get().fetchNotepad();
      break;
    }
    default:
      break;
  }
}

function startFallbackPoll(set: (p: Partial<RoomState>) => void, get: () => RoomState, roomId: string): void {
  const prev = get()._pollTimer;
  if (prev) clearInterval(prev);
  const timer = setInterval(() => {
    const cur = get().currentRoom;
    if (!cur || cur.id !== roomId) return;
    // Only poll when the socket is not open
    if (get().socketStatus === 'open') return;
    void get().refreshRoom();
  }, 3000);
  set({ _pollTimer: timer });
}

function stopFallbackPoll(set: (p: Partial<RoomState>) => void, get: () => RoomState): void {
  const timer = get()._pollTimer;
  if (timer) clearInterval(timer);
  set({ _pollTimer: null });
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  roomsLoading: false,
  currentRoom: null,
  messages: [],
  aiMessages: [],
  files: [],
  loadingRoom: false,
  error: null,
  asking: false,
  socketStatus: 'idle',
  _pollTimer: null,
  notepad: null,

  fetchRooms: async () => {
    set({ roomsLoading: true });
    const res = await roomApi.list();
    if (res.success && res.data) {
      set({ rooms: res.data, roomsLoading: false });
    } else {
      set({ roomsLoading: false, error: res.error || 'Failed to load rooms' });
    }
  },

  createRoom: async (name, memberUserIds) => {
    const res = await roomApi.create(name, memberUserIds);
    if (res.success && res.data) {
      await get().fetchRooms();
      return res.data;
    }
    set({ error: res.error || 'Failed to create group' });
    return null;
  },

  openRoom: async (id) => {
    stopFallbackPoll(set, get);
    roomSocket.disconnect();

    set({
      loadingRoom: true,
      currentRoom: null,
      messages: [],
      aiMessages: [],
      files: [],
      error: null,
      socketStatus: 'connecting',
    });

    const [roomRes, msgRes, aiRes] = await Promise.all([
      roomApi.get(id),
      roomApi.listMessages(id),
      roomApi.listAi(id),
    ]);

    if (!roomRes.success || !roomRes.data) {
      set({ loadingRoom: false, error: roomRes.error || 'Failed to open group', socketStatus: 'idle' });
      return;
    }

    set({
      currentRoom: roomRes.data,
      messages: msgRes.success && msgRes.data ? msgRes.data : [],
      aiMessages: aiRes.success && aiRes.data ? aiRes.data : [],
      loadingRoom: false,
    });

    get().fetchFiles();
    get().fetchNotepad();

    // Live updates via WebSocket; fall back to polling only while disconnected.
    roomSocket.connect(
      id,
      (event) => applySocketEvent(set, get, event),
      (status) => {
        // Ignore status updates for a room we already left
        if (get().currentRoom?.id !== id && status !== 'closed') return;
        set({ socketStatus: status });
      },
    );
    startFallbackPoll(set, get, id);
  },

  closeRoom: () => {
    stopFallbackPoll(set, get);
    roomSocket.disconnect();
    set({
      currentRoom: null,
      messages: [],
      aiMessages: [],
      files: [],
      notepad: null,
      _pollTimer: null,
      socketStatus: 'idle',
    });
  },

  refreshRoom: async () => {
    const cur = get().currentRoom;
    if (!cur) return;
    const [roomRes, msgRes, aiRes] = await Promise.all([
      roomApi.get(cur.id),
      roomApi.listMessages(cur.id),
      roomApi.listAi(cur.id),
    ]);
    if (roomRes.success && roomRes.data) {
      set({
        currentRoom: roomRes.data,
        messages: msgRes.success && msgRes.data ? msgRes.data : get().messages,
        aiMessages: aiRes.success && aiRes.data ? aiRes.data : get().aiMessages,
      });
    }
  },

  sendMessage: async (content, attachments) => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.sendMessage(cur.id, content, attachments);
    if (res.success && res.data) {
      // Optimistic local insert; WS echo will upsert by id (no duplicate).
      set({ messages: upsertById(get().messages, res.data) });
    } else {
      set({ error: res.error || 'Failed to send' });
    }
  },

  claim: async () => {
    const cur = get().currentRoom;
    if (!cur) return false;
    const res = await roomApi.claim(cur.id);
    if (res.success && res.data) {
      set({ currentRoom: res.data });
      return true;
    }
    set({ error: res.error || 'Someone else is composing' });
    return false;
  },

  renew: async () => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.renew(cur.id);
    if (res.success && res.data) set({ currentRoom: res.data });
  },

  release: async () => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.release(cur.id);
    if (res.success && res.data) set({ currentRoom: res.data });
  },

  ask: async (content, fileIds) => {
    const cur = get().currentRoom;
    if (!cur) return 'No room';
    set({ asking: true, error: null });
    const res = await roomApi.ask(cur.id, content, fileIds);
    set({ asking: false });
    if (!res.success) {
      const err = res.error || 'AI request failed';
      set({ error: err });
      // Failed asks (e.g. no chat model set) leave no thinking bubble to clear,
      // but refresh so any partial lock state is reconciled.
      await get().refreshRoom();
      return err;
    }
    // WS should have already pushed thinking → done; this is a safety net
    // for the case where the socket was briefly down during the request.
    await get().refreshRoom();
    return null;
  },

  clearError: () => set({ error: null }),

  setModels: async (models) => {
    const cur = get().currentRoom;
    if (!cur) return 'No room';
    const res = await roomApi.setModels(cur.id, models);
    if (res.success && res.data) {
      set({ currentRoom: res.data });
      return null;
    }
    return res.error || 'Failed to update models';
  },

  invite: async (userIds) => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.invite(cur.id, userIds);
    if (res.success) {
      await get().refreshRoom();
    } else {
      set({ error: res.error || 'Invite failed' });
    }
  },

  kick: async (userId) => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.kick(cur.id, userId);
    if (res.success) {
      await get().refreshRoom();
    } else {
      set({ error: res.error || 'Kick failed' });
    }
  },

  disband: async () => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.disband(cur.id);
    if (res.success) {
      get().closeRoom();
      await get().fetchRooms();
    } else {
      set({ error: res.error || 'Disband failed' });
    }
  },

  fetchFiles: async () => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.listFiles(cur.id);
    if (res.success && res.data) set({ files: res.data });
  },

  uploadFile: async (name, mimeType, content, fileSize) => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.uploadFile(cur.id, name, mimeType, content, fileSize);
    if (res.success) {
      await get().fetchFiles();
    } else {
      set({ error: res.error || 'Upload failed' });
    }
  },

  deleteFile: async (fileId) => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.deleteFile(cur.id, fileId);
    if (res.success) {
      await get().fetchFiles();
    }
  },

  fetchNotepad: async () => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.getNotepad(cur.id);
    if (res.success && res.data) {
      // Ignore a late response for a room we already left.
      if (get().currentRoom?.id === cur.id) set({ notepad: res.data });
    }
  },

  saveNotepad: async (content) => {
    const cur = get().currentRoom;
    if (!cur) return 'No room';
    const res = await roomApi.saveNotepad(cur.id, content);
    if (res.success && res.data) {
      set({ notepad: res.data });
      return null;
    }
    return res.error || 'Failed to save notepad';
  },

  requestNotepadEdit: async () => {
    const cur = get().currentRoom;
    if (!cur) return 'No room';
    const res = await roomApi.requestNotepadEdit(cur.id);
    if (res.success && res.data) {
      set({ notepad: res.data });
      return null;
    }
    return res.error || 'Failed to request edit rights';
  },

  resolveNotepadRequest: async (reqId, approve) => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.resolveNotepadRequest(cur.id, reqId, approve);
    if (res.success && res.data) set({ notepad: res.data });
  },

  revokeNotepadEditor: async (userId) => {
    const cur = get().currentRoom;
    if (!cur) return;
    const res = await roomApi.revokeNotepadEditor(cur.id, userId);
    if (res.success && res.data) set({ notepad: res.data });
  },
}));
