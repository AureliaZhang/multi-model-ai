/**
 * Knowledge-base URL import (v0.7.67): fetch a page server-side, convert it to
 * readable text, and push it through the SAME pipeline as an uploaded KB file
 * (file on disk → file_library row → chunk/embed → AI digest). SSRF-guarded
 * via utils/urlGuard; size- and time-capped.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { urlRejectionReason } from '../utils/urlGuard';
import { htmlToText, extractHtmlTitle } from '../utils/htmlToText';
import { processFile } from './fileProcessor';
import { summarizeKbFile } from './kbSummarizer';
import { getErrorMessage } from '../utils/errors';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB of page text is plenty for a document
const FETCH_TIMEOUT_MS = 20_000;
const MIN_TEXT_CHARS = 80; // a page that converts to less than this is a nav shell, not a document

export interface KbUrlImportDeps {
  fetchImpl?: typeof fetch;
  /** Chunk/embed pipeline; stubbed in tests. */
  process?: typeof processFile;
  /** AI digest step; stubbed in tests. */
  summarize?: (fileId: string, db: Database.Database) => Promise<unknown>;
  uploadsDir?: string;
}

export type KbUrlImportResult =
  | { ok: true; fileId: string }
  | { ok: false; reason: string };

export async function importUrlToKb(
  rawUrl: string,
  userId: string | null,
  db: Database.Database = getDb(),
  deps: KbUrlImportDeps = {}
): Promise<KbUrlImportResult> {
  const rejection = urlRejectionReason(rawUrl);
  if (rejection) return { ok: false, reason: rejection };

  const fetchImpl = deps.fetchImpl ?? fetch;
  const uploadsDir = deps.uploadsDir ?? path.join(__dirname, '..', '..', 'data', 'uploads');

  let body: string;
  let contentType: string;
  try {
    const res = await fetchImpl(rawUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'multi-model-ai-kb/1.0 (+team knowledge base importer)' },
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    contentType = (res.headers.get('content-type') || '').toLowerCase();
    body = await res.text();
  } catch (err) {
    return { ok: false, reason: `fetch_failed: ${getErrorMessage(err)}` };
  }
  if (body.length > MAX_BYTES) body = body.slice(0, MAX_BYTES);

  // Convert: HTML → cleaned text; plain text/markdown pass through; anything
  // else (PDF bytes over http etc.) is refused — upload the file instead.
  let title: string | null = null;
  let text: string;
  const looksHtml = contentType.includes('html') || /<html[\s>]/i.test(body.slice(0, 2000));
  if (looksHtml) {
    title = extractHtmlTitle(body);
    text = htmlToText(body);
  } else if (contentType.includes('text/') || contentType.includes('json') || contentType === '') {
    text = body.trim();
  } else {
    return { ok: false, reason: 'unsupported_content_type' };
  }
  if (text.length < MIN_TEXT_CHARS) return { ok: false, reason: 'too_little_text' };

  const url = new URL(rawUrl);
  const displayName = `${(title || url.hostname + url.pathname).slice(0, 120)}.md`;
  const storedName = `${uuidv4()}.md`;
  const markdown = `# ${title || url.hostname}\n\n> 来源 / Source: ${rawUrl}\n\n${text}`;

  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, storedName), markdown, 'utf8');
  } catch (err) {
    return { ok: false, reason: `write_failed: ${getErrorMessage(err)}` };
  }

  const fileId = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO file_library (id, original_name, stored_name, mime_type, file_size, status, folder_id, uploaded_by, visibility, kb, created_at, updated_at)
    VALUES (?, ?, ?, 'text/markdown', ?, 'processing', NULL, ?, 'team', 1, ?, ?)
  `).run(fileId, displayName, storedName, Buffer.byteLength(markdown, 'utf8'), userId, now, now);

  const processStep = deps.process ?? processFile;
  const summarizeStep = deps.summarize ?? ((id: string, d: Database.Database) => summarizeKbFile(id, d));
  // Same fire-and-forget chain as a KB upload.
  processStep(fileId, path.join(uploadsDir, storedName), 'text/markdown', displayName)
    .then(() => summarizeStep(fileId, db).then(() => undefined))
    .catch((err) => console.error(`[kb] url-import pipeline failed for ${rawUrl}:`, getErrorMessage(err)));

  return { ok: true, fileId };
}
