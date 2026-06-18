import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

export function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const register = useAuthStore(s => s.register);
  const serverError = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!username.trim() || !password.trim()) {
      setLocalError('Username and password are required');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    await register(username.trim(), password, email.trim() || undefined, displayName.trim() || undefined);
  };

  const error = localError || serverError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-main-surface-primary)]">
      <div className="w-full max-w-md px-6">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
            Create Account
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Register for a new account
          </p>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
              Username <span className="text-[var(--color-text-error)]">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setLocalError(''); clearError(); }}
              className="w-full px-4 py-2.5 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
              placeholder="Choose a username (3-30 characters)"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
              placeholder="Your display name (optional)"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
              placeholder="your@email.com (optional)"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
              Password <span className="text-[var(--color-text-error)]">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setLocalError(''); clearError(); }}
                className="w-full px-4 py-2.5 pr-10 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
                placeholder="At least 6 characters"
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

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
              Confirm Password <span className="text-[var(--color-text-error)]">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setLocalError(''); }}
              className="w-full px-4 py-2.5 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm"
              placeholder="Repeat your password"
            />
          </div>

          <button
            type="submit"
            disabled={!username.trim() || !password.trim() || !confirmPassword.trim()}
            className="w-full py-2.5 bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus size={16} />
            Create Account
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[var(--color-text-tertiary)] text-sm">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-[var(--color-accent-main)] hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
