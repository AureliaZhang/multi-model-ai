import { useRef, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { MessageSquarePlus, Settings, Trash2, LogOut, Users, Users2, Shield, User, Brain, Globe, Lock, Eye, EyeOff, FolderOpen, X, Swords, PanelLeftClose, ScrollText, Download, Upload } from 'lucide-react';
import { useTranslation } from '../../i18n';
import type { ConversationVisibility } from '../../types';

interface SidebarProps {
  isGuest?: boolean;
  onOpenSettings: () => void;
  onOpenUsers: () => void;
  onOpenUsage?: () => void;
  onOpenMemory: () => void;
  onOpenFiles: () => void;
  onOpenArena?: () => void;
  onOpenRooms?: () => void;
  onToggleSidebar: () => void;
  onLogout?: () => void;
}

export function Sidebar({ isGuest = false, onOpenSettings, onOpenUsers, onOpenUsage, onOpenMemory, onOpenFiles, onOpenArena, onOpenRooms, onToggleSidebar, onLogout }: SidebarProps) {
  const conversations = useChatStore(s => s.conversations);
  const currentConversationId = useChatStore(s => s.currentConversationId);
  const selectConversation = useChatStore(s => s.selectConversation);
  const deleteConversation = useChatStore(s => s.deleteConversation);
  const updateConversation = useChatStore(s => s.updateConversation);
  const currentVisibility = useChatStore(s => s.currentVisibility);
  const currentSelfReview = useChatStore(s => s.currentSelfReview);
  const setVisibility = useChatStore(s => s.setVisibility);
  const setSelfReview = useChatStore(s => s.setSelfReview);
  const exportConversations = useChatStore(s => s.exportConversations);
  const importConversations = useChatStore(s => s.importConversations);
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const logout = useAuthStore(s => s.logout);
  const { t } = useTranslation();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      await exportConversations();
    } catch (err) {
      console.error('[Sidebar] export failed:', err);
      alert(t('sidebar.exportFailed'));
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-selecting the same file fires change again
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const summary = await importConversations(data);
      alert(t('sidebar.importDone', { convs: summary.importedConversations, msgs: summary.importedMessages }));
    } catch (err) {
      console.error('[Sidebar] import failed:', err);
      alert(t('sidebar.importFailed'));
    }
  };

  const handleNewChat = () => {
    localStorage.removeItem('last_conversation_id');
    useChatStore.setState({ currentConversationId: null, messages: [] });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      await deleteConversation(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  };

  const handleToggleVisibility = (e: React.MouseEvent, convId: string, currentVis: ConversationVisibility) => {
    e.stopPropagation();
    const newVis: ConversationVisibility = currentVis === 'public' ? 'private' : 'public';
    updateConversation(convId, { visibility: newVis });
  };

  const handleToggleSelfReview = (e: React.MouseEvent, convId: string, current: boolean) => {
    e.stopPropagation();
    updateConversation(convId, { selfReview: !current });
  };

  const handleLogout = () => {
    logout();
    onLogout?.();
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-sidebar-surface)]">
      {/* Header - collapse + new chat */}
      <div className="p-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex-shrink-0 p-2 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          title={t('sidebar.collapseSidebar')}
          aria-label={t('sidebar.collapseSidebar')}
        >
          <PanelLeftClose size={18} strokeWidth={1.5} />
        </button>
        <button
          onClick={handleNewChat}
          disabled={isGuest}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-primary)] text-sm flex-1 min-w-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          title={isGuest ? t('sidebar.signInToChat') : t('sidebar.newChat')}
        >
          <MessageSquarePlus size={18} strokeWidth={1.5} />
          <span className="truncate">{t('sidebar.newChat')}</span>
        </button>
      </div>

      {/* New conversation options (visibility + self-review defaults) */}
      {!isGuest && isAuthenticated && (
        <div className="px-2 pb-1.5 flex items-center gap-1.5">
          <button
            onClick={() => setVisibility(currentVisibility === 'public' ? 'private' : 'public')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
              currentVisibility === 'private'
                ? 'bg-[rgba(16,163,127,0.15)] text-[var(--color-accent-main)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
            title={t('conversation.visibilityDesc')}
          >
            {currentVisibility === 'private' ? <Lock size={11} /> : <Globe size={11} />}
            <span>{currentVisibility === 'private' ? t('conversation.private') : t('conversation.public')}</span>
          </button>
          <button
            onClick={() => setSelfReview(!currentSelfReview)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
              currentSelfReview
                ? 'bg-[rgba(16,163,127,0.15)] text-[var(--color-accent-main)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
            title={t('conversation.selfReviewDesc')}
          >
            {currentSelfReview ? <Eye size={11} /> : <EyeOff size={11} />}
            <span>{t('conversation.selfReview')}</span>
          </button>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-0.5">
        {isGuest ? (
          <div className="text-center text-[var(--color-text-tertiary)] text-[13px] py-8 px-4">
            <p className="mb-2">{t('sidebar.signInToChat')}</p>
            <p className="text-xs opacity-70">{t('sidebar.guestCannotCreate')}</p>
          </div>
        ) : (
          <>
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                onMouseLeave={() => { if (deleteConfirmId === conv.id) setDeleteConfirmId(null); }}
                className={`group relative flex items-center px-3 py-2.5 rounded-lg cursor-pointer mb-0.5 transition-all duration-150 sidebar-item ${
                  currentConversationId === conv.id
                    ? 'bg-[var(--color-sidebar-surface-active)]'
                    : 'hover:bg-[var(--color-sidebar-surface-hover)]'
                }`}
              >
                {/* Visibility icon */}
                <span className="mr-1.5 flex-shrink-0" title={conv.visibility === 'private' ? t('conversation.private') : t('conversation.public')}>
                  {conv.visibility === 'private' ? (
                    <Lock size={12} className="text-[var(--color-text-tertiary)]" />
                  ) : (
                    <Globe size={12} className="text-[var(--color-text-tertiary)] opacity-50" />
                  )}
                </span>

                <span className="truncate text-[13px] text-[var(--color-text-secondary)] flex-1 leading-5">
                  {conv.title}
                </span>

                {/* Self-review indicator */}
                {conv.selfReview && (
                  <span className="mr-1 flex-shrink-0" title={t('conversation.selfReview')}>
                    <Eye size={11} className="text-[var(--color-accent-main)] opacity-60" />
                  </span>
                )}

                {/* Action buttons on hover */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all duration-150 ml-1">
                  <button
                    onClick={(e) => handleToggleVisibility(e, conv.id, conv.visibility)}
                    className="p-1 rounded-md hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)] transition-all duration-150"
                    title={conv.visibility === 'private' ? t('conversation.public') : t('conversation.private')}
                  >
                    {conv.visibility === 'private' ? <Globe size={13} /> : <Lock size={13} />}
                  </button>
                  <button
                    onClick={(e) => handleToggleSelfReview(e, conv.id, conv.selfReview)}
                    className="p-1 rounded-md hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)] transition-all duration-150"
                    title={t('conversation.toggleSelfReview')}
                  >
                    {conv.selfReview ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className={`p-1 rounded-md transition-all duration-150 ${
                      deleteConfirmId === conv.id
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)]'
                    }`}
                    title={deleteConfirmId === conv.id ? t('common.confirm') : t('sidebar.deleteChat')}
                  >
                    {deleteConfirmId === conv.id ? <X size={13} /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}

            {conversations.length === 0 && (
              <div className="text-center text-[var(--color-text-tertiary)] text-[13px] py-8">
                {t('sidebar.noConversations')}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[var(--color-border-light)] space-y-0.5">
        {!isGuest && (
          <>
            <button
              onClick={onOpenMemory}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
            >
              <Brain size={16} strokeWidth={1.5} />
              <span>{t('sidebar.memoryStore')}</span>
            </button>
            <button
              onClick={onOpenFiles}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
            >
              <FolderOpen size={16} strokeWidth={1.5} />
              <span>{t('sidebar.fileLibrary')}</span>
            </button>
            {onOpenRooms && (
              <button
                onClick={onOpenRooms}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
              >
                <Users2 size={16} strokeWidth={1.5} />
                <span>{t('sidebar.rooms')}</span>
              </button>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
            >
              <Download size={16} strokeWidth={1.5} />
              <span>{t('sidebar.exportChats')}</span>
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
            >
              <Upload size={16} strokeWidth={1.5} />
              <span>{t('sidebar.importChats')}</span>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
          </>
        )}

        {isAuthenticated && user?.role === 'admin' && (
          <button
            onClick={onOpenArena}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
          >
            <Swords size={16} strokeWidth={1.5} />
            <span>{t('sidebar.arena')}</span>
          </button>
        )}

        {isAuthenticated && user?.role === 'admin' && (
          <button
            onClick={onOpenUsers}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
          >
            <Users size={16} strokeWidth={1.5} />
            <span>{t('sidebar.userManagement')}</span>
          </button>
        )}

        {isAuthenticated && user?.role === 'admin' && onOpenUsage && (
          <button
            onClick={onOpenUsage}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
          >
            <ScrollText size={16} strokeWidth={1.5} />
            <span>{t('sidebar.usageLogs')}</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
        >
          <Settings size={16} strokeWidth={1.5} />
          <span>{t('sidebar.settingsStations')}</span>
        </button>

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
              title={t('sidebar.signOut')}
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
            <span>{t('sidebar.signInRegister')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
