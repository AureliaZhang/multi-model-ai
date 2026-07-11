import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { SettingsPage } from '../settings/SettingsPage';
import { UserManagement } from '../admin/UserManagement';
import { UsageLogsPage } from '../admin/UsageLogsPage';
import { MemoryBrowser } from '../memory/MemoryBrowser';
import { FileBrowser } from '../files/FileBrowser';
import { ArenaLayout } from '../arena/ArenaLayout';
import { GuideOverlay } from '../guide/GuideOverlay';
import { LanguageToggle } from './LanguageToggle';
import { DailyModelModal } from '../prefs/DailyModelModal';
import { ImageConfirmModal } from '../prefs/ImageConfirmModal';
import { useModelStore } from '../../stores/modelStore';
import { useChatStore } from '../../stores/chatStore';
import { usePrefsStore } from '../../stores/prefsStore';
import { useTranslation } from '../../i18n';
import { CircleHelp } from 'lucide-react';

interface LayoutProps {
  isGuest?: boolean;
  onLogout?: () => void;
  onSignIn?: () => void;
}

type PageView = 'chat' | 'settings' | 'users' | 'memory' | 'files' | 'arena' | 'usage';

export function Layout({ isGuest = false, onLogout, onSignIn }: LayoutProps) {
  const [page, setPage] = useState<PageView>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const fetchModels = useModelStore(s => s.fetchModels);
  const fetchConversations = useChatStore(s => s.fetchConversations);
  const fetchPrefs = usePrefsStore(s => s.fetchPrefs);
  const { t } = useTranslation();

  useEffect(() => {
    fetchModels();
    if (!isGuest) {
      fetchConversations();
      fetchPrefs();
    }
    // Auto-show guide for newly registered users
    if (localStorage.getItem('showGuide') === 'true') {
      localStorage.removeItem('showGuide');
      setShowGuide(true);
    }
  }, [fetchModels, fetchConversations, fetchPrefs, isGuest]);

  const withLang = (node: ReactNode) => (
    <>
      <LanguageToggle />
      {!isGuest && <DailyModelModal />}
      {!isGuest && <ImageConfirmModal />}
      {node}
    </>
  );

  if (page === 'settings') {
    return withLang(<SettingsPage onClose={() => setPage('chat')} />);
  }

  if (page === 'users') {
    return withLang(<UserManagement onBack={() => setPage('chat')} />);
  }

  if (page === 'usage') {
    return withLang(<UsageLogsPage onBack={() => setPage('chat')} />);
  }

  if (page === 'memory') {
    return withLang(<MemoryBrowser onClose={() => setPage('chat')} />);
  }

  if (page === 'files') {
    return withLang(<FileBrowser onClose={() => setPage('chat')} />);
  }

  if (page === 'arena') {
    return withLang(<ArenaLayout onClose={() => setPage('chat')} />);
  }

  return withLang(
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-[260px] flex-shrink-0 border-r border-[var(--color-border-light)]">
          <Sidebar
            isGuest={isGuest}
            onOpenSettings={() => setPage('settings')}
            onOpenUsers={() => setPage('users')}
            onOpenUsage={() => setPage('usage')}
            onOpenMemory={() => setPage('memory')}
            onOpenFiles={() => setPage('files')}
            onOpenArena={() => setPage('arena')}
            onToggleSidebar={() => setSidebarOpen(false)}
            onLogout={onLogout}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <ChatArea
          isGuest={isGuest}
          onSignIn={onSignIn}
          sidebarCollapsed={!sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

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
