/**
 * §10.6 realtime hub — WebSocket fan-out for group chat.
 *
 * Replaces the client's 3s polling with server push. One WebSocketServer is
 * attached to the HTTP server (see index.ts). Clients connect to
 *   ws(s)://<host>/ws/rooms?token=<jwt>&roomId=<id>
 * and receive JSON events for that one room. A client that switches rooms
 * closes and reopens the socket (mirrors openRoom/closeRoom in roomStore).
 *
 * Events (server -> client), all shaped { type, ...payload }:
 *   - 'message' : a new left-track human message         { message }
 *   - 'ai'      : a right-track AI message added/updated  { message }
 *   - 'room'    : room state changed (occupancy/models/…) { room }
 *   - 'members' : membership changed (invite/kick)        {}
 *   - 'disband' : room was disbanded                      {}
 *   - 'pong'    : heartbeat reply                         {}
 *
 * Auth: the JWT is passed as a query param (WS can't send Authorization
 * headers from the browser). We verify it and confirm room membership before
 * accepting the socket, then re-check nothing else — membership changes that
 * kick a user also close their socket (see broadcastDisband/kick paths).
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifyToken } from '../middleware/auth';
import { getDb } from '../database';

interface Client {
  ws: WebSocket;
  userId: string;
  roomId: string;
  isAlive: boolean;
}

/** roomId -> set of connected clients */
const rooms = new Map<string, Set<Client>>();

function membership(roomId: string, userId: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?')
    .get(roomId, userId);
  return Boolean(row);
}

/** Broadcast a JSON event to every client currently in a room. */
export function broadcast(roomId: string, event: Record<string, unknown>): void {
  const set = rooms.get(roomId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(event);
  for (const client of set) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

/** Close all sockets for a room (used on disband). */
export function closeRoom(roomId: string): void {
  const set = rooms.get(roomId);
  if (!set) return;
  for (const client of set) {
    try {
      client.ws.close(4003, 'room disbanded');
    } catch {
      /* ignore */
    }
  }
  rooms.delete(roomId);
}

/** Close a single user's socket(s) in a room (used on kick). */
export function disconnectUser(roomId: string, userId: string): void {
  const set = rooms.get(roomId);
  if (!set) return;
  for (const client of set) {
    if (client.userId === userId) {
      try {
        client.ws.close(4003, 'removed from room');
      } catch {
        /* ignore */
      }
    }
  }
}

/** Remove a client from its room set; drop the set when empty. */
function removeClient(client: Client): void {
  const set = rooms.get(client.roomId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) rooms.delete(client.roomId);
}

/**
 * Attach a WebSocketServer to the given HTTP server on path /ws/rooms.
 * Called once from index.ts after the server is created.
 */
export function attachRoomHub(server: Server): void {
  // noServer + manual upgrade so a bad path/auth is rejected cleanly and other
  // upgrade consumers (if any are added later) aren't disturbed.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let url: URL;
    try {
      url = new URL(req.url || '', `http://${req.headers.host}`);
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== '/ws/rooms') {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token') || '';
    const roomId = url.searchParams.get('roomId') || '';
    let userId: string;
    try {
      userId = verifyToken(token).userId;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    if (!roomId || !membership(roomId, userId)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const client: Client = { ws, userId, roomId, isAlive: true };
      let set = rooms.get(roomId);
      if (!set) {
        set = new Set();
        rooms.set(roomId, set);
      }
      set.add(client);

      ws.on('message', (raw) => {
        // Only heartbeat is expected from clients; ignore anything else.
        try {
          const msg = JSON.parse(String(raw));
          if (msg?.type === 'ping') {
            client.isAlive = true;
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {
          /* ignore malformed client frames */
        }
      });
      ws.on('pong', () => { client.isAlive = true; });
      ws.on('close', () => removeClient(client));
      ws.on('error', () => removeClient(client));
    });
  });

  // Heartbeat sweep: drop sockets that stopped answering pings.
  const interval = setInterval(() => {
    for (const set of rooms.values()) {
      for (const client of set) {
        if (!client.isAlive) {
          try { client.ws.terminate(); } catch { /* ignore */ }
          removeClient(client);
          continue;
        }
        client.isAlive = false;
        try { client.ws.ping(); } catch { /* ignore */ }
      }
    }
  }, 30000);
  interval.unref?.();
}
