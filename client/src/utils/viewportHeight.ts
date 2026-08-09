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
    // Pinch-zoom also shrinks visualViewport.height. Resizing the app shell for
    // it would fight the user mid-gesture, so only track the unzoomed height.
    if (vv.scale !== 1) return;
    document.documentElement.style.setProperty('--app-height', `${vv.height}px`);
  };

  apply();
  vv.addEventListener('resize', apply);
  return () => vv.removeEventListener('resize', apply);
}
