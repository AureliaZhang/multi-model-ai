/**
 * §10.6 room WebSocket client.
 *
 * Connects to /ws/rooms?token=&roomId= and delivers typed events to roomStore.
 * Auto-reconnects with exponential backoff while a room is supposed to stay open.
 * Heartbeats: client pings every 25s; server may also send protocol pings.
 */

import { getToken } from './auth';

export type RoomSocketEvent =
  | { type: 'message'; message: unknown }
  | { type: 'ai'; message: unknown }
  | { type: 'room'; room: unknown }
  | { type: 'members' }
  | { type: 'disband' }
  | { type: 'pong' }
  | { type: string; [key: string]: unknown };

export type RoomSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

type StatusHandler = (status: RoomSocketStatus) => void;
type EventHandler = (event: RoomSocketEvent) => void;

function wsUrl(roomId: string, token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Same origin in prod (server serves client); in dev Vite proxies /ws → backend.
  const host = window.location.host;
  return `${proto}//${host}/ws/rooms?token=${encodeURIComponent(token)}&roomId=${encodeURIComponent(roomId)}`;
}

class RoomSocket {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private wanted = false; // true while openRoom wants a live socket
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private onEvent: EventHandler | null = null;
  private onStatus: StatusHandler | null = null;

  connect(roomId: string, onEvent: EventHandler, onStatus?: StatusHandler): void {
    this.disconnect(); // clear any previous room
    this.roomId = roomId;
    this.wanted = true;
    this.onEvent = onEvent;
    this.onStatus = onStatus || null;
    this.reconnectAttempt = 0;
    this.open();
  }

  disconnect(): void {
    this.wanted = false;
    this.roomId = null;
    this.onEvent = null;
    this.onStatus = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    if (this.ws) {
      try {
        this.ws.close(1000, 'client close');
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  private open(): void {
    if (!this.wanted || !this.roomId) return;
    const token = getToken();
    if (!token) {
      this.onStatus?.('error');
      return;
    }

    this.onStatus?.('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl(this.roomId, token));
    } catch {
      this.onStatus?.('error');
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.onStatus?.('open');
      this.startPing();
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as RoomSocketEvent;
        if (data?.type === 'pong') return;
        this.onEvent?.(data);
      } catch {
        /* ignore bad frames */
      }
    };

    ws.onerror = () => {
      this.onStatus?.('error');
    };

    ws.onclose = () => {
      this.stopPing();
      this.ws = null;
      this.onStatus?.('closed');
      if (this.wanted) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (!this.wanted || this.reconnectTimer) return;
    // 1s, 2s, 4s, … capped at 15s
    const delay = Math.min(15000, 1000 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          /* ignore */
        }
      }
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

/** Singleton — one live room socket at a time (matches openRoom/closeRoom). */
export const roomSocket = new RoomSocket();
