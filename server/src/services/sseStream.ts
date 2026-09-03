/**
 * SSE 逐帧解析（v0.8.0，§10.11 ②D）
 *
 * 上游的流式回答是 SSE：一串 `data: {...}` 帧，以 `data: [DONE]` 收尾。
 * 但**到手的是字节块，不是帧** —— 一个 chunk 可能切在 JSON 中间，也可能一次
 * 带来好几帧。这里只负责「字节流 → 一帧帧 JSON 文本」这一层：不碰网络、
 * 不碰数据库、不解析 JSON，纯字符串处理，所以可以穷举测。
 *
 * 原先这段内联在 routes/chat.ts 的读取循环里，有两处**靠上游守规矩才不出问题**
 * 的收口，抽出时一并修严（两处都不是活着的 bug，是等着哪天变成 bug 的写法）：
 *
 *   1. `[DONE]` 原先只 `break` 出「遍历本批行」的内循环，没跳出外层
 *      `reader.read()` 循环。表现正常靠的是上游发完就关连接，不是我们收口。
 *      现在显式返回 `done: true`，由调用方停止读取。
 *   2. 帧头原先写死 `startsWith('data: ')`（带空格），而 SSE 规范里
 *      `data:` 后面的空格是**可选**的。在用的站都带空格所以没出事；
 *      哪天遇到不带的，整条流会被当成没有内容 —— 静默失败，最难查。
 */

/** 一次解析的结果。 */
export interface SseParseResult {
  /** 本次凑齐的完整帧的**载荷**（`data:` 之后的部分，已去掉首尾空白）。不含 `[DONE]`。 */
  frames: string[];
  /** 是否收到了 `[DONE]`。收到后调用方应停止读取 —— 其后的内容一律丢弃。 */
  done: boolean;
  /** 尚未凑齐的尾巴，原样留着，下次调用连着新数据一起传进来。 */
  rest: string;
}

/** SSE 的终止哨兵。 */
const DONE_SENTINEL = '[DONE]';

/**
 * 把新到的一段文本接到残留缓冲后面，切出所有**完整**的帧。
 *
 * @param buffer 上一次调用返回的 `rest`（首次传 `''`）
 * @param text   本次从流里解码出来的新文本
 *
 * 只按 `\n` 切分，并逐行剥掉行尾的 `\r` —— 这样 `\n` 和 `\r\n` 两种换行
 * 都能处理，而不必先对整个缓冲做一次替换（那会动到 JSON 载荷里的 `\r`）。
 *
 * **最后一行永远不算凑齐**（哪怕它看起来是完整的 JSON）：没见到换行符就无法
 * 断定它没被截断。它会作为 `rest` 返回，下次再判断。
 */
export function parseSseChunk(buffer: string, text: string): SseParseResult {
  const combined = buffer + text;
  const lines = combined.split('\n');
  // 最后一段没有换行符收尾 —— 可能是被截断的半行，留到下次。
  const rest = lines.pop() ?? '';

  const frames: string[] = [];
  let done = false;

  for (const rawLine of lines) {
    // 兼容 CRLF：只去掉行尾的 \r，不动载荷里的。
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (!line.startsWith('data:')) {
      // 空行是帧分隔符，`:` 开头是注释/心跳（有些站用它保活）。都不是内容。
      continue;
    }

    // `data:` 之后的空格按规范是可选的，所以按前缀长度切、再 trim，
    // 而不是匹配 `'data: '` 这个带空格的字面量。
    const payload = line.slice(5).trim();

    if (payload === DONE_SENTINEL) {
      done = true;
      // 收口就在这里：`[DONE]` 之后同一批里的任何内容都不再要。
      break;
    }

    // 空的 data 行不是内容（有些站拿它当心跳）。
    if (payload) frames.push(payload);
  }

  // 收到 `[DONE]` 后残留缓冲没有意义了 —— 留着只会在调用方复用 buffer 时诈尸。
  return { frames, done, rest: done ? '' : rest };
}
