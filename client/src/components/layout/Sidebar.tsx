import { useRef, useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { MessageSquarePlus, Settings, Trash2, LogOut, Users, Users2, Shield, User, Brain, Globe, Lock, Eye, EyeOff, FolderOpen, X, Swords, PanelLeftClose, ScrollText, Download, Upload, Search, Pin, PinOff, FolderInput, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { conversationApi } from '../../services/api';
import type { ConversationVisibility, Conversation } from '../../types';

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
  /** Called after selecting/creating a conversation — lets the mobile drawer close itself. */
  onNavigate?: () => void;
}

export function Sidebar({ isGuest = false, onOpenSettings, onOpenUsers, onOpenUsage, onOpenMemory, onOpenFiles, onOpenArena, onOpenRooms, onToggleSidebar, onLogout, onNavigate }: SidebarProps) {
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
  const [showNewMenu, setShowNewMenu] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Chat organize (v0.7.47): folder-move dropdown + collapsed folder headers.
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Conversation search (title + message content, server-side). Debounced; when
  // the query is empty we fall back to the full conversation list.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Conversation[]>([]);
  const [searching, setSearching] = useState(false);
  const trimmedQuery = query.trim();

  useEffect(() => {
    // Empty query → displayList falls back to `conversations`; nothing to reset
    // (stale results/searching are ignored while trimmedQuery is empty).
    if (!trimmedQuery) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await conversationApi.search(trimmedQuery);
        if (!cancelled && res.success && res.data) setResults(res.data);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [trimmedQuery]);

  const displayList = trimmedQuery ? results : conversations;

  // a11y (v0.7.53): Escape closes whichever sidebar menu is open.
  useEffect(() => {
    if (!showNewMenu && folderMenuId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewMenu(false);
        setFolderMenuId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNewMenu, folderMenuId]);

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
      const atts = summary.importedAttachments ?? 0;
      alert(
        atts > 0
          ? t('sidebar.importDoneWithAtts', {
              convs: summary.importedConversations,
              msgs: summary.importedMessages,
              atts,
            })
          : t('sidebar.importDone', {
              convs: summary.importedConversations,
              msgs: summary.importedMessages,
            })
      );
    } catch (err) {
      console.error('[Sidebar] import failed:', err);
      alert(t('sidebar.importFailed'));
    }
  };

  const handleNewPrivateChat = () => {
    setShowNewMenu(false);
    localStorage.removeItem('last_conversation_id');
    useChatStore.setState({ currentConversationId: null, messages: [] });
    onNavigate?.();
  };

  const handleNewGroupChat = () => {
    setShowNewMenu(false);
    onOpenRooms?.();
    onNavigate?.();
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

  const handleTogglePin = (e: React.MouseEvent, convId: string, current: boolean) => {
    e.stopPropagation();
    updateConversation(convId, { pinned: !current });
  };

  const handleMoveToFolder = (convId: string, folder: string | null) => {
    setFolderMenuId(null);
    setNewFolderName('');
    updateConversation(convId, { folder });
  };

  const toggleFolderCollapsed = (name: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // Existing folder names (from all conversations), for the move-to menu.
  const folderNames = Array.from(
    new Set(conversations.map(c => c.folder).filter((f): f is string => !!f))
  ).sort((a, b) => a.localeCompare(b));

  // Grouped view (only when not searching): pinned → folders → the rest.
  const pinnedConvs = conversations.filter(c => c.pinned);
  const folderGroups = folderNames
    .map(name => ({ name, convs: conversations.filter(c => !c.pinned && c.folder === name) }))
    .filter(g => g.convs.length > 0);
  const looseConvs = conversations.filter(c => !c.pinned && !c.folder);

  const handleLogout = () => {
    logout();
    onLogout?.();
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-sidebar-surface)]">
      {/* Header - collapse + new chat (private / group) */}
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
        <div className="relative flex-1 min-w-0">
          <button
            onClick={() => {
              if (isGuest) return;
              setShowNewMenu((v) => !v);
            }}
            aria-haspopup="menu"
            aria-expanded={showNewMenu}
            disabled={isGuest}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-primary)] text-sm w-full min-w-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isGuest ? t('sidebar.signInToChat') : t('sidebar.newChat')}
          >
            <MessageSquarePlus size={18} strokeWidth={1.5} />
            <span className="truncate flex-1 text-left">{t('sidebar.newChat')}</span>
          </button>
          {showNewMenu && !isGuest && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)} aria-hidden />
              <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-secondary)] shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={handleNewPrivateChat}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-surface-hover)]"
                >
                  <MessageSquarePlus size={16} className="text-[var(--color-accent-main)]" />
                  <span>{t('sidebar.newPrivateChat')}</span>
                </button>
                {onOpenRooms && (
                  <button
                    type="button"
                    onClick={handleNewGroupChat}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-surface-hover)] border-t border-[var(--color-border-light)]"
                  >
                    <Users2 size={16} className="text-[var(--color-accent-main)]" />
                    <span>{t('sidebar.newGroupChat')}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
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

      {/* Conversation search */}
      {!isGuest && (
        <div className="px-2 pt-1 pb-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sidebar.searchPlaceholder')}
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-main)]"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                title={t('common.cancel')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)]"
              >
                <X size={13} />
              </button>
            )}
          </div>
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
            {(() => {
              const renderConv = (conv: Conversation) => (
                <div
                  key={conv.id}
                  onClick={() => { selectConversation(conv.id); onNavigate?.(); }}
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

                  {/* Pin indicator (visible without hover; redundant inside the pinned section but useful in search results) */}
                  {conv.pinned && (
                    <span className="mr-1 flex-shrink-0" title={t('sidebar.pin')}>
                      <Pin size={11} className="text-[var(--color-accent-main)] opacity-60" />
                    </span>
                  )}

                  {/* Self-review indicator */}
                  {conv.selfReview && (
                    <span className="mr-1 flex-shrink-0" title={t('conversation.selfReview')}>
                      <Eye size={11} className="text-[var(--color-accent-main)] opacity-60" />
                    </span>
                  )}

                  {/* Action buttons on hover */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all duration-150 ml-1">
                    <button
                      onClick={(e) => handleTogglePin(e, conv.id, conv.pinned)}
                      className="p-1 rounded-md hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)] transition-all duration-150"
                      title={conv.pinned ? t('sidebar.unpin') : t('sidebar.pin')}
                    >
                      {conv.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setNewFolderName(''); setFolderMenuId(folderMenuId === conv.id ? null : conv.id); }}
                      aria-haspopup="menu"
                      aria-expanded={folderMenuId === conv.id}
                      className="p-1 rounded-md hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)] transition-all duration-150"
                      title={t('sidebar.moveToFolder')}
                    >
                      <FolderInput size={13} />
                    </button>
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

                  {/* Move-to-folder dropdown */}
                  {folderMenuId === conv.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setFolderMenuId(null); }} aria-hidden />
                      <div
                        className="absolute right-2 top-full mt-0.5 z-50 w-48 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-secondary)] shadow-lg overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {conv.folder && (
                          <button
                            type="button"
                            onClick={() => handleMoveToFolder(conv.id, null)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-surface-hover)]"
                          >
                            <X size={12} className="text-[var(--color-text-tertiary)]" />
                            <span>{t('sidebar.removeFromFolder')}</span>
                          </button>
                        )}
                        {folderNames.filter(name => name !== conv.folder).map(name => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => handleMoveToFolder(conv.id, name)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-surface-hover)]"
                          >
                            <Folder size={12} className="text-[var(--color-text-tertiary)]" />
                            <span className="truncate">{name}</span>
                          </button>
                        ))}
                        <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[var(--color-border-light)]">
                          <input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newFolderName.trim()) handleMoveToFolder(conv.id, newFolderName.trim());
                              if (e.key === 'Escape') setFolderMenuId(null);
                            }}
                            placeholder={t('sidebar.newFolderPlaceholder')}
                            className="flex-1 min-w-0 px-2 py-1 rounded-md bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-main)]"
                          />
                          <button
                            type="button"
                            disabled={!newFolderName.trim()}
                            onClick={() => newFolderName.trim() && handleMoveToFolder(conv.id, newFolderName.trim())}
                            className="p-1 rounded-md hover:bg-[var(--overlay-8)] text-[var(--color-accent-main)] disabled:opacity-40"
                            title={t('sidebar.moveToFolder')}
                          >
                            <FolderInput size={13} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );

              if (trimmedQuery) {
                return displayList.map(renderConv);
              }
              return (
                <>
                  {pinnedConvs.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 pt-1 pb-0.5 text-[11px] text-[var(--color-text-tertiary)]">
                      <Pin size={10} />
                      <span>{t('sidebar.pinnedSection')}</span>
                    </div>
                  )}
                  {pinnedConvs.map(renderConv)}
                  {folderGroups.map(g => (
                    <div key={g.name}>
                      <button
                        type="button"
                        onClick={() => toggleFolderCollapsed(g.name)}
                        className="w-full flex items-center gap-1.5 px-3 pt-1 pb-0.5 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                      >
                        {collapsedFolders.has(g.name) ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                        <Folder size={10} />
                        <span className="truncate">{g.name}</span>
                        <span className="opacity-60">({g.convs.length})</span>
                      </button>
                      {!collapsedFolders.has(g.name) && g.convs.map(renderConv)}
                    </div>
                  ))}
                  {looseConvs.map(renderConv)}
                </>
              );
            })()}

            {displayList.length === 0 && (
              <div className="text-center text-[var(--color-text-tertiary)] text-[13px] py-8">
                {trimmedQuery
                  ? (searching ? t('sidebar.searching') : t('sidebar.noSearchResults'))
                  : t('sidebar.noConversations')}
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
            {/* Group chats: create only via “New chat → New group”; list still via openRooms when needed */}
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
          <span>{t('sidebar.settings')}</span>
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
