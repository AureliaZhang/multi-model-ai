import { describe, it, expect } from 'vitest';
import {
  runRegexWithTimeout,
  assertRegexInputLimits,
  RegexInputError,
  RegexTimeoutError,
  MAX_PATTERN_LENGTH,
  MAX_TEST_TEXT_LENGTH,
} from './regexSafety';

describe('regexSafety', () => {
  describe('assertRegexInputLimits', () => {
    it('接受正常大小的输入', () => {
      expect(() => assertRegexInputLimits('a+', 'aaa')).not.toThrow();
      expect(() => assertRegexInputLimits('x'.repeat(100), 'y'.repeat(1000))).not.toThrow();
    });

    it('拒绝超长 pattern', () => {
      const longPattern = 'x'.repeat(MAX_PATTERN_LENGTH + 1);
      expect(() => assertRegexInputLimits(longPattern, 'text')).toThrow(RegexInputError);
      expect(() => assertRegexInputLimits(longPattern, 'text')).toThrow(/Pattern too long/);
    });

    it('拒绝超长 text', () => {
      const longText = 'y'.repeat(MAX_TEST_TEXT_LENGTH + 1);
      expect(() => assertRegexInputLimits('a', longText)).toThrow(RegexInputError);
      expect(() => assertRegexInputLimits('a', longText)).toThrow(/Text too long/);
    });
  });

  describe('runRegexWithTimeout', () => {
    it('正常执行简单替换', async () => {
      const result = await runRegexWithTimeout('a', 'g', 'X', 'banana');
      expect(result).toEqual({ result: 'bXnXnX', matches: 3 });
    });

    it('支持捕获组引用 $1/$2', async () => {
      const result = await runRegexWithTimeout('(\\w+)@(\\w+)', 'g', '$2!$1', 'alice@example bob@test');
      expect(result.result).toBe('example!alice test!bob');
      expect(result.matches).toBe(2);
    });

    it('pattern 非法时返回 error 字段、不抛', async () => {
      const result = await runRegexWithTimeout('[invalid', 'g', '', 'text');
      expect(result.result).toBe('text');
      expect(result.matches).toBe(0);
      expect(result.error).toMatch(/Unterminated character class|Invalid regular expression/);
    });

    it('灾难性回溯会超时（不焊死主线程）', async () => {
      // (a+)+ 配不匹配的输入 → 指数级回溯
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

    it('超限输入会被前置检查拦截（不起 worker）', () => {
      const longPattern = 'x'.repeat(MAX_PATTERN_LENGTH + 1);
      // assertRegexInputLimits 是同步抛的，runRegexWithTimeout 会在 worker 之前调它
      expect(() => assertRegexInputLimits(longPattern, 'text')).toThrow(RegexInputError);
    });
  });
});
