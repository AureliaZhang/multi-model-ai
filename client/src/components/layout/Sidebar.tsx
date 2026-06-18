import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { MessageSquarePlus, Settings, Trash2, LogOut, Users, Shield, User, Brain } from 'lucide-react';

interface SidebarProps {
  isGuest?: boolean;
  onOpenSettings: () => void;
  onOpenUsers: () => void;
  onOpenMemory: () => void;
  onToggleSidebar: () => void;
  onLogout?: () => void;
}

export function Sidebar({ isGuest = false, onOpenSettings, onOpenUsers, onOpenMemory, onToggleSidebar: _onToggleSidebar, onLogout }: SidebarProps) {
  const conversations = useChatStore(s => s.conversations);
  const currentConversationId = useChatStore(s => s.currentConversationId);
  const selectConversation = useChatStore(s => s.selectConversation);
  const deleteConversation = useChatStore(s => s.deleteConversation);
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const logout = useAuthStore(s => s.logout);

  const handleNewChat = () => {
    useChatStore.setState({ currentConversationId: null, messages: [] });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      await deleteConversation(id);
    }
  };

  const handleLogout = () => {
    logout();
    onLogout?.();
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-sidebar-surface)]">
      {/* Header - New chat button */}
      <div className="p-2">
        <button
          onClick={handleNewChat}
          disabled={isGuest}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-primary)] text-sm w-full transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          title={isGuest ? 'Sign in to start chatting' : 'New chat'}
        >
          <MessageSquarePlus size={18} strokeWidth={1.5} />
          <span>New chat</span>
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-0.5">
        {isGuest ? (
          <div className="text-center text-[var(--color-text-tertiary)] text-[13px] py-8 px-4">
            <p className="mb-2">Sign in to start chatting</p>
            <p className="text-xs opacity-70">Guests can browse but cannot create conversations</p>
          </div>
        ) : (
          <>
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`group relative flex items-center px-3 py-2.5 rounded-lg cursor-pointer mb-0.5 transition-all duration-150 sidebar-item ${
                  currentConversationId === conv.id
                    ? 'bg-[var(--color-sidebar-surface-active)]'
                    : 'hover:bg-[var(--color-sidebar-surface-hover)]'
                }`}
              >
                <span className="truncate text-[13px] text-[var(--color-text-secondary)] flex-1 leading-5">
                  {conv.title}
                </span>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[rgba(255,255,255,0.08)] text-[var(--color-text-tertiary)] transition-all duration-150 ml-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {conversations.length === 0 && (
              <div className="text-center text-[var(--color-text-tertiary)] text-[13px] py-8">
                No conversations yet
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[var(--color-border-light)] space-y-0.5">
        {/* Memory Store */}
        {!isGuest && (
          <button
            onClick={onOpenMemory}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
          >
            <Brain size={16} strokeWidth={1.5} />
            <span>Memory Store</span>
          </button>
        )}

        {/* Admin: User Management */}
        {isAuthenticated && user?.role === 'admin' && (
          <button
            onClick={onOpenUsers}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
          >
            <Users size={16} strokeWidth={1.5} />
            <span>User Management</span>
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
        >
          <Settings size={16} strokeWidth={1.5} />
          <span>Settings & Stations</span>
        </button>

        {/* User info / Auth */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-[var(--color-accent-main)] flex items-center justify-center flex-shrink-0">
              {user.role === 'admin' ? (
                <Shield size={13} className="text-white" />
              ) : (
                <User size={13} className="text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-[var(--color-text-primary)] truncate leading-4">
                {user.displayName || user.username}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)]">
                {user.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-[var(--button-ghost-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-accent-main)] text-[13px] w-full transition-colors duration-150"
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span>Sign in / Register</span>
          </button>
        )}
      </div>
    </div>
  );
}
