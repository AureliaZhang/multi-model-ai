import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';

export type UsageKind = 'chat' | 'image' | 'tts' | 'other';
export type UsageStatus = 'ok' | 'error' | 'timeout' | 'http_error';

export interface UsageLogInput {
  userId?: string | null;
  username?: string | null;
  role?: string | null;
  kind?: UsageKind;
  modelNormalized?: string | null;
  modelUsed?: string | null;
  stationId?: string | null;
  stationName?: string | null;
  conversationId?: string | null;
  status?: UsageStatus;
  httpStatus?: number | null;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
}

export function logApiUsage(input: UsageLogInput): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO api_usage_logs (
        id, user_id, username, role, kind, model_normalized, model_used,
        station_id, station_name, conversation_id, status, http_status,
        error_message, prompt_tokens, completion_tokens, total_tokens, latency_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      input.userId ?? null,
      input.username ?? null,
      input.role ?? null,
      input.kind ?? 'chat',
      input.modelNormalized ?? null,
      input.modelUsed ?? null,
      input.stationId ?? null,
      input.stationName ?? null,
      input.conversationId ?? null,
      input.status ?? 'ok',
      input.httpStatus ?? null,
      input.errorMessage ? String(input.errorMessage).slice(0, 1000) : null,
      input.promptTokens ?? null,
      input.completionTokens ?? null,
      input.totalTokens ?? null,
      input.latencyMs ?? null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('[usage] failed to write log', err);
  }
}
