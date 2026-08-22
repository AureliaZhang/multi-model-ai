/**
 * 会话访问规则 —— 唯一的一份（v0.7.98，§10.11 ③④ + 安全修复）
 *
 * 起因：同一条归属权判断原先在三个地方各写一份，且语义不一致 ——
 *
 *   routes/conversations.ts:92   canModifyConv  无主会话 → 仅管理员
 *   routes/conversations.ts:285  内联           无主会话 → 所有人（含未登录）
 *   routes/chat.ts:173           内联           无主会话 → 所有人（含未登录）
 *
 * 而「无主会话」并不是一个罕见的历史遗留：`conversations.user_id` 是后加的列、
 * 没有回填，并且外键是 `ON DELETE SET NULL`（`foreign_keys` 在 database.ts 里是开的）。
 * 于是**管理员在用户管理里删掉一个成员，该成员的全部会话当场变成无主**，
 * 随后任何人（未登录也行）都能读到、并且能调 truncate ��消息删光。
 * 2026-08-21 在本地演示实例上实测复现：删用户前未登录读是 404，删完变 200，
 * 私密内容完整可读，truncate 也返回 200 且消息被清空。
 *
 * 现在的规则：**无主 = 仅管理员**，读和写都一样。
 * 这样处理不销毁任何数据，只是把孤儿会话收回到管理员范围内，
 * 由人来决定它们该归谁 / 该不该删。
 *
 * 访客不受影响：界面上访客本来就建不了会话（Sidebar 的 `disabled={isGuest}`），
 * 列表接口也只给访客返回 `visibility = 'public'` 的行。
 */

/** 判定所需的最小会话形状（方便单测构造，也避免把整个 Row 类型拖进来） */
export interface ConvAccessRow {
  user_id: string | null;
  visibility?: string;
}

/** 判定所需的最小用户形状 */
export interface ConvAccessUser {
  id: string;
  role: string;
}

const isAdmin = (u?: ConvAccessUser | null): boolean => u?.role === 'admin';
const isOwner = (u: ConvAccessUser | null | undefined, conv: ConvAccessRow): boolean =>
  !!u && conv.user_id != null && conv.user_id === u.id;

/**
 * 能否读取该会话。
 * 管理员恒可；本人可；公开会话任何人可；**无主会话仅管理员**。
 */
export function canReadConversation(user: ConvAccessUser | null | undefined, conv: ConvAccessRow): boolean {
  if (isAdmin(user)) return true;
  if (isOwner(user, conv)) return true;
  // 无主会话不因为「碰巧是 public」而放行：孤儿行的 visibility 是它被孤儿化
  // 之前留下的值，不代表所有者的意愿。
  if (conv.user_id == null) return false;
  return conv.visibility === 'public';
}

/**
 * 能否修改该会话（改名 / 删除 / 截断 / 往里发消息）。
 * 管理员恒可；本人可；其余一律否 —— 公开只意味着可读，不意味着可改。
 */
export function canModifyConversation(user: ConvAccessUser | null | undefined, conv: ConvAccessRow): boolean {
  if (isAdmin(user)) return true;
  return isOwner(user, conv);
}
