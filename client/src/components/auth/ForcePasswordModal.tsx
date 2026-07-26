import { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../services/auth';
import { useTranslation } from '../../i18n';

/**
 * Forced password change (v0.7.59, §10.9 P0 #2). Shown when the logged-in
 * account carries `mustChangePassword` (e.g. the seeded admin still on the
 * default password). Deliberately NOT dismissable — no backdrop click, no
 * close button; the only way forward is a successful change.
 */
export function ForcePasswordModal() {
  const user = useAuthStore(s => s.user);
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < 6) { setError(t('auth.pwdTooShort')); return; }
    if (next !== confirm) { setError(t('auth.pwdMismatch')); return; }
    setBusy(true);
    try {
      const res = await authApi.changePassword(current, next);
      if (res.success) {
        // Clear the flag locally — the server already cleared it in the DB.
        const u = useAuthStore.getState().user;
        if (u) useAuthStore.setState({ user: { ...u, mustChangePassword: false } });
      } else {
        setError(res.error || t('auth.pwdChangeFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-accent-main)] transition-colors text-sm";

  return (
    <div role="dialog" aria-modal="true" aria-label={t('auth.pwdChangeTitle')} className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] p-6 shadow-xl">
        <div className="flex items-center gap-2.5 mb-2">
          <KeyRound size={18} className="text-[var(--color-accent-main)]" />
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('auth.pwdChangeTitle')}</h2>
        </div>
        <p className="text-[12px] text-[var(--color-text-tertiary)] mb-4 leading-relaxed">
          {t('auth.pwdChangeDesc', { name: user?.username || '' })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-xs">{error}</div>
          )}
          <input
            type={show ? 'text' : 'password'}
            value={current}
            onChange={e => { setCurrent(e.target.value); setError(''); }}
            placeholder={t('auth.currentPwd')}
            className={inputCls}
            autoFocus
          />
          <input
            type={show ? 'text' : 'password'}
            value={next}
            onChange={e => { setNext(e.target.value); setError(''); }}
            placeholder={t('auth.newPwd')}
            className={inputCls}
          />
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError(''); }}
            placeholder={t('auth.confirmPwd')}
            className={inputCls}
          />
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
              {show ? t('auth.hidePwd') : t('auth.showPwd')}
            </button>
            <button
              type="submit"
              disabled={busy || !current || !next || !confirm}
              className="px-4 py-2 rounded-xl bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white text-sm disabled:opacity-50 transition-colors"
            >
              {busy ? t('common.loading') : t('auth.pwdChangeSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
