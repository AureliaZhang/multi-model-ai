import { describe, it, expect } from 'vitest';
import { buildMessageContent, wrapFileText, type AttachmentPiece } from './chatContent';

/**
 * 消息 content 拼装（v0.7.98，§10.11 ②）
 *
 * 这段规则原先在 routes/chat.ts 的 697 行处理函数里写了两遍
 * （本轮消息一份、历史消息一份），谁都没被测过。
 * 抽成纯函数后把分支穷举一遍。
 */

const img = (url: string): AttachmentPiece => ({ kind: 'image', url });
const file = (filename: string, extracted: string | null): AttachmentPiece => ({ kind: 'file', filename, extracted });

describe('buildMessageContent', () => {
  it('没有附件时就是原文（字符串，不是数组）', () => {
    expect(buildMessageContent('你好', [])).toBe('你好');
  });

  it('只有文件时仍是字符串，文件内容追加在正文后', () => {
    const out = buildMessageContent('看下这个', [file('spec.pdf', '第一章 概述')]);
    expect(typeof out).toBe('string');
    expect(out).toContain('看下这个');
    expect(out).toContain('--- [Attached File: spec.pdf] ---');
    expect(out).toContain('第一章 概述');
    expect(out).toContain('--- [End of spec.pdf] ---');
  });

  it('有图片时必须变成数组，且第一片是完整正文', () => {
    const out = buildMessageContent('这是什么', [img('https://x/a.png')]);
    expect(Array.isArray(out)).toBe(true);
    const parts = out as Exclude<typeof out, string>;
    expect(parts[0]).toEqual({ type: 'text', text: '这是什么' });
    expect(parts[1]).toEqual({ type: 'image_url', image_url: { url: 'https://x/a.png' } });
  });

  it('图 + 文件混在一起：文件文本进第一片，图片各占一片', () => {
    const out = buildMessageContent('都看一下', [
      img('data:image/png;base64,AAA'),
      file('note.txt', '备注内容'),
      img('data:image/jpeg;base64,BBB'),
    ]) as ChatParts;
    expect(out).toHaveLength(3);
    expect(out[0].type).toBe('text');
    expect((out[0] as { text: string }).text).toContain('都看一下');
    expect((out[0] as { text: string }).text).toContain('备注内容');
    expect(out[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } });
    expect(out[2]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } });
  });

  it('多个文件按顺序依次追加', () => {
    const out = buildMessageContent('两份材料', [file('a.md', 'AAA'), file('b.md', 'BBB')]) as string;
    expect(out.indexOf('AAA')).toBeLessThan(out.indexOf('BBB'));
    expect(out).toContain('[Attached File: a.md]');
    expect(out).toContain('[Attached File: b.md]');
  });

  it('解析失败的文件被跳过，不留空的包裹标记', () => {
    const out = buildMessageContent('打不开的文件', [file('broken.pdf', null), file('ok.txt', '有内容')]) as string;
    expect(out).not.toContain('broken.pdf');
    expect(out).toContain('ok.txt');
  });

  it('解析出空串也算失败（真·空文件 / 不支持的格式）', () => {
    expect(buildMessageContent('正文', [file('empty.pdf', '')])).toBe('正文');
  });

  it('只有解析失败的文件时，content 退回纯字符串而不是空数组', () => {
    const out = buildMessageContent('正文', [file('x.pdf', null)]);
    expect(out).toBe('正文');
    expect(Array.isArray(out)).toBe(false);
  });

  it('正文为空但有图：第一片是空文本，不能省掉', () => {
    const out = buildMessageContent('', [img('u1')]) as ChatParts;
    expect(out[0]).toEqual({ type: 'text', text: '' });
    expect(out).toHaveLength(2);
  });

  it('不修改传入的数组', () => {
    const pieces = [img('u1'), file('f', 'x')];
    const copy = JSON.parse(JSON.stringify(pieces));
    buildMessageContent('t', pieces);
    expect(pieces).toEqual(copy);
  });
});

describe('wrapFileText', () => {
  it('包出开始和结束标记', () => {
    expect(wrapFileText('a.txt', '内容')).toBe('\n\n--- [Attached File: a.txt] ---\n内容\n--- [End of a.txt] ---');
  });

  it('文件名缺失时退回 "file"（历史附件可能没有名字）', () => {
    expect(wrapFileText(null, 'x')).toContain('[Attached File: file]');
    expect(wrapFileText(undefined, 'x')).toContain('[End of file]');
    expect(wrapFileText('', 'x')).toContain('[Attached File: file]');
  });
});

type ChatParts = Array<{ type: string; text?: string; image_url?: { url: string } }>;
