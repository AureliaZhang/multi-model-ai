import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * `--app-height` 追踪（v0.7.98 建立，v0.7.99 加入每帧合并）
 *
 * 这个文件是 owner 真机报的三个 iPhone 问题的现场：
 *   2026-08-15「输入法框占了屏幕三分之二」「隐藏输入法后输入框还停在三分之二处」
 *   2026-08-22「输入法弹出时输入框向上会卡一下」
 *
 * 前两个的根因是 v0.7.95 之前缩放时**跳过写入**，把上一次的值冻在那儿；
 * 修法是缩放时**删掉这个属性**，把控制权交回 CSS 的 100dvh 兜底。
 *
 * 第三个的根因是输入法弹出动画期间 resize 连续触发，每次都直接改样式，
 * 同一帧内多次写入 = 重排抖动；修法是用 rAF 把一帧内的多次 resize 合并成一次。
 *
 * 这组测试锁住两条契约：**缩放时必须 remove 而不是 skip**、
 * **一帧最多写一次且写的是最新值**。
 */

type VV = {
  height: number;
  scale: number;
  addEventListener: (t: string, fn: () => void) => void;
  removeEventListener: (t: string, fn: () => void) => void;
};

function setup(vv: Partial<VV> | null, opts: { raf?: boolean } = {}) {
  const withRaf = opts.raf !== false;
  const calls: Array<[string, string | undefined]> = [];
  const listeners = new Map<string, () => void>();
  const frames = new Map<number, () => void>();
  let nextHandle = 1;

  const viewport = vv
    ? ({
        height: 800,
        scale: 1,
        addEventListener: (t: string, fn: () => void) => listeners.set(t, fn),
        removeEventListener: (t: string) => listeners.delete(t),
        ...vv,
      } as VV)
    : undefined;

  vi.stubGlobal('window', {
    visualViewport: viewport,
    ...(withRaf
      ? {
          requestAnimationFrame: (cb: () => void) => {
            const h = nextHandle++;
            frames.set(h, cb);
            return h;
          },
          cancelAnimationFrame: (h: number) => frames.delete(h),
        }
      : {}),
  });
  vi.stubGlobal('document', {
    documentElement: {
      style: {
        setProperty: (k: string, v: string) => calls.push([`set:${k}`, v]),
        removeProperty: (k: string) => calls.push([`remove:${k}`, undefined]),
      },
    },
  });

  /** 跑完当前排队的帧回调（模拟浏览器进入下一帧）。 */
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((cb) => cb());
  };

  const resize = () => listeners.get('resize')?.();
  const pendingFrames = () => frames.size;

  return { calls, listeners, viewport, flush, resize, pendingFrames };
}

afterEach(() => vi.unstubAllGlobals());

describe('trackViewportHeight · 基本行为', () => {
  it('挂载时同步写入一次（等一帧会让首屏闪一下）', async () => {
    const { calls } = setup({ height: 640, scale: 1 });
    const { trackViewportHeight } = await import('./viewportHeight');
    trackViewportHeight();
    expect(calls).toEqual([['set:--app-height', '640px']]);
  });

  it('⚠ 缩放时必须删掉属性，不能跳过写入 —— 跳过就会把旧值冻住', async () => {
    const { calls } = setup({ height: 400, scale: 1.7 });
    const { trackViewportHeight } = await import('./viewportHeight');
    trackViewportHeight();
    expect(calls).toEqual([['remove:--app-height', undefined]]);
    expect(calls.some(([k]) => k.startsWith('set:'))).toBe(false);
  });

  it('键盘弹出 → 收起 → 缩放：每次都重新求值，不留陈旧值', async () => {
    const { calls, viewport, flush, resize } = setup({ height: 800, scale: 1 });
    const { trackViewportHeight } = await import('./viewportHeight');
    trackViewportHeight();

    viewport!.height = 320; resize(); flush();   // 键盘弹出
    viewport!.height = 800; resize(); flush();   // 键盘收起
    viewport!.scale = 2;    resize(); flush();   // 用户捏合放大

    expect(calls).toEqual([
      ['set:--app-height', '800px'],
      ['set:--app-height', '320px'],
      ['set:--app-height', '800px'],
      ['remove:--app-height', undefined],
    ]);
  });

  it('缩放回 1 之后恢复写入（不会一直停在 remove 状态）', async () => {
    const { calls, viewport, flush, resize } = setup({ height: 500, scale: 2 });
    const { trackViewportHeight } = await import('./viewportHeight');
    trackViewportHeight();
    viewport!.scale = 1; resize(); flush();
    expect(calls).toEqual([
      ['remove:--app-height', undefined],
      ['set:--app-height', '500px'],
    ]);
  });

  it('浏览器不支持 visualViewport 时安静地什么都不做', async () => {
    const { calls } = setup(null);
    const { trackViewportHeight } = await import('./viewportHeight');
    const stop = trackViewportHeight();
    expect(calls).toEqual([]);
    expect(() => stop()).not.toThrow();
  });
});

