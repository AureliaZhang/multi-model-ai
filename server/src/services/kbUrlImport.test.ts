import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { urlRejectionReason } from '../utils/urlGuard';
import { htmlToText, extractHtmlTitle, decodeEntities } from '../utils/htmlToText';
import { importUrlToKb } from './kbUrlImport';

// KB url-import (v0.7.67): SSRF guard matrix, the HTML cleaner, and the import
// flow with a stubbed fetch + stubbed pipeline (no network, tmp uploads dir).

describe('urlRejectionReason (SSRF guard)', () => {
  it('accepts normal public http(s) URLs', () => {
    expect(urlRejectionReason('https://www.gov.cn/zhengce/xxx.htm')).toBeNull();
    expect(urlRejectionReason('http://example.com/a?b=1')).toBeNull();
  });
  it('rejects non-http protocols, garbage, and private/internal hosts', () => {
    expect(urlRejectionReason('file:///etc/passwd')).toBe('protocol');
    expect(urlRejectionReason('ftp://example.com/x')).toBe('protocol');
    expect(urlRejectionReason('not a url')).toBe('invalid_url');
    expect(urlRejectionReason('http://localhost:3001/api/users')).toBe('private_host');
    expect(urlRejectionReason('http://foo.localhost/x')).toBe('private_host');
    expect(urlRejectionReason('http://printer.local/')).toBe('private_host');
    expect(urlRejectionReason('http://127.0.0.1/admin')).toBe('private_host');
    expect(urlRejectionReason('http://10.0.0.5/')).toBe('private_host');
    expect(urlRejectionReason('http://192.168.1.1/')).toBe('private_host');
    expect(urlRejectionReason('http://172.16.9.9/')).toBe('private_host');
    expect(urlRejectionReason('http://169.254.169.254/latest/meta-data')).toBe('private_host'); // cloud metadata
    expect(urlRejectionReason('http://[::1]/')).toBe('private_host');
  });
});

describe('htmlToText / extractHtmlTitle', () => {
  it('drops scripts/styles, keeps paragraph structure, decodes entities', () => {
    const html = `<html><head><title>补贴政策 &mdash; 2026</title><style>p{color:red}</style></head>
      <body><script>alert(1)</script><h1>标题</h1><p>第一段&nbsp;内容 &amp; 细节。</p><p>第二段。</p>
      <ul><li>要点一</li><li>要点二</li></ul></body></html>`;
    expect(extractHtmlTitle(html)).toBe('补贴政策 — 2026');
    const text = htmlToText(html);
    expect(text).toContain('标题');
    expect(text).toContain('第一段 内容 & 细节。');
    expect(text).toContain('要点二');
    expect(text).not.toContain('alert(1)');
    expect(text).not.toContain('color:red');
    expect(text).not.toMatch(/<[a-z]/i);
  });
  it('decodeEntities handles numeric + hex forms', () => {
    expect(decodeEntities('&#20013;&#x6587;')).toBe('中文');
  });
});

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS);
  return db;
}

const PAGE = `<html><head><title>新能源汽车补贴延长通知</title></head><body>
  <h1>通知</h1><p>${'各地要落实新能源补贴政策，细则如下。'.repeat(10)}</p></body></html>`;

function stubFetch(body: string, opts: { status?: number; type?: string } = {}) {
  return (async () => ({
    ok: (opts.status ?? 200) < 400,
    status: opts.status ?? 200,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? (opts.type ?? 'text/html; charset=utf-8') : null) },
    text: async () => body,
  })) as unknown as typeof fetch;
}

describe('importUrlToKb', () => {
  it('happy path: writes the .md to disk, inserts a team-visible kb row, fires the pipeline', async () => {
    const db = freshDb();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbimp-'));
    const processed: string[] = [];
    const digested: string[] = [];
    const res = await importUrlToKb('https://www.gov.cn/tongzhi.htm', null, db, {
      fetchImpl: stubFetch(PAGE),
      uploadsDir: dir,
      process: async (fileId) => { processed.push(fileId); },
      summarize: async (fileId) => { digested.push(fileId); },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(res.fileId) as {
      original_name: string; kb: number; visibility: string; mime_type: string; stored_name: string;
    };
    expect(row.kb).toBe(1);
    expect(row.visibility).toBe('team');
    expect(row.original_name).toContain('新能源汽车补贴延长通知');
    const saved = fs.readFileSync(path.join(dir, row.stored_name), 'utf8');
    expect(saved).toContain('来源 / Source: https://www.gov.cn/tongzhi.htm');
    expect(saved).toContain('新能源补贴政策');
    // pipeline chained: extraction then digest, same file id
    await new Promise((r) => setTimeout(r, 10));
    expect(processed).toEqual([res.fileId]);
    expect(digested).toEqual([res.fileId]);
    db.close();
  });

  it('guarded / failing / thin pages are refused without touching the DB', async () => {
    const db = freshDb();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbimp-'));
    const noop = { uploadsDir: dir, process: async () => {}, summarize: async () => {} };
    expect((await importUrlToKb('http://127.0.0.1/x', null, db, { ...noop, fetchImpl: stubFetch(PAGE) })).ok).toBe(false);
    expect(await importUrlToKb('https://ok.com/404', null, db, { ...noop, fetchImpl: stubFetch('', { status: 404 }) }))
      .toEqual({ ok: false, reason: 'http_404' });
    expect((await importUrlToKb('https://ok.com/nav', null, db, { ...noop, fetchImpl: stubFetch('<html><body><a>首页</a></body></html>') })).ok).toBe(false);
    expect(await importUrlToKb('https://ok.com/bin', null, db, { ...noop, fetchImpl: stubFetch('%PDF-1.7 xxxxx', { type: 'application/pdf' }) }))
      .toEqual({ ok: false, reason: 'unsupported_content_type' });
    const count = (db.prepare('SELECT COUNT(*) AS n FROM file_library').get() as { n: number }).n;
    expect(count).toBe(0);
    db.close();
  });
});
