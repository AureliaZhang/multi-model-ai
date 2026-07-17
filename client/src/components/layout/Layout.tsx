import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { SettingsPage } from '../settings/SettingsPage';
import { UserManagement } from '../admin/UserManagement';
import { UsageLogsPage } from '../admin/UsageLogsPage';
import { MemoryBrowser } from '../memory/MemoryBrowser';
import { FileBrowser } from '../files/FileBrowser';
import { ArenaLayout } from '../arena/ArenaLayout';
import { RoomsPage } from '../rooms/RoomsPage';
import { GuideOverlay } from '../guide/GuideOverlay';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
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

type PageView = 'chat' | 'settings' | 'users' | 'memory' | 'files' | 'arena' | 'usage' | 'rooms';

export function Layout({ isGuest = false, onLogout, onSignIn }: LayoutProps) {
  const [page, setPage] = useState<PageView>('chat');
  // Desktop opens the sidebar inline by default; mobile (<768px) starts closed
  // so the chat area isn't crushed — the sidebar becomes a slide-in drawer there.
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  );
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
      <ThemeToggle />
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

  if (page === 'rooms') {
    return withLang(<RoomsPage onClose={() => setPage('chat')} />);
  }

  // On mobile the sidebar is an overlay drawer, so selecting a destination
  // should close it; on desktop it stays pinned open.
  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
  };
  const goToPage = (p: PageView) => {
    setPage(p);
    closeSidebarOnMobile();
  };

  return withLang(
    <div className="flex h-full w-full overflow-hidden">
      {/* Mobile backdrop — tap to dismiss the drawer (hidden on md+) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: inline column on desktop, fixed slide-in drawer on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-40 w-[280px] max-w-[85vw] md:static md:z-auto md:w-[260px] md:max-w-none flex-shrink-0 border-r border-[var(--color-border-light)] fade-in md:animate-none">
          <Sidebar
            isGuest={isGuest}
            onOpenSettings={() => goToPage('settings')}
            onOpenUsers={() => goToPage('users')}
            onOpenUsage={() => goToPage('usage')}
            onOpenMemory={() => goToPage('memory')}
            onOpenFiles={() => goToPage('files')}
            onOpenArena={() => goToPage('arena')}
            onOpenRooms={() => goToPage('rooms')}
            onToggleSidebar={() => setSidebarOpen(false)}
            onLogout={onLogout}
            onNavigate={closeSidebarOnMobile}
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
