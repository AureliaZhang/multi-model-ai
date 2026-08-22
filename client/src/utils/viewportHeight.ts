/**
 * Publishes the real usable viewport height as the `--app-height` CSS variable.
 *
 * Why this exists: the app shell is `height: 100%` / `100dvh` with
 * `overflow: hidden` on `html, body, #root`. On iOS Safari the software keyboard
 * shrinks only the VISUAL viewport — the layout viewport and `100dvh` are left
 * untouched — so the bottom of the shell (the composer) ended up underneath the
 * keyboard with no way to scroll to it. `visualViewport.height` is the one value
 * that reflects what the user can actually see, so we mirror it into a custom
 * property that the root rule in `index.css` consumes.
 *
 * No-ops where `visualViewport` is unavailable; the `@supports (height: 100dvh)`
 * rule then keeps its own `100dvh` default, and older browsers keep `height: 100%`.
 */
export function trackViewportHeight(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};

  const apply = () => {
    // Pinch-zoom also shrinks visualViewport.height, and resizing the app shell
    // mid-gesture would fight the user — but *skipping* the write leaves the
    // last value frozen in place, which is worse. On iOS a zoom is not always
    // deliberate (focusing a control under 16px triggers one) and never undoes
    // itself, so the shell could stay stuck at the keyboard-open height long
    // after the keyboard was dismissed: composer marooned two thirds up the
    // screen, blank below, until a reload. Dropping the property instead hands
    // the rule back to its 100dvh fallback, which is never stale. v0.7.95 also
    // removes the usual cause by raising touch control fonts to 16px.
    if (vv.scale !== 1) {
      document.documentElement.style.removeProperty('--app-height');
      return;
    }
    document.documentElement.style.setProperty('--app-height', `${vv.height}px`);
  };

  /**
   * 每帧最多写一次（v0.7.99）。
   *
   * owner 真机反馈：iOS 输入法弹出时输入框「向上会卡一下」。原因是输入法
   * 弹出是一段动画，这期间 `visualViewport` 会连续触发 resize，而每次回调
   * 都直接写一遍 `--app-height` —— 同一帧内多次改样式就是重排抖动的经典成因。
   * 用 rAF 把一帧内的多次 resize 合并成一次写入；中间那些注定要被覆盖的
   * 高度值根本不落到样式上。
   *
   * 没有 rAF 的环境（很老的浏览器）直接同步执行，行为退回改造前。
   */
  let frame = 0;
  const raf = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame : null;
  const schedule = raf
    ? () => {
        if (frame) return; // 本帧已排过，丢掉重复的 resize
        frame = raf(() => {
          frame = 0;
          apply();
        });
      }
    : apply;

  // 首次同步写入：等一帧会让首屏闪一下。
  apply();
  vv.addEventListener('resize', schedule);
  return () => {
    vv.removeEventListener('resize', schedule);
    if (frame && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame);
  };
}
