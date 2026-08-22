import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * `--app-height` 追踪（v0.7.98，§10.11 ① 客户端测试补齐）
 *
 * 这个文件是 owner 2026-08-15 真机报的两个 iPhone bug 的现场：
 *   「输入法框占了屏幕三分之二」「隐藏输入法后输入框还停在三分之二处，下面一片空白」
 *
 * 根因是 v0.7.95 之前缩放时**跳过写入**，把上一次的值冻在那儿。iOS 上
 * 缩放常常不是故意的（聚焦小于 16px 的输入控件就会触发），而且不会自己复原，
 * 于是外壳一直卡在「键盘打开时」的高度。修法是缩放时**删掉这个属性**，
 * 把控制权交回 CSS 的 100dvh 兜底——永远不会是陈旧值。
 *
 * 这组测试锁住的就是「缩放时必须 remove 而不是 skip」这条契约。
 */

type VV = {
  height: number;
  scale: number;
  addEventListener: (t: string, fn: () => void) => void;
  removeEventListener: (t: string, fn: () => void) => void;
};

function setup(vv: Partial<VV> | null) {
  const calls: Array<[string, string | undefined]> = [];
  const listeners = new Map<string, () => void>();

  const viewport = vv
    ? ({
        height: 800,
        scale: 1,
        addEventListener: (t: string, fn: () => void) => listeners.set(t, fn),
        removeEventListener: (t: string) => listeners.delete(t),
        ...vv,
      } as VV)
    : undefined;

  vi.stubGlobal('window', { visualViewport: viewport });
  vi.stubGlobal('document', {
    documentElement: {
      style: {
        setProperty: (k: string, v: string) => calls.push([`set:${k}`, v]),
        removeProperty: (k: string) => calls.push([`remove:${k}`, undefined]),
      },
    },
  });

  return { calls, listeners, viewport };
}

afterEach(() => vi.unstubAllGlobals());

describe('trackViewportHeight', () => {
  it('正常情况把可视高度写进 --app-height', async () => {
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
    // 关键：不能出现任何 set —— 那正是 v0.7.95 之前的错误行为
    expect(calls.some(([k]) => k.startsWith('set:'))).toBe(false);
  });

  it('键盘弹出→收起→缩放：每次 resize 都重新求值，不留陈旧值', async () => {
    const { calls, listeners, viewport } = setup({ height: 800, scale: 1 });
    const { trackViewportHeight } = await import('./viewportHeight');
    trackViewportHeight();

    // 键盘弹出：可视区变矮
    viewport!.height = 320;
    listeners.get('resize')!();
    // 键盘收起：恢复
    viewport!.height = 800;
    listeners.get('resize')!();
    // 用户捏合放大：改为交还给 CSS 兜底
    viewport!.scale = 2;
    listeners.get('resize')!();

    expect(calls).toEqual([
      ['set:--app-height', '800px'],
      ['set:--app-height', '320px'],
      ['set:--app-height', '800px'],
      ['remove:--app-height', undefined],
    ]);
  });

  it('缩放回 1 之后重新开始写入（不会一直停在 remove 状态）', async () => {
    const { calls, listeners, viewport } = setup({ height: 500, scale: 2 });
    const { trackViewportHeight } = await import('./viewportHeight');
    trackViewportHeight();
    viewport!.scale = 1;
    listeners.get('resize')!();
    expect(calls).toEqual([
      ['remove:--app-height', undefined],
      ['set:--app-height', '500px'],
    ]);
  });

  it('返回的清理函数会摘掉监听', async () => {
    const { listeners } = setup({ height: 700, scale: 1 });
    const { trackViewportHeight } = await import('./viewportHeight');
    const stop = trackViewportHeight();
    expect(listeners.has('resize')).toBe(true);
    stop();
    expect(listeners.has('resize')).toBe(false);
  });

  it('浏览器不支持 visualViewport 时安静地什么都不做', async () => {
    const { calls } = setup(null);
    const { trackViewportHeight } = await import('./viewportHeight');
    const stop = trackViewportHeight();
    expect(calls).toEqual([]);
    expect(() => stop()).not.toThrow();
  });
});
