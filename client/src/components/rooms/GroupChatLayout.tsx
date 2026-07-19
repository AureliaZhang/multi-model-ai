import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';
import { usePrefsStore } from '../../stores/prefsStore';
import { usersApi } from '../../services/api';
import { useTranslation } from '../../i18n';
import { normalizeMarkdown } from '../../utils/markdown';
import {
  exportRepliesAsPdf,
  downloadBlob,
  exportFilename,
  type ExportableReply,
} from '../../utils/exportAiReplies';
import { roomApi } from '../../services/api';
import type { UserPublic, RoomFile } from '../../types';
import {
  Send, Bot, Sparkles, Users2, Settings2, Trash2, UserPlus, X,
  ChevronLeft, Loader2, Clock, FileText, MessageSquare, AtSign, AlertCircle,
  Download, ChevronDown, FileText as FileDoc,
} from 'lucide-react';
import { NotepadBar } from './NotepadBar';

/**
 * §10.6 Group room — single unified timeline + one composer.
 *
 * The backend still keeps two tracks (human `messages` + shared-AI `aiMessages`,
 * and the AI never reads the human track). The UI merges them into one
 * chronological view; a small toggle above the single input switches the
 * composer between "群聊" (human message) and "@AI" (prompt the group AI).
 * Choosing @AI takes the shared input lock; sending calls the AI and streams
 * the reply to every member.
 *
 * <!-- superseded: the earlier left/right two-pane layout (§10.6.10) is replaced
 * by this single-timeline + toggle composer. Backend two-track + privacy
 * invariants are unchanged. -->
 */
interface GroupChatLayoutProps {
  roomId: string;
  /** Mobile only: return to the room list (list/detail nav). Hidden on desktop. */
  onBack?: () => void;
}

const CLAIM_POLL_MS = 1000;

