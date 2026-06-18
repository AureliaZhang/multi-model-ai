import { useState, useEffect } from 'react';
import type { UserPublic, UserRole } from '../../types';
import { userApi } from '../../services/auth';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../i18n';
import { ArrowLeft, Shield, ShieldOff, Trash2, UserCheck, UserX, Users } from 'lucide-react';

interface UserManagementProps {
  onBack: () => void;
}

export function UserManagement({ onBack }: UserManagementProps) {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleActive = async (user: UserPublic) => {
    if (user.id === currentUser?.id) return;
    try {
      const res = await userApi.update(user.id, { isActive: !user.isActive });
      if (res.success) {
        fetchUsers();
      } else {
        setError(res.error || 'Failed to update user');
      }
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
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
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-[var(--color-text-error)] hover:opacity-70">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-tertiary)]">{t('users.loading')}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-tertiary)]">{t('users.noUsers')}</div>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_100px_100px_120px] gap-4 px-4 py-2 text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">
              <span>{t('users.user')}</span>
              <span>{t('users.email')}</span>
              <span>{t('users.role')}</span>
              <span>{t('users.status')}</span>
              <span className="text-right">{t('users.actions')}</span>
            </div>

            {users.map(user => (
              <div
                key={user.id}
                className="grid grid-cols-[1fr_1fr_100px_100px_120px] gap-4 items-center px-4 py-3 rounded-lg bg-[var(--color-main-surface-secondary)] hover:bg-[var(--color-main-surface-tertiary)] transition-colors"
              >
                {/* User info */}
                <div>
                  <div className="text-sm font-medium">{user.displayName || user.username}</div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">@{user.username}</div>
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
        )}
      </div>
    </div>
  );
}
