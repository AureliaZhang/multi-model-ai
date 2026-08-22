/**
 * 「贴底跟随」判定 —— 从组件里抽出来的纯函数（v0.7.98，§10.11 ①②）
 *
 * 为什么要抽出来：这段逻辑原先内联在 `ChatArea` 的 effect 里，没法单独测，
 * 而它恰好制造过一个 owner 真机报到的 bug —— 「AI 输出的时候没办法滑动屏幕」
 * （v0.7.97 修）。同样的写法在 `GroupChatLayout` 里还有两份。
 *
 * 抽成纯函数之后：两个组件共用同一套规则，规则本身被单元测试锁住。
 */

/**
 * 判定「停在底部」时留的余量。
 * 容器停在底部时经常差零点几像素（子像素布局），手机的弹性回弹也落不准，
 * 所以不能用 `=== 0`。
 */
export const BOTTOM_SLACK_PX = 40;

/** 可滚动容器里我们关心的三个量（方便测试时构造） */
export interface ScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

/** 视图当前是否停在底部。 */
export function isAtBottom(el: ScrollMetrics, slack: number = BOTTOM_SLACK_PX): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < slack;
}

/**
 * 新内容到达时，是否应该（重新）进入跟随状态。
 *
 * 规则：自己刚发出的消息一定要跟随 —— 你自己在底部添了东西，
 * 视图却停在上面，会让人以为没发出去。除此之外维持原状态：
 * 读者往上翻了就不该被拽回来。
 */
export function shouldResumeFollow(grew: boolean, lastIsMine: boolean, current: boolean): boolean {
  if (grew && lastIsMine) return true;
  return current;
}

/**
 * 跟随时用哪种滚动方式。
 *
 * 整条新消息用 `smooth` 好看；但流式 token 每秒来几十个，
 * 每个都起一段平滑动画会互相排队，视图就变成在跟滚轮较劲而不是忽略它。
 * 所以 token 级更新用 `auto` 瞬时到位。
 */
export function followBehavior(grew: boolean): ScrollBehavior {
  return grew ? 'smooth' : 'auto';
}