export function GroupChatLayout({ roomId, onBack }: GroupChatLayoutProps) {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);

  const currentRoom = useRoomStore((s) => s.currentRoom);
  const messages = useRoomStore((s) => s.messages);
  const aiMessages = useRoomStore((s) => s.aiMessages);
  const files = useRoomStore((s) => s.files);
  const openRoom = useRoomStore((s) => s.openRoom);
  const closeRoom = useRoomStore((s) => s.closeRoom);
  const sendMessage = useRoomStore((s) => s.sendMessage);
  const claim = useRoomStore((s) => s.claim);
  const renew = useRoomStore((s) => s.renew);
  const release = useRoomStore((s) => s.release);
  const ask = useRoomStore((s) => s.ask);
  const asking = useRoomStore((s) => s.asking);
  const error = useRoomStore((s) => s.error);
  const clearError = useRoomStore((s) => s.clearError);

  const [showManage, setShowManage] = useState(false);
  const [showModels, setShowModels] = useState(false);

  // export (column c): dropdown open + in-flight guard
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);

  // composer
  const [mode, setMode] = useState<'chat' | 'ai'>('chat');
  const [text, setText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openRoom(roomId);
    return () => closeRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Pane b (human chat) shows everything on the human track, including the
  // `ai_stub` "X → AI: …" delivery rows so the group sees who asked the AI.
  const humanItems = messages;

  // While the AI reply is being produced on the right (pane c), show a
  // transient "generating on the right" notice in pane b. It is derived
  // purely from the AI track status, so it disappears automatically once the
  // assistant message flips to done/error.
  const aiGenerating = useMemo(
    () => aiMessages.some((m) => m.role === 'assistant' && (m.status === 'thinking' || m.status === 'streaming')),
    [aiMessages],
  );

  // Export: only finished assistant replies with real content (column-c parity).
  // NOTE: must stay above the early `return` below — hooks cannot be called conditionally.
  const exportableReplies: ExportableReply[] = useMemo(
    () =>
      aiMessages
        .filter((m) => m.role === 'assistant' && m.status === 'done' && m.content.trim())
        .map((m) => ({ content: m.content, modelUsed: m.modelUsed, createdAt: m.createdAt })),
    [aiMessages],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [humanItems.length, aiGenerating]);

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages.length, asking]);

  const iHoldLock = currentRoom?.aiState === 'occupying_input' && currentRoom?.occupantUserId === me?.id;
  const someoneElseHolds = currentRoom?.aiState === 'occupying_input' && currentRoom?.occupantUserId !== me?.id;
  const aiRunning = currentRoom?.aiState === 'ai_running' || asking;

  // Countdown while I hold the @AI lock; auto-release + revert to chat on expiry.
  useEffect(() => {
    if (!iHoldLock || !currentRoom?.occupancyUntil) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const ms = new Date(currentRoom.occupancyUntil!).getTime() - Date.now();
      const secs = Math.max(0, Math.ceil(ms / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        void release();
        setMode('chat');
      }
    };
    tick();
    const id = setInterval(tick, CLAIM_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iHoldLock, currentRoom?.occupancyUntil]);

  if (!currentRoom) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-tertiary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> {t('common.loading')}
      </div>
    );
  }

  const isOwner = currentRoom.ownerId === me?.id;
  const hasChatModel = Boolean(currentRoom.chatModel);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Switch the composer to @AI: needs a chat model + the shared input lock.
  const switchToAi = async () => {
    clearError();
    if (aiRunning) return;
    if (!hasChatModel) {
      setShowModels(true);
      return;
    }
    if (iHoldLock) {
      setMode('ai');
      return;
    }
    const ok = await claim();
    if (ok) setMode('ai');
    // failure reason is surfaced via the store `error` banner
  };

  const switchToChat = async () => {
    setMode('chat');
    clearError();
    if (iHoldLock) await release();
  };

  const submit = async () => {
    const v = text.trim();
    if (!v) return;
    if (mode === 'ai') {
      if (!hasChatModel) {
        setShowModels(true);
        return;
      }
      setText('');
      const fids = [...selectedFiles];
      setSelectedFiles([]);
      await ask(v, fids.length ? fids : undefined);
      // Server returns to idle after the reply; go back to plain chat mode.
      setMode('chat');
    } else {
      setText('');
      await sendMessage(v);
    }
  };

  const toggleFile = (id: string) => {
    setSelectedFiles((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length > 1) alert(t('room.multiFileWarn'));
      return next;
    });
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    setShowExport(false);
    if (exportableReplies.length === 0) {
      alert(t('room.exportEmpty'));
      return;
    }
    const roomName = currentRoom?.name || 'group';
    try {
      setExporting(true);
      if (format === 'pdf') {
        exportRepliesAsPdf(exportableReplies, roomName);
      } else {
        const blob = await roomApi.exportDocx(
          currentRoom!.id,
          exportableReplies.map((r) => r.content),
          roomName,
        );
        downloadBlob(blob, exportFilename(roomName, 'docx'));
      }
    } catch (err) {
      console.error('[room] export failed:', err);
      alert(t('room.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const composerLocked = mode === 'chat' && (aiRunning || someoneElseHolds);

  return (
    <div className="h-full flex flex-col bg-[var(--color-main-surface-primary)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border-light)]">
        {onBack && (
          <button
            className="md:hidden flex-shrink-0 -ml-1 p-1.5 rounded-lg hover:bg-[var(--overlay-6)] text-[var(--color-text-secondary)]"
            onClick={onBack}
            title={t('common.back')}
            aria-label={t('common.back')}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <Users2 size={16} className="text-[var(--color-accent-main)]" />
        <span className="text-[14px] font-medium text-[var(--color-text-primary)] truncate">{currentRoom.name}</span>
        <span className="text-[11px] text-[var(--color-text-tertiary)]">
          {currentRoom.memberCount ?? currentRoom.members?.length ?? ''} {t('room.members')}
        </span>
        <div className="flex-1" />
        <button
          className="p-1.5 rounded-lg hover:bg-[var(--overlay-6)] text-[var(--color-text-secondary)]"
          onClick={() => setShowModels(true)}
          title={t('room.modelSettings')}
        >
          <Settings2 size={16} />
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-[var(--overlay-6)] text-[var(--color-text-secondary)]"
          onClick={() => setShowManage(true)}
          title={t('room.manage')}
        >
          <Users2 size={16} />
        </button>
      </div>

      {/* Two columns: b = human chat + composer (left), c = AI replies (right).
          The AI never reads the human track; @AI replies live only in column c.
          The "X → AI:" delivery rows stay in column b (rendered as ai_stub) so
          the group sees who asked; column c holds only the assistant answers. */}
      <div className="flex-1 min-h-0 flex">
        {/* Column b — human chat + composer */}
        <div className="flex flex-col min-w-0 flex-1 border-r border-[var(--color-border-light)]">
          <div className="px-4 py-2 border-b border-[var(--color-border-light)] flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
            <Users2 size={12} /> {t('room.paneChat')}
          </div>
          <NotepadBar />

          {/* messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {humanItems.length === 0 && !aiGenerating && (
              <div className="flex flex-col items-center justify-center h-full text-center text-[var(--color-text-tertiary)]">
                <MessageSquare size={20} className="mb-2 opacity-40" />
                <p className="text-[13px]">{t('room.noMessages')}</p>
              </div>
            )}
            {humanItems.map((m) => {
              // ai_stub: "X → AI: …" delivery notice (centered pill)
              if (m.kind === 'ai_stub') {
                return (
                  <div key={m.id} className="flex justify-center">
                    <div className="text-[11px] text-[var(--color-text-tertiary)] bg-[rgba(16,163,127,0.08)] rounded-full px-3 py-1 flex items-center gap-1 max-w-[90%]">
                      <AtSign size={11} className="text-[var(--color-accent-main)] flex-shrink-0" />
                      <span className="truncate">
                        {m.username || t('room.someone')} → AI: {m.content}
                      </span>
                    </div>
                  </div>
                );
              }
              const mine = m.userId && m.userId === me?.id;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && (
                    <span className="text-[10px] text-[var(--color-text-tertiary)] mb-0.5 px-1">
                      {m.displayName || m.username || t('room.someone')}
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] whitespace-pre-wrap break-words ${
                      mine
                        ? 'bg-[var(--color-accent-main)] text-white'
                        : 'bg-[var(--color-main-surface-tertiary)] text-[var(--color-text-primary)]'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}

            {/* transient "AI is replying on the right" notice — disappears once
                the assistant message on the right flips to done/error */}
            {aiGenerating && (
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-[#ab68ff]">
                  <Bot size={13} className="text-white" />
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-tertiary)]">
                  <Loader2 size={13} className="animate-spin text-[#ab68ff]" />
                  <span>{t('room.replyGenerating')}</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer (column b only) */}
          <div className="border-t border-[var(--color-border-light)] p-2.5">
            {/* error banner */}
            {error && (
              <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-[12px] flex items-center gap-1.5">
                <AlertCircle size={13} className="flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={clearError} className="hover:opacity-70"><X size={13} /></button>
              </div>
            )}

            {/* mode toggle + status */}
            <div className="flex items-center gap-2 mb-2">
              <div className="inline-flex rounded-lg border border-[var(--color-border-light)] overflow-hidden text-[12px]">
                <button
                  onClick={switchToChat}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                    mode === 'chat'
                      ? 'bg-[var(--color-accent-main)] text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--overlay-6)]'
                  }`}
                >
                  <MessageSquare size={12} /> {t('room.modeChat')}
                </button>
                <button
                  onClick={switchToAi}
                  disabled={aiRunning || someoneElseHolds}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors disabled:opacity-40 ${
                    mode === 'ai'
                      ? 'bg-[var(--color-accent-main)] text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--overlay-6)]'
                  }`}
                >
                  <Bot size={12} /> {t('room.modeAi')}
                </button>
              </div>

              {/* status line */}
              {aiRunning ? (
                <span className="flex items-center gap-1 text-[11px] text-[var(--color-accent-main)]">
                  <Loader2 size={11} className="animate-spin" /> {t('room.aiRunning')}
                </span>
              ) : someoneElseHolds ? (
                <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]">
                  <Clock size={11} /> {t('room.someoneTyping', { name: '' })}
                </span>
              ) : mode === 'ai' && iHoldLock ? (
                <span className="flex items-center gap-1 text-[11px] text-[var(--color-accent-main)]">
                  <Clock size={11} /> {t('room.youHold')} {remaining > 0 ? `(${fmt(remaining)})` : ''}
                  <button onClick={renew} className="ml-1 underline hover:opacity-80">{t('room.yesNeed')}</button>
                </span>
              ) : mode === 'ai' && !hasChatModel ? (
                <button onClick={() => setShowModels(true)} className="flex items-center gap-1 text-[11px] text-amber-400 hover:opacity-80">
                  <AlertCircle size={11} /> {t('room.needChatModel')}
                </button>
              ) : (
                <span className="text-[11px] text-[var(--color-text-tertiary)]">
                  {mode === 'ai' ? t('room.atAiHint') : t('room.chatHint')}
                </span>
              )}
            </div>

            {/* KB file strip — only when composing @AI */}
            {mode === 'ai' && iHoldLock && files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {files.map((f: RoomFile) => (
                  <button
                    key={f.id}
                    onClick={() => toggleFile(f.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${
                      selectedFiles.includes(f.id)
                        ? 'border-[var(--color-accent-main)] bg-[rgba(16,163,127,0.12)] text-[var(--color-accent-main)]'
                        : 'border-[var(--color-border-light)] text-[var(--color-text-tertiary)]'
                    }`}
                    title={f.originalName}
                  >
                    <FileText size={11} /> <span className="max-w-[100px] truncate">{f.originalName}</span>
                  </button>
                ))}
              </div>
            )}

            {/* single input */}
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                disabled={composerLocked}
                placeholder={
                  composerLocked
                    ? t('room.composerLocked')
                    : mode === 'ai'
                      ? t('room.aiPlaceholder')
                      : t('room.humanPlaceholder')
                }
                className={`flex-1 resize-none bg-[var(--composer-bg)] rounded-xl px-3 py-2 text-[13px] outline-none max-h-40 disabled:opacity-50 border ${
                  mode === 'ai' ? 'border-[var(--color-accent-main)]' : 'border-[var(--color-border-light)]'
                }`}
              />
              <button
                onClick={submit}
                disabled={!text.trim() || composerLocked || (mode === 'ai' && asking)}
                className="p-2 rounded-xl bg-[var(--color-accent-main)] text-white disabled:opacity-40"
                title={mode === 'ai' ? t('room.modeAi') : t('room.modeChat')}
              >
                {mode === 'ai' && asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Column c — AI replies (assistant answers only) */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="px-4 py-2 border-b border-[var(--color-border-light)] flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
            <Bot size={12} className="text-[#ab68ff]" /> {t('room.paneAi')}
            <div className="flex-1" />
            {/* Export AI replies (docx / pdf) */}
            <div className="relative">
              <button
                onClick={() => setShowExport((v) => !v)}
                disabled={exporting}
                className="flex items-center gap-1 px-2 py-1 rounded-md normal-case tracking-normal text-[var(--color-text-tertiary)] hover:bg-[var(--overlay-6)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                title={t('room.export')}
              >
                {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                <span className="text-[11px]">{exporting ? t('room.exporting') : t('room.export')}</span>
                <ChevronDown size={11} />
              </button>
              {showExport && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-main-surface-secondary)] shadow-lg py-1 normal-case tracking-normal">
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--overlay-6)] text-left"
                    >
                      <FileText size={13} /> {t('room.exportPdf')}
                    </button>
                    <button
                      onClick={() => handleExport('docx')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--overlay-6)] text-left"
                    >
                      <FileDoc size={13} /> {t('room.exportDocx')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiMessages.filter((m) => m.role === 'assistant').length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-[var(--color-text-tertiary)]">
                <Sparkles size={22} className="mb-2 text-[var(--color-accent-main)]" />
                <p className="text-[13px]">{t('room.aiEmpty')}</p>
              </div>
            )}
            {aiMessages.filter((m) => m.role === 'assistant').map((m) => (
              <div key={m.id} className="flex gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-[#ab68ff]">
                  <Bot size={13} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[var(--color-text-tertiary)] mb-0.5">
                    AI{m.modelUsed ? ` · ${m.modelUsed}` : ''}
                  </div>
                  {m.status === 'thinking' || m.status === 'streaming' ? (
                    // First pass is produced in the background; we do NOT show the
                    // raw markdown while it streams. Once status flips to `done`
                    // we render the calibrated, formatted answer below.
                    <div className="text-[13px] text-[var(--color-text-tertiary)] flex items-center gap-2">
                      <span className="typing-dots" aria-hidden="true"><span /><span /><span /></span>
                      <span>{t('room.formatting')}</span>
                    </div>
                  ) : m.status === 'error' ? (
                    <div className="text-[13px] text-red-400">{m.errorMessage || t('room.aiError')}</div>
                  ) : (
                    <div className="markdown-content text-[13.5px] leading-6 text-[var(--color-text-primary)]">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children, ...props }) => (
                            <div className="table-wrapper"><table {...props}>{children}</table></div>
                          ),
                        }}
                      >
                        {normalizeMarkdown(m.content)}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={aiEndRef} />
          </div>
        </div>
      </div>

      {showManage && <ManageModal isOwner={isOwner} onClose={() => setShowManage(false)} />}
      {showModels && <ModelsModal onClose={() => setShowModels(false)} />}
    </div>
  );
}

// ---------------- Manage members modal ----------------

function ManageModal({ isOwner, onClose }: { isOwner: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const invite = useRoomStore((s) => s.invite);
  const kick = useRoomStore((s) => s.kick);
  const disband = useRoomStore((s) => s.disband);
  const [allUsers, setAllUsers] = useState<UserPublic[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    usersApi.listBasic().then((r) => {
      if (r.success && r.data) setAllUsers(r.data);
    });
  }, []);

  const memberIds = new Set((currentRoom?.members || []).map((m) => m.userId));
  const invitable = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--color-main-surface-secondary)] rounded-2xl w-full max-w-md p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-medium text-[var(--color-text-primary)]">{t('room.manage')}</h3>
          <button onClick={onClose}><X size={18} className="text-[var(--color-text-tertiary)]" /></button>
        </div>

        <div className="text-[12px] text-[var(--color-text-tertiary)] mb-1">{t('room.members')}</div>
        <div className="space-y-1 mb-4">
          {(currentRoom?.members || []).map((m) => (
            <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--color-main-surface-tertiary)]">
              <span className="text-[13px] text-[var(--color-text-primary)] flex-1 truncate">
                {m.displayName || m.username}
                {m.role === 'owner' && <span className="ml-1 text-[10px] text-[var(--color-accent-main)]">({t('room.owner')})</span>}
              </span>
              {isOwner && m.role !== 'owner' && (
                <button onClick={() => kick(m.userId)} className="text-red-400 hover:text-red-300" title={t('room.kick')}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {isOwner && (
          <>
            <div className="text-[12px] text-[var(--color-text-tertiary)] mb-1">{t('room.invite')}</div>
            <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
              {invitable.length === 0 && <div className="text-[12px] text-[var(--color-text-tertiary)] py-2">{t('room.noInvitable')}</div>}
              {invitable.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-main-surface-tertiary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={picked.includes(u.id)}
                    onChange={() =>
                      setPicked((p) => (p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id]))
                    }
                  />
                  <span className="text-[13px] text-[var(--color-text-primary)]">{u.displayName || u.username}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (picked.length) {
                    await invite(picked);
                    setPicked([]);
                  }
                }}
                disabled={!picked.length}
                className="flex-1 py-2 rounded-xl bg-[var(--color-accent-main)] text-white text-[13px] disabled:opacity-40 flex items-center justify-center gap-1"
              >
                <UserPlus size={15} /> {t('room.doInvite')}
              </button>
              <button
                onClick={async () => {
                  if (confirm(t('room.disbandConfirm'))) {
                    await disband();
                    onClose();
                  }
                }}
                className="px-3 py-2 rounded-xl border border-red-500/40 text-red-400 text-[13px] flex items-center gap-1"
              >
                <Trash2 size={15} /> {t('room.disband')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- Group model prefs modal ----------------

function ModelsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const setModels = useRoomStore((s) => s.setModels);
  const catalog = usePrefsStore((s) => s.catalog);
  const fetchCatalog = usePrefsStore((s) => s.fetchCatalog);
  const [chat, setChat] = useState(currentRoom?.chatModel || '');
  const [image, setImage] = useState(currentRoom?.imageModel || '');
  const [tts, setTts] = useState(currentRoom?.ttsModel || '');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Evaluate the cooldown once when the modal opens (Date.now() must not be
  // called during render — it is impure). Good enough for a short-lived modal.
  const [locked] = useState(() => {
    const until = currentRoom?.modelLockedUntil ? new Date(currentRoom.modelLockedUntil).getTime() : 0;
    return until > Date.now();
  });

  const save = async () => {
    if (!confirm(t('room.modelCooldownConfirm'))) return;
    const e = await setModels({ chatModel: chat || null, imageModel: image || null, ttsModel: tts || null });
    if (e) setErr(e);
    else onClose();
  };

  // catalog is keyed by slot name (chat / image / tts), not capability tag.
  const opts = (slot: 'chat' | 'image' | 'tts') =>
    (catalog?.[slot] || []).map((m) => (
      <option key={m.normalizedName} value={m.normalizedName}>{m.displayName}</option>
    ));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--color-main-surface-secondary)] rounded-2xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-medium text-[var(--color-text-primary)]">{t('room.modelSettings')}</h3>
          <button onClick={onClose}><X size={18} className="text-[var(--color-text-tertiary)]" /></button>
        </div>
        <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3">{t('room.modelSharedHint')}</p>
        {locked && (
          <div className="text-[12px] text-amber-400 mb-2">{t('room.modelLocked')}</div>
        )}
        {err && <div className="text-[12px] text-red-400 mb-2">{err}</div>}

        <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t('room.chatModel')}</label>
        <select value={chat} onChange={(e) => setChat(e.target.value)} disabled={locked} className="w-full mb-3 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg px-2 py-1.5 text-[13px]">
          <option value="">—</option>
          {opts('chat')}
        </select>

        <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t('room.imageModel')}</label>
        <select value={image} onChange={(e) => setImage(e.target.value)} disabled={locked} className="w-full mb-3 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg px-2 py-1.5 text-[13px]">
          <option value="">—</option>
          {opts('image')}
        </select>

        <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t('room.ttsModel')}</label>
        <select value={tts} onChange={(e) => setTts(e.target.value)} disabled={locked} className="w-full mb-4 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg px-2 py-1.5 text-[13px]">
          <option value="">—</option>
          {opts('tts')}
        </select>

        <button onClick={save} disabled={locked} className="w-full py-2 rounded-xl bg-[var(--color-accent-main)] text-white text-[13px] disabled:opacity-40">
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
