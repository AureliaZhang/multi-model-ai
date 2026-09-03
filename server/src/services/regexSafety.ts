/**
 * 正则的护栏（v0.8.1）
 *
 * JS 的 `RegExp` 是回溯式的，`(a+)+b` 这类嵌套量词碰上不匹配的输入会指数级回溯
 * （catastrophic backtracking / ReDoS）。Node 是单线程，**一次这样的 replace
 * 就把整个事件循环焊死** —— 不是变慢，是全站所有人都收不到响应，而且不会自己
 * 恢复，只能重启进程。实测 `(a+)+b` 配 40 个 a 就足够。
 *
 * 两个入口都会跑用户给的 pattern：
 *   1. `GET /api/regex/test` —— 直接把 pattern 和 text 都交给调用方
 *   2. `applyRegexScripts()` —— 用户存下来的脚本，每次聊天都跑
 *
 * 这里提供两道护栏：
 *   - `assertRegexInputLimits()`：先把明显过大的输入挡在外面（便宜，同步）
 *   - `runRegexWithTimeout()`：真正的兜底 —— 正则跑在 worker 线程里，超时
 *     `terminate()`。主线程的事件循环不受影响，这是唯一能真正打断回溯的办法
 *     （`Promise.race` 拦不住同步的 replace）。
 *
 * 不引 `re2`（原生依赖，装不上就整个服务起不来）也不引 `safe-regex`
 * （静态判断，既漏又误杀）。超时是唯一对所有 pattern 都成立的界。
 */

import { Worker } from 'worker_threads';

/** 单个 pattern 的字符数上限。真实脚本远小于这个数。 */
export const MAX_PATTERN_LENGTH = 1_000;

/** 待处理文本的字符数上限（测试入口用；聊天正文另有自己的限制）。 */
export const MAX_TEST_TEXT_LENGTH = 100_000;

/** 一次正则执行的墙上时间上限。正常 pattern 在毫秒级完成。 */
export const REGEX_TIMEOUT_MS = 1_000;

/** 输入超限时抛出，调用方转成 400。 */
export class RegexInputError extends Error {}

/** 执行超时时抛出，调用方转成 400 并告诉用户这个 pattern 太贵。 */
export class RegexTimeoutError extends Error {
  constructor(ms: number) {
    super(`Regex execution exceeded ${ms}ms — the pattern is too expensive (possible catastrophic backtracking)`);
  }
}

/**
 * 廉价的前置检查。挡掉明显过大的输入，省下起 worker 的开销。
 * 挡不住 `(a+)+b` 这种「短小但致命」的 pattern —— 那个交给超时。
 */
export function assertRegexInputLimits(pattern: string, text: string): void {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new RegexInputError(`Pattern too long (${pattern.length} > ${MAX_PATTERN_LENGTH} characters)`);
  }
  if (text.length > MAX_TEST_TEXT_LENGTH) {
    throw new RegexInputError(`Text too long (${text.length} > ${MAX_TEST_TEXT_LENGTH} characters)`);
  }
}

/**
 * worker 里跑的代码。
 *
 * 用字符串 `eval` 形式（`eval: true`）而不是单独的文件，是因为编译产物目录结构
 * （`dist/` vs `src/`）会让文件路径在开发和生产下不一致 —— 内联没这个问题。
 *
 * 替换语义要和 `testRegex()` 原来的实现一致：支持 `$1`/`$2` 引用捕获组。
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
const { pattern, flags, replacement, text } = workerData;
try {
  const regex = new RegExp(pattern, flags);
  let matchCount = 0;
  const result = text.replace(regex, (...args) => {
    matchCount++;
    return replacement.replace(/\\$(\\d+)/g, (_, idx) => args[parseInt(idx, 10)] ?? '');
  });
  parentPort.postMessage({ ok: true, result, matches: matchCount });
} catch (err) {
  parentPort.postMessage({ ok: false, error: err && err.message ? err.message : String(err) });
}
`;

export interface RegexRunResult {
  result: string;
  matches: number;
  /** pattern 本身非法（`new RegExp` 抛了）时给出的信息。不是超时。 */
  error?: string;
}

/**
 * 在 worker 线程里跑一次 replace，超时就 `terminate()`。
 *
 * @throws {RegexInputError}   输入超过长度上限
 * @throws {RegexTimeoutError} 执行超过 `timeoutMs`
 */
export function runRegexWithTimeout(
  pattern: string,
  flags: string,
  replacement: string,
  text: string,
  timeoutMs: number = REGEX_TIMEOUT_MS
): Promise<RegexRunResult> {
  assertRegexInputLimits(pattern, text);

  return new Promise<RegexRunResult>((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { pattern, flags, replacement, text },
      // 不给 worker 继承 stdio / 环境，减小它能碰到的面。
      env: {},
      stdout: true,
      stderr: true,
    });

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new RegexTimeoutError(timeoutMs)));
    }, timeoutMs);

    worker.on('message', (msg: { ok: boolean; result?: string; matches?: number; error?: string }) => {
      finish(() => {
        if (msg.ok) {
          resolve({ result: msg.result ?? '', matches: msg.matches ?? 0 });
        } else {
          // 非法 pattern：保持原来的行为 —— 原文返回 + error 字段，不是抛。
          resolve({ result: text, matches: 0, error: msg.error });
        }
      });
    });

    worker.on('error', (err) => {
      finish(() => reject(err));
    });

    worker.on('exit', (code) => {
      // 只有在没 settle 就退出时才算异常（正常路径已经在 message 里 terminate 了）。
      finish(() => reject(new Error(`Regex worker exited unexpectedly (code ${code})`)));
    });
  });
}
