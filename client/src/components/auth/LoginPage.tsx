import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { LogIn, Eye, EyeOff, User, Phone, Shield, UserCircle, Compass } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { LanguageToggle } from '../layout/LanguageToggle';
import { ThemeToggle } from '../layout/ThemeToggle';

interface LoginPageProps {
  onSwitchToRegister: () => void;
  onGuestBrowse: () => void;
}

type LoginMode = 'select' | 'admin' | 'user';

export function LoginPage({ onSwitchToRegister, onGuestBrowse }: LoginPageProps) {
  const [mode, setMode] = useState<LoginMode>('select');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginField, setLoginField] = useState<'username' | 'phone'>('username');
  const [localError, setLocalError] = useState('');
  const login = useAuthStore(s => s.login);
  const serverError = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const { t } = useTranslation();

  const error = localError || serverError;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!password.trim()) {
      setLocalError(t('login.passwordRequired'));
      return;
    }

    // Admin login: username is always "admin"
    await login('admin', password, 'username');
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!username.trim() || !password.trim()) {
      setLocalError(t('login.allFieldsRequired'));
      return;
    }

    await login(username.trim(), password, loginField);
  };

  const resetToSelect = () => {
    setMode('select');
    setUsername('');
    setPassword('');
    setLocalError('');
    clearError();
  };

  // Mode selection screen
  if (mode === 'select') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-main-surface-primary)] relative">
        <ThemeToggle />
        <LanguageToggle />

        <div className="w-full max-w-md px-6">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
              {t('login.title')}
            </h1>
            <p className="text-[var(--color-text-secondary)] text-sm">
              {t('login.selectMode')}
            </p>
          </div>

          <div className="space-y-3">
            {/* Admin Login */}
            <button
              onClick={() => { setMode('admin'); setLocalError(''); clearError(); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-secondary)] hover:bg-[var(--color-sidebar-surface-hover)] hover:border-[var(--color-accent-main)] transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-[rgba(16,163,127,0.15)] flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(16,163,127,0.25)] transition-colors">
                <Shield size={20} className="text-[var(--color-accent-main)]" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t('login.adminLogin')}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                  {t('login.adminLoginDesc')}
                </div>
              </div>
            </button>

            {/* User Login */}
            <button
              onClick={() => { setMode('user'); setLocalError(''); clearError(); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-secondary)] hover:bg-[var(--color-sidebar-surface-hover)] hover:border-[var(--color-accent-main)] transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-[rgba(59,130,246,0.15)] flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(59,130,246,0.25)] transition-colors">
                <UserCircle size={20} className="text-[#3b82f6]" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t('login.userLogin')}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                  {t('login.userLoginDesc')}
                </div>
              </div>
            </button>

            {/* Guest Browse */}
            <button
              onClick={onGuestBrowse}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-secondary)] hover:bg-[var(--color-sidebar-surface-hover)] hover:border-[var(--color-accent-main)] transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-[rgba(168,85,247,0.15)] flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(168,85,247,0.25)] transition-colors">
                <Compass size={20} className="text-[#a855f7]" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t('login.guestMode')}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                  {t('login.guestModeDesc')}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin login screen
  if (mode === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-main-surface-primary)] relative">
        <ThemeToggle />
        <LanguageToggle />

        <div className="w-full max-w-md px-6">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-[rgba(16,163,127,0.15)] flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-[var(--color-accent-main)]" />
            </div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
              {t('login.adminLogin')}
            </h1>
            <p className="text-[var(--color-text-secondary)] text-sm">
              {t('login.adminLoginDesc')}
            </p>
          </div>

          <form onSubmit={handleAdminSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-sm">
                {error}
              </div>
            )}

            {/* Username display (read-only) */}
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                {t('login.username')}
              </label>
              <input
                type="text"
                value="admin"
                readOnly
                className="w-full px-4 py-2.5 bg-[var(--color-main-surface-secondary)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-tertiary)] outline-none text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                {t('login.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setLocalError(''); clearError(); }}
                  className="w-full px-4 py-2.5 pr-10 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
                  placeholder={t('login.passwordPlaceholder')}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full py-2.5 bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <LogIn size={16} />
              {t('login.signIn')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={resetToSelect}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] text-sm transition-colors"
            >
              ← {t('login.backToSelect')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User login screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-main-surface-primary)] relative">
        <ThemeToggle />
        <LanguageToggle />

      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[rgba(59,130,246,0.15)] flex items-center justify-center mx-auto mb-4">
            <UserCircle size={28} className="text-[#3b82f6]" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
            {t('login.userLogin')}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm">
            {t('login.userLoginDesc')}
          </p>
        </div>

        <form onSubmit={handleUserSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-sm">
              {error}
              {/* Show register prompt when account not found */}
              {error.includes('Invalid') && (
                <div className="mt-2 pt-2 border-t border-[var(--overlay-10)]">
                  <span className="text-[var(--color-text-secondary)]">{t('login.noAccount')} </span>
                  <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className="text-[var(--color-accent-main)] hover:underline font-medium"
                  >
                    {t('login.registerNow')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Login field toggle */}
          <div className="flex gap-2 mb-1">
            <button
              type="button"
              onClick={() => { setLoginField('username'); setLocalError(''); clearError(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                loginField === 'username'
                  ? 'bg-[var(--color-accent-main)] text-white'
                  : 'bg-[var(--color-main-surface-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <User size={12} />
              {t('login.usernameMode')}
            </button>
            <button
              type="button"
              onClick={() => { setLoginField('phone'); setLocalError(''); clearError(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                loginField === 'phone'
                  ? 'bg-[var(--color-accent-main)] text-white'
                  : 'bg-[var(--color-main-surface-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <Phone size={12} />
              {t('login.phoneMode')}
            </button>
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
              {loginField === 'username' ? t('login.username') : t('login.phone')}
            </label>
            <input
              type={loginField === 'phone' ? 'tel' : 'text'}
              value={username}
              onChange={e => { setUsername(e.target.value); setLocalError(''); clearError(); }}
              className="w-full px-4 py-2.5 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
              placeholder={loginField === 'username' ? t('login.usernamePlaceholder') : t('login.phonePlaceholder')}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
              {t('login.password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setLocalError(''); clearError(); }}
                className="w-full px-4 py-2.5 pr-10 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
                placeholder={t('login.passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!username.trim() || !password.trim()}
            className="w-full py-2.5 bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            {t('login.signIn')}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-[var(--color-text-tertiary)] text-sm">
            {t('login.noAccount')}{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-[var(--color-accent-main)] hover:underline"
            >
              {t('login.register')}
            </button>
          </p>
          <button
            onClick={resetToSelect}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] text-xs transition-colors"
          >
            ← {t('login.backToSelect')}
          </button>
        </div>
      </div>
    </div>
  );
}
