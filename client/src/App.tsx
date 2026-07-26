import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout'
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { useAuthStore } from './stores/authStore';

type AuthView = 'login' | 'register' | 'guest';

function App() {
  const initialize = useAuthStore(s => s.initialize);
  const isLoading = useAuthStore(s => s.isLoading);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  // An invite link (?invite=CODE) lands directly on the register view (v0.7.48).
  const [authView, setAuthView] = useState<AuthView>(
    () => new URLSearchParams(window.location.search).get('invite') ? 'register' : 'login'
  );
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Loading screen
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--color-main-surface-primary)]">
        <div className="text-[var(--color-text-tertiary)] text-sm">Loading...</div>
      </div>
    );
  }

  // Not authenticated and not guest - show auth pages
  if (!isAuthenticated && !isGuest) {
    if (authView === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return (
      <LoginPage
        onSwitchToRegister={() => setAuthView('register')}
        onGuestBrowse={() => setIsGuest(true)}
      />
    );
  }

  return (
    <div className="w-full h-full">
      <Layout isGuest={isGuest} onLogout={() => { setIsGuest(false); }} onSignIn={() => { setIsGuest(false); }} />
    </div>
  )
}

export default App
