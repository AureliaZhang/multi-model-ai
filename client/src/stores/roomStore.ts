import { create } from 'zustand';
import { roomApi } from '../services/api';
import type { Room, RoomMessage, RoomAiMessage, RoomFile } from '../types';

/**
 * §10.6 Group chat store.
 * - Left track (human) + right track (AI) are kept separate.
 * - While a room is open we poll for updates (until WebSocket lands in P2).
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
  _pollTimer: ReturnType<typeof setInterval> | null;

  fetchRooms: () => Promise<void>;
  createRoom: (name: string, memberUserIds: string[]) => Promise<Room | null>;
  openRoom: (id: string) => Promise<void>;
  closeRoom: () => void;
  refreshRoom: () => Promise<void>;

  sendMessage: (content: string, attachments?: RoomMessage['attachments']) => Promise<void>;

  claim: () => Promise<boolean>;
  renew: () => Promise<void>;
  release: () => Promise<void>;
  ask: (content: string, fileIds?: string[]) => Promise<void>;

  setModels: (models: { chatModel?: string | null; imageModel?: string | null; ttsModel?: string | null }) => Promise<string | null>;

  invite: (userIds: string[]) => Promise<void>;
  kick: (userId: string) => Promise<void>;
  disband: () => Promise<void>;

  fetchFiles: () => Promise<void>;
  uploadFile: (name: string, mimeType: string, content: string, fileSize: number) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
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
  _pollTimer: null,

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
    // stop any previous polling
    const prev = get()._pollTimer;
    if (prev) clearInterval(prev);

    set({ loadingRoom: true, currentRoom: null, messages: [], aiMessages: [], files: [], error: null });

    const [roomRes, msgRes, aiRes] = await Promise.all([
      roomApi.get(id),
      roomApi.listMessages(id),
      roomApi.listAi(id),
    ]);

    if (!roomRes.success || !roomRes.data) {
      set({ loadingRoom: false, error: roomRes.error || 'Failed to open group' });
      return;
    }

    set({
      currentRoom: roomRes.data,
      messages: msgRes.success && msgRes.data ? msgRes.data : [],
      aiMessages: aiRes.success && aiRes.data ? aiRes.data : [],
      loadingRoom: false,
    });

    get().fetchFiles();

    // Poll every 3s while this room is open (P2 replaces with WebSocket).
    const timer = setInterval(() => {
      const cur = get().currentRoom;
      if (!cur || cur.id !== id) return;
      get().refreshRoom();
    }, 3000);
    set({ _pollTimer: timer });
  },

  closeRoom: () => {
    const timer = get()._pollTimer;
    if (timer) clearInterval(timer);
    set({ currentRoom: null, messages: [], aiMessages: [], files: [], _pollTimer: null });
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
      set({ messages: [...get().messages, res.data] });
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
    if (!cur) return;
    set({ asking: true });
    const res = await roomApi.ask(cur.id, content, fileIds);
    set({ asking: false });
    if (!res.success) {
      set({ error: res.error || 'AI request failed' });
    }
    // Pull fresh right/left tracks + room state regardless.
    await get().refreshRoom();
  },

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
}));
