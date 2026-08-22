/**
 * users 表 → `UserPublic` 的唯一一份映射（v0.7.98，§10.11 ④）
 *
 * 为什么单独抽出来：这段映射原先在 `routes/users.ts` 里写了三遍
 * （列表 116 行、单个 239 行、更新后回显 324 行），而且**已经抄漏了** ——
 * `GET /api/users/:id` 既没 SELECT `monthly_token_limit`，映射里也没这个字段。
 *
 * 漏了不会报错：客户端类型把它标成可选（`monthlyTokenLimit?: number`），
 * `UserManagement.tsx` 又写 `user.monthlyTokenLimit ?? 0`，
 * 于是配额会静默显示成 0（= 不限制）。目前客户端只调 list/update、
 * 从不调 `GET /:id`，所以是个埋着的坑而不是活的 bug；抽出来之后
 * 这个坑就不可能再被踩到 —— SQL 和映射都只有一份。
 */

/** 三处查询共用的列清单（含 as 别名，直接拼进 SELECT）。 */
export const USER_PUBLIC_COLUMNS = `
  id, username, email, phone, display_name as displayName, role,
  is_active as isActive, last_login as lastLogin,
  created_at as createdAt, updated_at as updatedAt,
  monthly_token_limit as monthlyTokenLimit
`;

/** `USER_PUBLIC_COLUMNS` 查出来的行形状。 */
export interface UserPublicRowShape {
  id: string;
  username: string;
  email: string | null;
  phone?: string | null;
  displayName: string | null;
  role: string;
  isActive: number | boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt?: string;
  monthlyTokenLimit?: number | null;
}

/** 映射结果的形状（与 types.ts / client 的 `UserPublic` 对齐）。 */
export interface UserPublicShape {
  id: string;
  username: string;
  email: string | null;
  phone?: string | null;
  displayName: string | null;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  monthlyTokenLimit: number;
}

/**
 * 行 → 对外的用户对象。
 *
 * 两处刻意的归一化：
 *  - `isActive` 一律转成布尔（SQLite 存的是 0/1，直接透出去客户端会拿到数字）
 *  - `monthlyTokenLimit` 的 null/undefined 一律归 0，0 在业务上表示「不限额」
 */
export function rowToUserPublic(row: UserPublicRowShape): UserPublicShape {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    phone: row.phone,
    displayName: row.displayName,
    role: row.role,
    isActive: Boolean(row.isActive),
    lastLogin: row.lastLogin,
    createdAt: row.createdAt,
    monthlyTokenLimit: row.monthlyTokenLimit ?? 0,
  };
}
