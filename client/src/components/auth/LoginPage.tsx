import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { LogIn, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onSwitchToRegister: () => void;
  onGuestBrowse: () => void;
}

export function LoginPage({ onSwitchToRegister, onGuestBrowse }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore(s => s.login);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    await login(username.trim(), password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-main-surface-primary)]">
      <div className="w-full max-w-md px-6">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
            Multi-Model AI Platform
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Sign in to your account
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); clearError(); }}
              className="w-full px-4 py-2.5 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
              placeholder="Enter your username"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); clearError(); }}
                className="w-full px-4 py-2.5 pr-10 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
                placeholder="Enter your password"
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
            Sign In
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-[var(--color-text-tertiary)] text-sm">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-[var(--color-accent-main)] hover:underline"
            >
              Register
            </button>
          </p>
          <button
            onClick={onGuestBrowse}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] text-xs transition-colors"
          >
            Continue as guest (browse only)
          </button>
        </div>
      </div>
    </div>
  );
}
