import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { USER_PUBLIC_COLUMNS, rowToUserPublic, type UserPublicRowShape } from './userPublic';

/**
 * users → UserPublic 映射（v0.7.98，§10.11 ④）
 *
 * 原先这段映射在 routes/users.ts 里写了三遍，第二份（`GET /:id`）
 * 既没 SELECT `monthly_token_limit` 也没映射它，配额会静默变成「不限制」。
 * 这组测试同时锁两件事：映射本身的归一化规则，以及**列清单真的能查出所有字段**
 * —— 后者才是当初抄漏的那一层。
 */

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS);
  return db;
}

describe('rowToUserPublic', () => {
  const base: UserPublicRowShape = {
    id: 'u1', username: 'alice', email: 'a@x.com', phone: null,
    displayName: '爱丽丝', role: 'user', isActive: 1,
    lastLogin: '2026-08-01T00:00:00Z', createdAt: '2026-07-01T00:00:00Z',
    monthlyTokenLimit: 50000,
  };

  it('原样带出基本字段', () => {
    const out = rowToUserPublic(base);
    expect(out.id).toBe('u1');
    expect(out.username).toBe('alice');
    expect(out.displayName).toBe('爱丽丝');
    expect(out.monthlyTokenLimit).toBe(50000);
  });

  it('isActive 从 0/1 归一成布尔（不能把数字透给客户端）', () => {
    expect(rowToUserPublic({ ...base, isActive: 1 }).isActive).toBe(true);
    expect(rowToUserPublic({ ...base, isActive: 0 }).isActive).toBe(false);
  });

  it('⚠ monthlyTokenLimit 缺失时归 0，绝不返回 undefined', () => {
    expect(rowToUserPublic({ ...base, monthlyTokenLimit: null }).monthlyTokenLimit).toBe(0);
    expect(rowToUserPublic({ ...base, monthlyTokenLimit: undefined }).monthlyTokenLimit).toBe(0);
    const { monthlyTokenLimit: _omit, ...without } = base;
    expect(rowToUserPublic(without as UserPublicRowShape).monthlyTokenLimit).toBe(0);
  });

  it('0 表示不限额，要原样保留而不是被当成缺失', () => {
    expect(rowToUserPublic({ ...base, monthlyTokenLimit: 0 }).monthlyTokenLimit).toBe(0);
  });

  it('不泄露 password_hash 之类的字段（只映射白名单）', () => {
    const withSecret = { ...base, password_hash: '$2b$10$xxxx', must_change_password: 1 };
    const out = rowToUserPublic(withSecret as UserPublicRowShape);
    expect(Object.keys(out)).not.toContain('password_hash');
    expect(JSON.stringify(out)).not.toContain('$2b$');
  });
});

describe('USER_PUBLIC_COLUMNS（真库查询）', () => {
  it('⚠ 列清单能查出全部字段 —— 当初抄漏的就是这一层', () => {
    const db = freshDb();
    db.prepare(
      `INSERT INTO users (id, username, password_hash, email, display_name, role, is_active, monthly_token_limit, created_at, updated_at)
       VALUES ('u1','alice','$2b$10$fake','a@x.com','爱丽丝','user',1,123456, datetime('now'), datetime('now'))`
    ).run();

    const row = db.prepare(`SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`).get('u1') as UserPublicRowShape;
    const out = rowToUserPublic(row);

    expect(out.username).toBe('alice');
    expect(out.displayName).toBe('爱丽丝');
    expect(out.isActive).toBe(true);
    // 这一条是本次修复的核心：三个接口都必须带出配额
    expect(out.monthlyTokenLimit).toBe(123456);
    db.close();
  });

  it('未设配额的用户查出来是 0（默认值），不是 undefined', () => {
    const db = freshDb();
    db.prepare(
      `INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
       VALUES ('u2','bob','$2b$10$fake','user', datetime('now'), datetime('now'))`
    ).run();
    const row = db.prepare(`SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`).get('u2') as UserPublicRowShape;
    expect(rowToUserPublic(row).monthlyTokenLimit).toBe(0);
    db.close();
  });
});
