import { describe, it, expect } from 'vitest';
import { isAtBottom, shouldResumeFollow, followBehavior, BOTTOM_SLACK_PX } from './scrollFollow';

/**
 * 「贴底跟随」规则（v0.7.98，§10.11 ①）
 *
 * 这组测试守的是 owner 2026-08-15 电脑端报的那个 bug：
 *   「AI 输出的时候我没办法滑动屏幕，只能等他输出完成」
 *
 * 当时的写法是每个 token 都无条件 scrollIntoView + smooth，
 * 于是往上滑立刻被拽回去，而且几十段平滑动画叠在一起。
 */

const el = (scrollHeight: number, scrollTop: number, clientHeight: number) => ({
  scrollHeight, scrollTop, clientHeight,
});

describe('isAtBottom', () => {
  it('滚到底部算贴底', () => {
    expect(isAtBottom(el(1000, 600, 400))).toBe(true);
  });

  it('往上翻了就不算贴底 —— 这是「能自由滚动」的前提', () => {
    expect(isAtBottom(el(1000, 200, 400))).toBe(false);
  });

  it('留 40px 余量：差几个像素仍算贴底（子像素布局 / 手机回弹）', () => {
    expect(isAtBottom(el(1000, 599, 400))).toBe(true);   // 差 1px
    expect(isAtBottom(el(1000, 561, 400))).toBe(true);   // 差 39px，仍在余量内
    expect(isAtBottom(el(1000, 560, 400))).toBe(false);  // 差 40px，出余量
    expect(BOTTOM_SLACK_PX).toBe(40);
  });

  it('内容还没撑满容器时恒为贴底（负的剩余距离）', () => {
    expect(isAtBottom(el(300, 0, 400))).toBe(true);
  });

  it('余量可调', () => {
    expect(isAtBottom(el(1000, 500, 400), 200)).toBe(true);
    expect(isAtBottom(el(1000, 500, 400), 50)).toBe(false);
  });
});

describe('shouldResumeFollow', () => {
  it('自己发了新消息 → 强制回到跟随（否则会以为没发出去）', () => {
    expect(shouldResumeFollow(true, true, false)).toBe(true);
  });

  it('别人/AI 的新消息 → 维持原状，不打断正在往上翻的人', () => {
    expect(shouldResumeFollow(true, false, false)).toBe(false);
    expect(shouldResumeFollow(true, false, true)).toBe(true);
  });

  it('⚠ 流式 token（条数没变）绝不改变跟随状态 —— 这正是当初的 bug', () => {
    expect(shouldResumeFollow(false, true, false)).toBe(false);
    expect(shouldResumeFollow(false, false, false)).toBe(false);
    expect(shouldResumeFollow(false, false, true)).toBe(true);
  });
});

describe('followBehavior', () => {
  it('整条新消息用 smooth', () => {
    expect(followBehavior(true)).toBe('smooth');
  });

  it('⚠ 流式 token 用 auto —— 每秒几十段 smooth 动画会互相排队', () => {
    expect(followBehavior(false)).toBe('auto');
  });
});

describe('完整场景串演', () => {
  it('读者往上翻 → 流式输出一路进来 → 全程不被拽回底部', () => {
    let follow = isAtBottom(el(2000, 300, 500)); // 往上翻了
    expect(follow).toBe(false);
    for (let i = 0; i < 50; i++) {
      follow = shouldResumeFollow(false, false, follow); // 50 个 token
    }
    expect(follow).toBe(false); // 一次都没被拽回去
  });

  it('读者往上翻 → 自己发一条 → 立刻回到跟随', () => {
    let follow = isAtBottom(el(2000, 300, 500));
    expect(follow).toBe(false);
    follow = shouldResumeFollow(true, true, follow);
    expect(follow).toBe(true);
    expect(followBehavior(true)).toBe('smooth');
  });

  it('读者停在底部 → 新消息进来 → 继续跟随', () => {
    let follow = isAtBottom(el(2000, 1500, 500));
    expect(follow).toBe(true);
    follow = shouldResumeFollow(true, false, follow);
    expect(follow).toBe(true);
  });
});
