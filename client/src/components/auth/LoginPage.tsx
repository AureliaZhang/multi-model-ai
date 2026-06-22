import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { LogIn, Eye, EyeOff, Globe, User, Phone } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface LoginPageProps {
  onSwitchToRegister: () => void;
  onGuestBrowse: () => void;
}

export function LoginPage({ onSwitchToRegister, onGuestBrowse }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'username' | 'phone'>('username');
  const login = useAuthStore(s => s.login);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const { t, locale, setLocale } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    await login(username.trim(), password, loginMode);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-main-surface-primary)] relative">
      {/* Language toggle - top right */}
      <button
        onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors text-sm"
        title={locale === 'en' ? '切换到中文' : 'Switch to English'}
      >
        <Globe size={16} />
        <span>{locale === 'en' ? '中文' : 'EN'}</span>
      </button>

      <div className="w-full max-w-md px-6">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
            {t('login.title')}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm">
            {t('login.subtitle')}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-sm">
              {error}
            </div>
          )}

          {/* Login mode toggle */}
          <div className="flex gap-2 mb-1">
            <button
              type="button"
              onClick={() => { setLoginMode('username'); clearError(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                loginMode === 'username'
                  ? 'bg-[var(--color-accent-main)] text-white'
                  : 'bg-[var(--color-main-surface-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <User size={12} />
              {t('login.usernameMode')}
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('phone'); clearError(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                loginMode === 'phone'
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
              {loginMode === 'username' ? t('login.username') : t('login.phone')}
            </label>
            <input
              type={loginMode === 'phone' ? 'tel' : 'text'}
              value={username}
              onChange={e => { setUsername(e.target.value); clearError(); }}
              className="w-full px-4 py-2.5 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
              placeholder={loginMode === 'username' ? t('login.usernamePlaceholder') : t('login.phonePlaceholder')}
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
                onChange={e => { setPassword(e.target.value); clearError(); }}
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
            onClick={onGuestBrowse}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] text-xs transition-colors"
          >
            {t('login.guest')}
          </button>
        </div>
      </div>
    </div>
  );
}
