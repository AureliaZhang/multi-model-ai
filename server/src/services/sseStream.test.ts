import { describe, it, expect } from 'vitest';
import { parseSseChunk } from './sseStream';

/**
 * SSE 逐帧解析（v0.8.0，§10.11 ②D）
 *
 * 这一层决定「用户到底看不看得见模型的输出」。原先内联在 routes/chat.ts 的
 * 读取循环里、零测试，且有两处靠上游守规矩才不出问题的收口。
 */

describe('parseSseChunk：基本切帧', () => {
  it('一次带来多帧', () => {
    const r = parseSseChunk('', 'data: {"a":1}\ndata: {"a":2}\n');
    expect(r.frames).toEqual(['{"a":1}', '{"a":2}']);
    expect(r.done).toBe(false);
    expect(r.rest).toBe('');
  });

  it('空行（帧分隔符）不算内容', () => {
    const r = parseSseChunk('', 'data: {"a":1}\n\ndata: {"a":2}\n\n');
    expect(r.frames).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('冒号开头的注释/心跳行不算内容', () => {
    const r = parseSseChunk('', ': keep-alive\ndata: {"a":1}\n');
    expect(r.frames).toEqual(['{"a":1}']);
  });

  it('空的 data 行不算内容（有些站拿它当心跳）', () => {
    const r = parseSseChunk('', 'data: \ndata:\ndata: {"a":1}\n');
    expect(r.frames).toEqual(['{"a":1}']);
  });

  it('完全没有换行符时什么都不算凑齐', () => {
    const r = parseSseChunk('', 'data: {"a":1}');
    expect(r.frames).toEqual([]);
    expect(r.rest).toBe('data: {"a":1}');
  });
});

describe('parseSseChunk：跨 chunk 截断', () => {
  it('⚠ 切在 JSON 中间时留到下次，不丢内容', () => {
    const first = parseSseChunk('', 'data: {"content":"你好');
    expect(first.frames).toEqual([]);
    expect(first.rest).toBe('data: {"content":"你好');

    const second = parseSseChunk(first.rest, '世界"}\n');
    expect(second.frames).toEqual(['{"content":"你好世界"}']);
    expect(second.rest).toBe('');
  });

  it('⚠ 最后一行即使看起来是完整 JSON 也不算凑齐（没换行符就无法断定没被截断）', () => {
    const r = parseSseChunk('', 'data: {"a":1}\ndata: {"a":2}');
    expect(r.frames).toEqual(['{"a":1}']);
    expect(r.rest).toBe('data: {"a":2}');
  });

  it('切在换行符正中间（\\r 与 \\n 之间）也不丢帧', () => {
    const first = parseSseChunk('', 'data: {"a":1}\r');
    expect(first.frames).toEqual([]);
    const second = parseSseChunk(first.rest, '\n');
    expect(second.frames).toEqual(['{"a":1}']);
  });

  it('逐字节喂进去，帧内容依然完整（模拟最坏的分块）', () => {
    const stream = 'data: {"content":"abc"}\ndata: [DONE]\n';
    let buffer = '';
    const got: string[] = [];
    let done = false;
    for (const ch of stream) {
      const r = parseSseChunk(buffer, ch);
      got.push(...r.frames);
      buffer = r.rest;
      if (r.done) { done = true; break; }
    }
    expect(got).toEqual(['{"content":"abc"}']);
    expect(done).toBe(true);
  });
});

describe('parseSseChunk：修严的两处收口', () => {
  it('⚠ data: 后面没有空格也认（SSE 规范里空格是可选的）', () => {
    // 原实现写死 startsWith('data: ')，遇到不带空格的站会把整条流当成没有内容
    const r = parseSseChunk('', 'data:{"a":1}\n');
    expect(r.frames).toEqual(['{"a":1}']);
  });

  it('⚠ [DONE] 之后同一批里的内容一律丢弃', () => {
    // 原实现的 break 只跳出内层循环，靠上游关连接才没出事
    const r = parseSseChunk('', 'data: {"a":1}\ndata: [DONE]\ndata: {"a":2}\n');
    expect(r.frames).toEqual(['{"a":1}']);
    expect(r.done).toBe(true);
  });

  it('⚠ 收到 [DONE] 后残留缓冲被清空，不会在下次诈尸', () => {
    const r = parseSseChunk('', 'data: [DONE]\ndata: {"half":');
    expect(r.done).toBe(true);
    expect(r.rest).toBe('');
  });

  it('[DONE] 不带空格也认', () => {
    const r = parseSseChunk('', 'data:[DONE]\n');
    expect(r.done).toBe(true);
    expect(r.frames).toEqual([]);
  });

  it('[DONE] 前后的空白不影响判定', () => {
    expect(parseSseChunk('', 'data:   [DONE]  \n').done).toBe(true);
  });
});

describe('parseSseChunk：CRLF', () => {
  it('\\r\\n 换行的流照样切帧', () => {
    const r = parseSseChunk('', 'data: {"a":1}\r\ndata: {"a":2}\r\n');
    expect(r.frames).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('⚠ 只去掉行尾的 \\r，不动 JSON 载荷里的转义内容', () => {
    // 载荷里的 \r 是两个字符（反斜杠 + r），是 JSON 转义序列的一部分，不能碰
    const r = parseSseChunk('', 'data: {"content":"a\\r\\nb"}\r\n');
    expect(r.frames).toEqual(['{"content":"a\\r\\nb"}']);
  });
});

describe('parseSseChunk：与旧实现的等价性', () => {
  /** 旧实现（内联在 chat.ts 里的那段）逐字重写，用来比对。 */
  function legacy(chunks: string[]): { frames: string[]; done: boolean } {
    let buffer = '';
    const frames: string[] = [];
    let done = false;
    outer: for (const text of chunks) {
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') { done = true; break outer; }
          frames.push(data);
        }
      }
    }
    return { frames, done };
  }

  function current(chunks: string[]): { frames: string[]; done: boolean } {
    let buffer = '';
    const frames: string[] = [];
    let done = false;
    for (const text of chunks) {
      const r = parseSseChunk(buffer, text);
      frames.push(...r.frames);
      buffer = r.rest;
      if (r.done) { done = true; break; }
    }
    return { frames, done };
  }

  it('⚠ 上游守规矩时（带空格、发完即止）两者逐项一致', () => {
    const chunks = [
      'data: {"a":1}\ndata: {"a"',
      ':2}\ndata: {"a":3}\n',
      'data: [DONE]\n',
    ];
    expect(current(chunks)).toEqual(legacy(chunks));
  });

  it('真实节奏（逐字推送 + 末尾 usage 帧）两者一致', () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"你"}}]}\n',
      'data: {"choices":[{"delta":{"content":"好"}}]}\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"total_tokens":7}}\n',
      'data: [DONE]\n',
    ];
    expect(current(chunks)).toEqual(legacy(chunks));
  });

  it('上游不带空格时旧实现丢光内容、新实现正常 —— 这正是修严的地方', () => {
    const chunks = ['data:{"a":1}\ndata:[DONE]\n'];
    expect(legacy(chunks).frames).toEqual([]);      // 旧：整条流被当成没有内容
    expect(current(chunks).frames).toEqual(['{"a":1}']); // 新：正常
  });
});
