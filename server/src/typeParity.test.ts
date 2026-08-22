import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 前后端类型对齐（v0.7.98，§10.11 ③）
 *
 * 项目里同一批类型在两个文件各写一份：
 *   server/src/types.ts        （35 个导出）
 *   client/src/types/index.ts  （66 个导出）
 * 其中 30 个同名。审计（2026-08-21）时有 **8 个已经悄悄不一致**，最要命的是
 * `ModelCapability` —— 服务端少了 `'tts' | 'embedding'`，而 `routes/prefs.ts`
 * 一直在用这两个值筛选模型，等于服务端的类型对自己的领域撒谎。
 *
 * 真正的问题不是「写了两份」，而是**漂移没人发现**。所以不做大手术
 * （抽 shared 包要改两边的 tsconfig / Vite 解析 / 部署脚本，风险远大于收益），
 * 改成在这里立一道闸：**同名类型必须逐字段一致，例外必须写进下面的白名单并说明理由**。
 *
 * 以后谁给一边加了字段忘了另一边，这个测试会直接失败并打印差异。
 */

const ROOT = path.resolve(__dirname, '../..');
const SERVER_TYPES = path.join(ROOT, 'server/src/types.ts');
const CLIENT_TYPES = path.join(ROOT, 'client/src/types/index.ts');

/**
 * 白名单：**故意**不一致的类型，附理由。
 * 往这里加条目等于承认「这两边描述的确实不是同一个东西」，请写清楚为什么。
 */
const INTENTIONAL_DIFFERENCES: Record<string, string> = {
  // 客户端的 Message.toolCalls 是前端自己从 SSE 事件（`data: {"toolCall":…}`）
  // 攒出来的展示字段，服务端的 Message 从来不带它 —— 它不是接口字段。
  Message: '客户端的 toolCalls 由 SSE 事件在前端组装，不是服务端返回的字段',
  // 服务端的 Attachment 描述的是数据库行投影，message_id 必然存在；
  // 客户端还会收到 chat SSE 里的 attachmentMeta（只有 id/type/filename/mimeType），
  // 所以它那份必须把 messageId 当可选。
  Attachment: '服务端描述 DB 行（messageId 必有）；客户端还要兜 SSE 的 attachmentMeta（没有 messageId）',
};

type Decl =
  | { kind: 'interface'; fields: string[] }
  | { kind: 'type'; body: string };

/** 极简解析：够用就好，解析不出东西时测试自己会失败（见下面的哨兵断言）。 */
function extractDecls(file: string): Map<string, Decl> {
  const src = readFileSync(file, 'utf8').split('\n');
  const out = new Map<string, Decl>();

  for (let i = 0; i < src.length; i++) {
    const m = src[i].match(/^export\s+(interface|type)\s+(\w+)/);
    if (!m) continue;
    const [, kind, name] = m;

    if (kind === 'type') {
      let body = src[i];
      let j = i;
      while (!body.includes(';') && j < src.length - 1) body += ' ' + src[++j].trim();
      out.set(name, {
        kind: 'type',
        body: body.replace(/\/\/.*$/, '').replace(/\s+/g, ' ').replace(/^export type \w+ = /, '').replace(/;$/, '').trim(),
      });
      i = j;
      continue;
    }

    let depth = 0;
    let j = i;
    const lines: string[] = [];
    do {
      const l = src[j];
      depth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
      lines.push(l);
      j++;
    } while (depth > 0 && j < src.length);

    const fields = lines
      .slice(1, -1)
      .map((l) => l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim())
      .filter(Boolean)
      .sort();
    out.set(name, { kind: 'interface', fields });
    i = j - 1;
  }
  return out;
}

const SERVER = extractDecls(SERVER_TYPES);
const CLIENT = extractDecls(CLIENT_TYPES);
const SHARED = [...SERVER.keys()].filter((k) => CLIENT.has(k)).sort();

describe('前后端类型对齐', () => {
  it('解析器本身是好的（哨兵：解析不出东西就不该让别的断言假通过）', () => {
    expect(SERVER.size).toBeGreaterThan(25);
    expect(CLIENT.size).toBeGreaterThan(50);
    expect(SHARED.length).toBeGreaterThan(25);
    expect(SERVER.has('ModelCapability')).toBe(true);
    expect(CLIENT.has('ModelCapability')).toBe(true);
  });

  it('同名类型必须逐字段一致（例外见 INTENTIONAL_DIFFERENCES）', () => {
    const drifted: string[] = [];

    for (const name of SHARED) {
      if (name in INTENTIONAL_DIFFERENCES) continue;
      const a = SERVER.get(name)!;
      const b = CLIENT.get(name)!;

      if (a.kind !== b.kind) {
        drifted.push(`${name}: 服务端是 ${a.kind}，客户端是 ${b.kind}`);
        continue;
      }
      if (a.kind === 'type' && b.kind === 'type') {
        if (a.body !== b.body) drifted.push(`${name}: 服务端 "${a.body}" ←→ 客户端 "${b.body}"`);
        continue;
      }
      if (a.kind === 'interface' && b.kind === 'interface') {
        const onlyServer = a.fields.filter((f) => !b.fields.includes(f));
        const onlyClient = b.fields.filter((f) => !a.fields.includes(f));
        if (onlyServer.length || onlyClient.length) {
          drifted.push(
            `${name}: 仅服务端 [${onlyServer.join(' | ')}]  仅客户端 [${onlyClient.join(' | ')}]`
          );
        }
      }
    }

    expect(drifted, `以下同名类型两边不一致。要么改齐，要么写进 INTENTIONAL_DIFFERENCES 并说明理由：\n  ${drifted.join('\n  ')}`).toEqual([]);
  });

  it('ModelCapability 必须包含 routes/prefs.ts 实际使用的能力值', () => {
    // 这条单独立一个断言：审计时就是这里出的问题，服务端类型少了两个值。
    const server = SERVER.get('ModelCapability');
    expect(server?.kind).toBe('type');
    const body = (server as { body: string }).body;
    for (const cap of ['text', 'vision', 'image-gen', 'code', 'tts', 'embedding']) {
      expect(body, `ModelCapability 缺少 '${cap}'`).toContain(`'${cap}'`);
    }
  });

  it('白名单里不能有已经改齐的条目（避免白名单越攒越大）', () => {
    const stale: string[] = [];
    for (const name of Object.keys(INTENTIONAL_DIFFERENCES)) {
      if (!SERVER.has(name) || !CLIENT.has(name)) continue;
      const a = SERVER.get(name)!;
      const b = CLIENT.get(name)!;
      if (a.kind !== 'interface' || b.kind !== 'interface') continue;
      const same =
        a.fields.length === b.fields.length && a.fields.every((f) => b.fields.includes(f));
      if (same) stale.push(name);
    }
    expect(stale, `这些类型已经一致了，请从 INTENTIONAL_DIFFERENCES 里删掉：${stale.join(', ')}`).toEqual([]);
  });
});
