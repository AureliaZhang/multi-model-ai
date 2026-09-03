import { describe, it, expect } from 'vitest';
import { parseSSEResponse } from './mcpClient';

/**
 * MCP 的 SSE 响应解析（v0.8.0）
 *
 * 这里锁的是一个**真 bug**：原先 `if (data.error) throw` 写在同一个
 * `try { JSON.parse(...) }` 里面，于是自己抛的 `MCP error` 被 catch 当成
 * 「无效 JSON」吞掉，循环跑到流结束后统一报 `No result received from SSE stream`。
 * 结果就是 MCP 服务器明确说出的原因（认证失败、工具不存在、参数不对）
 * **永远看不到**，排查只能靠猜。
 */

/** 把若干 chunk 包成一个只有 body 的假 Response（只用到 body.getReader()）。 */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const body = {
    getReader() {
      return {
        async read() {
          if (i >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: encoder.encode(chunks[i++]) };
        },
      };
    },
  };
  return { body } as unknown as Response;
}

describe('parseSSEResponse', () => {
  it('取出 JSON-RPC 的 result', async () => {
    const r = await parseSSEResponse(sseResponse([
      'data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n',
    ]));
    expect(r).toEqual({ tools: [] });
  });

  it('⚠ 服务器报错时把原因抛出来，不再吞掉', async () => {
    await expect(parseSSEResponse(sseResponse([
      'data: {"jsonrpc":"2.0","id":1,"error":{"code":-32001,"message":"Unauthorized"}}\n',
    ]))).rejects.toThrow('MCP error -32001: Unauthorized');
  });

  it('⚠ 报错帧后面还有别的帧时，也报真实原因而不是「没收到结果」', async () => {
    await expect(parseSSEResponse(sseResponse([
      'data: {"error":{"code":-32601,"message":"Method not found"}}\n',
      'data: {"jsonrpc":"2.0"}\n',
    ]))).rejects.toThrow('Method not found');
  });

  it('真的不是 JSON 的帧被跳过，不影响后面的 result', async () => {
    const r = await parseSSEResponse(sseResponse([
      'data: <html>502 Bad Gateway</html>\n',
      'data: {"result":"ok"}\n',
    ]));
    expect(r).toBe('ok');
  });

  it('跨 chunk 截断的帧照样凑齐', async () => {
    const r = await parseSSEResponse(sseResponse([
      'data: {"result":{"na',
      'me":"search"}}\n',
    ]));
    expect(r).toEqual({ name: 'search' });
  });

  it('data: 后面没空格也认（与聊天流共用同一个解析器）', async () => {
    const r = await parseSSEResponse(sseResponse(['data:{"result":42}\n']));
    expect(r).toBe(42);
  });

  it('流结束都没有 result 时报「没收到结果」', async () => {
    await expect(parseSSEResponse(sseResponse([
      'data: {"jsonrpc":"2.0","id":1}\n',
    ]))).rejects.toThrow('No result received');
  });

  it('没有 body 时直接报错', async () => {
    await expect(parseSSEResponse({} as Response)).rejects.toThrow('No response body');
  });
});
