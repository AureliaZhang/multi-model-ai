import { describe, it, expect } from 'vitest';
import { runRegexWithTimeout, RegexTimeoutError } from '../services/regexSafety';

describe('regex 路由权限守卫（v0.8.1）', () => {
  /**
   * 修复前：GET /api/regex/test 是整个 regex.ts 里唯一没有 requireAuth 的路由，
   * 而它会拿调用方给的 pattern 跑 replace —— 未登录就能用 (a+)+b 这类嵌套量词
   * 把事件循环焊死（实测 40 个 a 即可，进程不会自己恢复）。
   *
   * 修复后：/test 加了 requireAuth，且所有正则执行都在 worker 线程里限时跑。
   * 这里直接测 runRegexWithTimeout 对灾难性回溯的防护。
   */
  describe('灾难性回溯防护', () => {
    it('(a+)+b 配不匹配的输入 → 超时而非焊死主线程', async () => {
      const pattern = '(a+)+b';
      const text = 'a'.repeat(28); // 2^28 次回溯 —— 裸跑会卡几十秒
      const start = Date.now();

      await expect(runRegexWithTimeout(pattern, 'g', '', text, 500)).rejects.toThrow(RegexTimeoutError);

      const elapsed = Date.now() - start;
      // 应该在 500ms 附近终止，给 worker 启动和清理留 200ms 余量
      expect(elapsed).toBeLessThan(700);
    });

    it('超时后主线程仍可响应（验证 worker 真的被 terminate 了）', async () => {
      const evil = '(a+)+b';
      const text = 'a'.repeat(28);
      await expect(runRegexWithTimeout(evil, 'g', '', text, 300)).rejects.toThrow(RegexTimeoutError);

      // 紧接着跑一个正常的 —— 如果 worker 没杀干净，这里会卡住或失败
      const good = await runRegexWithTimeout('x', 'g', 'y', 'xxx');
      expect(good.result).toBe('yyy');
    });
  });
});
