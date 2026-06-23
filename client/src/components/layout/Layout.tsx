import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { SettingsPage } from '../settings/SettingsPage';
import { UserManagement } from '../admin/UserManagement';
import { MemoryBrowser } from '../memory/MemoryBrowser';
import { FileBrowser } from '../files/FileBrowser';
import { GuideOverlay } from '../guide/GuideOverlay';
import { useModelStore } from '../../stores/modelStore';
import { useChatStore } from '../../stores/chatStore';
import { useTranslation } from '../../i18n';
import { PanelLeft, CircleHelp } from 'lucide-react';

interface LayoutProps {
  isGuest?: boolean;
  onLogout?: () => void;
  onSignIn?: () => void;
}

type PageView = 'chat' | 'settings' | 'users' | 'memory' | 'files';

export function Layout({ isGuest = false, onLogout, onSignIn }: LayoutProps) {
  const [page, setPage] = useState<PageView>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const fetchModels = useModelStore(s => s.fetchModels);
  const fetchConversations = useChatStore(s => s.fetchConversations);
  const { t } = useTranslation();

  useEffect(() => {
    fetchModels();
    if (!isGuest) {
      fetchConversations();
    }
    // Auto-show guide for newly registered users
    if (localStorage.getItem('showGuide') === 'true') {
      localStorage.removeItem('showGuide');
      setShowGuide(true);
    }
  }, [fetchModels, fetchConversations, isGuest]);

  if (page === 'settings') {
    return <SettingsPage onClose={() => setPage('chat')} />;
  }

  if (page === 'users') {
    return <UserManagement onBack={() => setPage('chat')} />;
  }

  if (page === 'memory') {
    return <MemoryBrowser onClose={() => setPage('chat')} />;
  }

  if (page === 'files') {
    return <FileBrowser onClose={() => setPage('chat')} />;
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-[260px] flex-shrink-0 border-r border-[var(--color-border-light)]">
          <Sidebar
            isGuest={isGuest}
            onOpenSettings={() => setPage('settings')}
            onOpenUsers={() => setPage('users')}
            onOpenMemory={() => setPage('memory')}
            onOpenFiles={() => setPage('files')}
            onToggleSidebar={() => setSidebarOpen(false)}
            onLogout={onLogout}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-2.5 left-3 z-10 p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] transition-colors"
            title={t('layout.openSidebar')}
          >
            <PanelLeft size={20} strokeWidth={1.5} />
          </button>
        )}
        <ChatArea isGuest={isGuest} onSignIn={onSignIn} />

        {/* Persistent help/guide icon */}
        <button
          onClick={() => setShowGuide(true)}
          className="fixed bottom-4 right-4 z-20 w-9 h-9 rounded-full bg-[var(--color-accent-main)] hover:opacity-90 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
          title={t('guide.helpTooltip')}
        >
          <CircleHelp size={18} />
        </button>
      </div>

      {/* Onboarding Guide Overlay */}
      {showGuide && <GuideOverlay onClose={() => setShowGuide(false)} />}
    </div>
  );
}
