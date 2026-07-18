import { useState, useEffect } from 'react';
import type { UserPublic, UserRole, CreateUserRequest } from '../../types';
import { userApi } from '../../services/auth';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../i18n';
import { ArrowLeft, Shield, ShieldOff, Trash2, UserCheck, UserX, Users, UserPlus, X, Eye, EyeOff } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

interface UserManagementProps {
  onBack: () => void;
}

export function UserManagement({ onBack }: UserManagementProps) {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createData, setCreateData] = useState<CreateUserRequest>({ username: '', password: '' });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const currentUser = useAuthStore(s => s.user);
  const { t } = useTranslation();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.list();
      if (res.success && res.data) {
        setUsers(res.data);
      } else {
        setError(res.error || 'Failed to fetch users');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!createData.username.trim() || !createData.password) {
      setCreateError(t('users.createRequired'));
      return;
    }
    if (createData.username.trim().length < 3 || createData.username.trim().length > 30) {
      setCreateError(t('users.createUsernameLength'));
      return;
    }
    if (createData.password.length < 6) {
      setCreateError(t('users.createPasswordLength'));
      return;
    }
    setCreateLoading(true);
    try {
      const res = await userApi.create({
        ...createData,
        username: createData.username.trim(),
        email: createData.email?.trim() || undefined,
        phone: createData.phone?.trim() || undefined,
        displayName: createData.displayName?.trim() || undefined,
      });
      if (res.success) {
        setShowCreateForm(false);
        setCreateData({ username: '', password: '' });
        fetchUsers();
      } else {
        setCreateError(res.error || t('users.createFailed'));
      }
    } catch (err: unknown) {
      setCreateError(getErrorMessage(err));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleActive = async (user: UserPublic) => {
    if (user.id === currentUser?.id) return;
    try {
      const res = await userApi.update(user.id, { isActive: !user.isActive });
      if (res.success) {
        fetchUsers();
      } else {
        setError(res.error || 'Failed to update user');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const handleChangeRole = async (user: UserPublic, role: UserRole) => {
    if (user.id === currentUser?.id) return;
    try {
      const res = await userApi.update(user.id, { role });
      if (res.success) {
        fetchUsers();
      } else {
        setError(res.error || 'Failed to update user');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async (user: UserPublic) => {
    if (user.id === currentUser?.id) return;
    if (!confirm(t('users.deleteConfirm', { username: user.username }))) return;
    try {
      const res = await userApi.delete(user.id);
      if (res.success) {
        fetchUsers();
      } else {
        setError(res.error || 'Failed to delete user');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-main-surface-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border-light)] px-6 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[var(--button-ghost-hover)] text-[var(--color-text-secondary)] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Users size={20} className="text-[var(--color-accent-main)]" />
          <h1 className="text-lg font-semibold">{t('users.title')}</h1>
        </div>
        <span className="text-[var(--color-text-tertiary)] text-sm ml-auto">
          {t('users.count', { count: users.length, s: users.length !== 1 ? 's' : '' })}
        </span>
        <button
          onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(''); }}
          className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white text-sm transition-colors"
        >
          <UserPlus size={14} />
          {t('users.createUser')}
        </button>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-[var(--color-text-error)] hover:opacity-70">✕</button>
          </div>
        )}

        {/* Create User Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateUser} className="mb-6 p-4 rounded-xl bg-[var(--color-main-surface-secondary)] border border-[var(--color-border-light)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('users.createUserTitle')}</h3>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setCreateError(''); }}
                className="p-1 rounded-md hover:bg-[var(--button-ghost-hover)] text-[var(--color-text-tertiary)]"
              >
                <X size={16} />
              </button>
            </div>

            {createError && (
              <div className="mb-3 p-2 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-xs">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">{t('users.createUsername')} *</label>
                <input
                  type="text"
                  value={createData.username}
                  onChange={e => setCreateData(d => ({ ...d, username: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-main)]"
                  placeholder={t('users.createUsernamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">{t('users.createPassword')} *</label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createData.password}
                    onChange={e => setCreateData(d => ({ ...d, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-9 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-main)]"
                    placeholder={t('users.createPasswordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                  >
                    {showCreatePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">{t('users.createPhone')}</label>
                <input
                  type="tel"
                  value={createData.phone || ''}
                  onChange={e => setCreateData(d => ({ ...d, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-main)]"
                  placeholder={t('users.createPhonePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">{t('users.createEmail')}</label>
                <input
                  type="email"
                  value={createData.email || ''}
                  onChange={e => setCreateData(d => ({ ...d, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-main)]"
                  placeholder={t('users.createEmailPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">{t('users.createDisplayName')}</label>
                <input
                  type="text"
                  value={createData.displayName || ''}
                  onChange={e => setCreateData(d => ({ ...d, displayName: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-main)]"
                  placeholder={t('users.createDisplayNamePlaceholder')}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="block text-xs text-[var(--color-text-tertiary)]">{t('users.createRole')}</label>
              <select
                value={createData.role || 'user'}
                onChange={e => setCreateData(d => ({ ...d, role: e.target.value as UserRole }))}
                className="px-3 py-1.5 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-main)]"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <button
                type="submit"
                disabled={createLoading}
                className="ml-auto px-4 py-1.5 bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
              >
                {createLoading ? t('common.loading') : t('users.createUserSubmit')}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-tertiary)]">{t('users.loading')}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-tertiary)]">{t('users.noUsers')}</div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className="rounded-lg bg-[var(--color-main-surface-secondary)] border border-[var(--color-border-light)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{user.displayName || user.username}</div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">@{user.username}</div>
                      <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          user.role === 'admin'
                            ? 'bg-[var(--color-surface-warning)] text-[var(--color-text-warning)]'
                            : 'bg-[var(--color-main-surface-tertiary)] text-[var(--color-text-secondary)]'
                        }`}>
                          {user.role === 'admin' ? <Shield size={10} /> : null}
                          {user.role}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          user.isActive
                            ? 'bg-[var(--color-surface-success)] text-[var(--color-text-success)]'
                            : 'bg-[var(--color-surface-error)] text-[var(--color-text-error)]'
                        }`}>
                          {user.isActive ? t('users.active') : t('users.disabled')}
                        </span>
                      </div>
                      {(user.phone || user.email) && (
                        <div className="text-xs text-[var(--color-text-secondary)] mt-1.5 space-y-0.5">
                          {user.phone && <div>{user.phone}</div>}
                          {user.email && <div className="truncate">{user.email}</div>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {user.id !== currentUser?.id ? (
                        <>
                          <button
                            onClick={() => handleToggleActive(user)}
                            className="p-1.5 rounded-md hover:bg-[var(--button-ghost-hover)] text-[var(--color-text-tertiary)]"
                            title={user.isActive ? t('users.disableUser') : t('users.enableUser')}
                          >
                            {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          <button
                            onClick={() => handleChangeRole(user, user.role === 'admin' ? 'user' : 'admin')}
                            className="p-1.5 rounded-md hover:bg-[var(--button-ghost-hover)] text-[var(--color-text-tertiary)]"
                            title={user.role === 'admin' ? t('users.demoteToUser') : t('users.promoteToAdmin')}
                          >
                            {user.role === 'admin' ? <ShieldOff size={14} /> : <Shield size={14} />}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1.5 rounded-md hover:bg-[var(--color-surface-error)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-error)]"
                            title={t('users.deleteUser')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-[var(--color-text-tertiary)] italic">{t('users.you')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block space-y-2 overflow-x-auto">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_1fr_100px_100px_120px] gap-4 px-4 py-2 text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider min-w-[680px]">
              <span>{t('users.user')}</span>
              <span>{t('users.phone')}</span>
              <span>{t('users.email')}</span>
              <span>{t('users.role')}</span>
              <span>{t('users.status')}</span>
              <span className="text-right">{t('users.actions')}</span>
            </div>

            {users.map(user => (
              <div
                key={user.id}
                className="grid grid-cols-[1fr_120px_1fr_100px_100px_120px] gap-4 items-center px-4 py-3 rounded-lg bg-[var(--color-main-surface-secondary)] hover:bg-[var(--color-main-surface-tertiary)] transition-colors min-w-[680px]"
              >
                {/* User info */}
                <div>
                  <div className="text-sm font-medium">{user.displayName || user.username}</div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">@{user.username}</div>
                </div>

                {/* Phone */}
                <div className="text-sm text-[var(--color-text-secondary)] truncate">
                  {user.phone || '—'}
                </div>

                {/* Email */}
                <div className="text-sm text-[var(--color-text-secondary)] truncate">
                  {user.email || '—'}
                </div>

                {/* Role */}
                <div>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    user.role === 'admin'
                      ? 'bg-[var(--color-surface-warning)] text-[var(--color-text-warning)]'
                      : 'bg-[var(--color-main-surface-tertiary)] text-[var(--color-text-secondary)]'
                  }`}>
                    {user.role === 'admin' ? <Shield size={10} /> : null}
                    {user.role}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    user.isActive
                      ? 'bg-[var(--color-surface-success)] text-[var(--color-text-success)]'
                      : 'bg-[var(--color-surface-error)] text-[var(--color-text-error)]'
                  }`}>
                    {user.isActive ? t('users.active') : t('users.disabled')}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  {user.id !== currentUser?.id && (
                    <>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className="p-1.5 rounded-md hover:bg-[var(--button-ghost-hover)] text-[var(--color-text-tertiary)] transition-colors"
                        title={user.isActive ? t('users.disableUser') : t('users.enableUser')}
                      >
                        {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button
                        onClick={() => handleChangeRole(user, user.role === 'admin' ? 'user' : 'admin')}
                        className="p-1.5 rounded-md hover:bg-[var(--button-ghost-hover)] text-[var(--color-text-tertiary)] transition-colors"
                        title={user.role === 'admin' ? t('users.demoteToUser') : t('users.promoteToAdmin')}
                      >
                        {user.role === 'admin' ? <ShieldOff size={14} /> : <Shield size={14} />}
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 rounded-md hover:bg-[var(--color-surface-error)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-error)] transition-colors"
                        title={t('users.deleteUser')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  {user.id === currentUser?.id && (
                    <span className="text-xs text-[var(--color-text-tertiary)] italic">{t('users.you')}</span>
                  )}
                </div>
              </div>
            ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
