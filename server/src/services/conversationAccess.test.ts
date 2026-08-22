import { describe, it, expect } from 'vitest';
import { canReadConversation, canModifyConversation } from './conversationAccess';

/**
 * 会话访问规则（v0.7.98 安全修复）
 *
 * 这组测试锁住的是 2026-08-21 实测复现的那个漏洞：
 *   管理员删掉一个成员 → FK ON DELETE SET NULL → 该成员会话 user_id 变 NULL
 *   → 旧规则把「无主」当作「所有人可读可改」→ 未登录也能读私密内容、能 truncate 清空
 *
 * 核心不变量：**user_id 为 null 时，除管理员外一律拒绝**。
 */

const admin = { id: 'a1', role: 'admin' };
const alice = { id: 'u1', role: 'user' };
const bob = { id: 'u2', role: 'user' };

const owned = (visibility = 'private') => ({ user_id: 'u1', visibility });
const orphan = (visibility = 'private') => ({ user_id: null, visibility });

describe('canReadConversation', () => {
  it('管理员什么都能读', () => {
    expect(canReadConversation(admin, owned())).toBe(true);
    expect(canReadConversation(admin, orphan())).toBe(true);
  });

  it('本人能读自己的私密会话', () => {
    expect(canReadConversation(alice, owned('private'))).toBe(true);
  });

  it('别人读不到他人的私密会话', () => {
    expect(canReadConversation(bob, owned('private'))).toBe(false);
    expect(canReadConversation(null, owned('private'))).toBe(false);
  });

  it('公开会话谁都能读（含未登录）', () => {
    expect(canReadConversation(bob, owned('public'))).toBe(true);
    expect(canReadConversation(null, owned('public'))).toBe(true);
  });

  // ── 漏洞本体 ──
  it('🔴 无主会话：未登录读不到（原先返回 200 并泄露私密内容）', () => {
    expect(canReadConversation(null, orphan('private'))).toBe(false);
  });

  it('🔴 无主会话：其他已登录成员也读不到', () => {
    expect(canReadConversation(bob, orphan('private'))).toBe(false);
    expect(canReadConversation(alice, orphan('private'))).toBe(false);
  });

  it('🔴 无主会话即使标着 public 也不放行 —— 那个值是被孤儿化之前留下的，不代表所有者意愿', () => {
    expect(canReadConversation(null, orphan('public'))).toBe(false);
    expect(canReadConversation(bob, orphan('public'))).toBe(false);
    expect(canReadConversation(admin, orphan('public'))).toBe(true);
  });
});

describe('canModifyConversation', () => {
  it('管理员能改任何会话', () => {
    expect(canModifyConversation(admin, owned())).toBe(true);
    expect(canModifyConversation(admin, orphan())).toBe(true);
  });

  it('本人能改自己的', () => {
    expect(canModifyConversation(alice, owned())).toBe(true);
  });

  it('别人不能改', () => {
    expect(canModifyConversation(bob, owned())).toBe(false);
    expect(canModifyConversation(null, owned())).toBe(false);
  });

  it('公开只意味着可读，不意味着可改', () => {
    expect(canReadConversation(bob, owned('public'))).toBe(true);
    expect(canModifyConversation(bob, owned('public'))).toBe(false);
  });

  // ── 漏洞本体 ──
  it('🔴 无主会话：未登录不能截断（原先 truncate 返回 200 并把消息删光）', () => {
    expect(canModifyConversation(null, orphan())).toBe(false);
    expect(canModifyConversation(bob, orphan())).toBe(false);
  });
});

describe('不变量：无主会话对非管理员一律关闭', () => {
  it('穷举所有 user × visibility 组合', () => {
    const users = [null, undefined, alice, bob];
    const visibilities = ['private', 'public', undefined, ''];
    for (const u of users) {
      for (const v of visibilities) {
        const conv = { user_id: null, visibility: v };
        expect(canReadConversation(u, conv), `read ${u?.id ?? 'guest'}/${v}`).toBe(false);
        expect(canModifyConversation(u, conv), `modify ${u?.id ?? 'guest'}/${v}`).toBe(false);
      }
    }
    // 管理员始终例外
    for (const v of visibilities) {
      expect(canReadConversation(admin, { user_id: null, visibility: v })).toBe(true);
      expect(canModifyConversation(admin, { user_id: null, visibility: v })).toBe(true);
    }
  });
});