describe('trackViewportHeight · 每帧合并（v0.7.99 修输入法卡顿）', () => {
  it('⚠ 一帧内连来 5 次 resize，只写 1 次 —— 这就是卡顿的来源', async () => {
    const { calls, viewport, flush, resize } = setup({ height: 800, scale: 1 });
    const { trackViewportHeight } = await import('./viewportHeight');
    trackViewportHeight();
    calls.length = 0; // 丢掉挂载时那次

    // 输入法弹出动画：同一帧里 visualViewport 连续变化
    for (const h of [700, 600, 500, 420, 360]) {
      viewport!.height = h;
      resize();
    }
    expect(calls, '还没到下一帧，不该有任何写入').toEqual([]);

    flush();
    expect(calls).toHaveLength(1);
  });

  it('合并后写的是最后一次的值，不是第一次的', async () => {
    const { calls, viewport, flush, resize } = setup({ height: 800, scale: 1 });
    const { trackViewportHeight } = await import('./viewportHeight');
    trackViewportHeight();
    calls.length = 0;

    viewport!.height = 700; resize();
    viewport!.height = 360; resize();
    flush();

    expect(calls).toEqual([['set:--app-height', '360px']]);
  });

  it('跨帧的 resize 各写各的（合并只在一帧内）', async () => {
    const { calls, viewport, flush, resize } = setup({ height: 800, scale: 1 });
    const { trackViewportHeight } = await import('./viewportHeight');
    trackViewportHeight();
    calls.length = 0;

    viewport!.height = 600; resize(); flush();
    viewport!.height = 360; resize(); flush();

    expect(calls).toEqual([
      ['set:--app-height', '600px'],
      ['set:--app-height', '360px'],
    ]);
  });

  it('清理时取消尚未执行的帧（组件卸载后不该再改样式）', async () => {
    const { calls, viewport, flush, resize, pendingFrames } = setup({ height: 800, scale: 1 });
    const { trackViewportHeight } = await import('./viewportHeight');
    const stop = trackViewportHeight();
    calls.length = 0;

    viewport!.height = 360;
    resize();
    expect(pendingFrames()).toBe(1);

    stop();
    expect(pendingFrames(), '未执行的帧应被取消').toBe(0);
    flush();
    expect(calls).toEqual([]);
  });

  it('清理后再触发 resize 不再写入', async () => {
    const { calls, viewport, flush, resize } = setup({ height: 800, scale: 1 });
    const { trackViewportHeight } = await import('./viewportHeight');
    const stop = trackViewportHeight();
    stop();
    calls.length = 0;

    viewport!.height = 360; resize(); flush();
    expect(calls).toEqual([]);
  });

  it('没有 requestAnimationFrame 的环境退回同步写入（行为同改造前）', async () => {
    const { calls, viewport, resize } = setup({ height: 800, scale: 1 }, { raf: false });
    const { trackViewportHeight } = await import('./viewportHeight');
    const stop = trackViewportHeight();
    calls.length = 0;

    viewport!.height = 360;
    resize();
    expect(calls, '没有 rAF 就该立即写，不能什么都不做').toEqual([['set:--app-height', '360px']]);
    expect(() => stop()).not.toThrow();
  });
});
