import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';
import { usePrefsStore } from '../../stores/prefsStore';
import { usersApi } from '../../services/api';
import { useTranslation } from '../../i18n';
import type { UserPublic, RoomFile } from '../../types';
import {
  Send, Bot, Sparkles, Users2, Settings2, Trash2, UserPlus, X,
  ChevronRight, ChevronLeft, Loader2, Clock, FileText,
} from 'lucide-react';

/**
 * §10.6 Group room: left = human chat, right = shared Group AI.
 * Desktop shows both panes; mobile shows one at a time with a slide toggle.
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
  const openRoom = useRoomStore((s) => s.openRoom);
  const closeRoom = useRoomStore((s) => s.closeRoom);
  const sendMessage = useRoomStore((s) => s.sendMessage);
  const claim = useRoomStore((s) => s.claim);
  const renew = useRoomStore((s) => s.renew);
  const release = useRoomStore((s) => s.release);
  const ask = useRoomStore((s) => s.ask);
  const asking = useRoomStore((s) => s.asking);

  const [mobilePane, setMobilePane] = useState<'human' | 'ai'>('human');
  const [showManage, setShowManage] = useState(false);
  const [showModels, setShowModels] = useState(false);

  useEffect(() => {
    openRoom(roomId);
    return () => closeRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  if (!currentRoom) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-tertiary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> {t('common.loading')}
      </div>
    );
  }

  const isOwner = currentRoom.ownerId === me?.id;

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
        {/* mobile pane toggle */}
        <button
          className="md:hidden p-1.5 rounded-lg hover:bg-[var(--overlay-6)] text-[var(--color-text-secondary)]"
          onClick={() => setMobilePane(mobilePane === 'human' ? 'ai' : 'human')}
          title={mobilePane === 'human' ? t('room.toAi') : t('room.toHuman')}
        >
          {mobilePane === 'human' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
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

      {/* Two-pane body */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: human chat */}
        <div
          className={`flex flex-col min-w-0 border-r border-[var(--color-border-light)] w-full md:w-1/3 ${
            mobilePane === 'human' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <HumanPane messages={messages} meId={me?.id} onSend={sendMessage} />
        </div>

        {/* Right: shared Group AI */}
        <div
          className={`flex flex-col min-w-0 w-full md:w-2/3 ${
            mobilePane === 'ai' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <AiPane
            aiMessages={aiMessages}
            room={currentRoom}
            meId={me?.id}
            asking={asking}
            onClaim={claim}
            onRenew={renew}
            onRelease={release}
            onAsk={ask}
          />
        </div>
      </div>

      {showManage && (
        <ManageModal isOwner={isOwner} onClose={() => setShowManage(false)} />
      )}
      {showModels && <ModelsModal onClose={() => setShowModels(false)} />}
    </div>
  );
}

// ---------------- Human (left) pane ----------------

function HumanPane({
  messages,
  meId,
  onSend,
}: {
  messages: ReturnType<typeof useRoomStore.getState>['messages'];
  meId?: string;
  onSend: (content: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const submit = async () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    await onSend(v);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-[var(--color-text-tertiary)] text-[12px] py-8">{t('room.noMessages')}</div>
        )}
        {messages.map((m) => {
          const mine = m.userId && m.userId === meId;
          if (m.kind === 'ai_stub') {
            return (
              <div key={m.id} className="flex justify-center">
                <div className="text-[11px] text-[var(--color-text-tertiary)] bg-[rgba(16,163,127,0.08)] rounded-full px-3 py-1 flex items-center gap-1">
                  <Bot size={11} className="text-[var(--color-accent-main)]" />
                  {m.username || t('room.someone')} → AI: {m.content}
                </div>
              </div>
            );
          }
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
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-[var(--color-border-light)] flex items-end gap-2">
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
          placeholder={t('room.humanPlaceholder')}
          className="flex-1 resize-none bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-xl px-3 py-2 text-[13px] outline-none max-h-32"
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="p-2 rounded-xl bg-[var(--color-accent-main)] text-white disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </>
  );
}

// ---------------- AI (right) pane ----------------

function AiPane({
  aiMessages,
  room,
  meId,
  asking,
  onClaim,
  onRenew,
  onRelease,
  onAsk,
}: {
  aiMessages: ReturnType<typeof useRoomStore.getState>['aiMessages'];
  room: NonNullable<ReturnType<typeof useRoomStore.getState>['currentRoom']>;
  meId?: string;
  asking: boolean;
  onClaim: () => Promise<boolean>;
  onRenew: () => Promise<void>;
  onRelease: () => Promise<void>;
  onAsk: (content: string, fileIds?: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [remaining, setRemaining] = useState<number>(0);
  const [showRenewPrompt, setShowRenewPrompt] = useState(false);
  const renewGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const files = useRoomStore((s) => s.files);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const iHoldLock = room.aiState === 'occupying_input' && room.occupantUserId === meId;
  const someoneElseHolds = room.aiState === 'occupying_input' && room.occupantUserId !== meId;
  const aiRunning = room.aiState === 'ai_running' || asking;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages.length]);

  // Countdown for whoever is composing (visible to all, editable only by holder)
  useEffect(() => {
    if (room.aiState !== 'occupying_input' || !room.occupancyUntil) {
      setRemaining(0);
      setShowRenewPrompt(false);
      return;
    }
    const tick = () => {
      const ms = new Date(room.occupancyUntil!).getTime() - Date.now();
      const secs = Math.max(0, Math.ceil(ms / 1000));
      setRemaining(secs);
      // holder gets a "still need to type?" prompt when it hits 0
      if (secs <= 0 && iHoldLock && !showRenewPrompt) {
        setShowRenewPrompt(true);
        // 30s grace → auto-release
        if (renewGraceRef.current) clearTimeout(renewGraceRef.current);
        renewGraceRef.current = setTimeout(() => {
          onRelease();
          setShowRenewPrompt(false);
        }, 30_000);
      }
    };
    tick();
    const id = setInterval(tick, CLAIM_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.aiState, room.occupancyUntil, iHoldLock]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleClaim = async () => {
    const ok = await onClaim();
    if (ok) setDraft('');
  };

  const handleRenewYes = async () => {
    if (renewGraceRef.current) clearTimeout(renewGraceRef.current);
    setShowRenewPrompt(false);
    await onRenew();
  };
  const handleRenewNo = async () => {
    if (renewGraceRef.current) clearTimeout(renewGraceRef.current);
    setShowRenewPrompt(false);
    await onRelease();
    setDraft('');
  };

  const handleSend = async () => {
    const v = draft.trim();
    if (!v) return;
    setDraft('');
    const fids = [...selectedFiles];
    setSelectedFiles([]);
    await onAsk(v, fids.length ? fids : undefined);
  };

  const toggleFile = (id: string) => {
    setSelectedFiles((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length > 1) {
        // §10.6.7 warn on multi-file
        alert(t('room.multiFileWarn'));
      }
      return next;
    });
  };

  return (
    <>
      {/* AI thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {aiMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-[var(--color-text-tertiary)]">
            <Sparkles size={22} className="mb-2 text-[var(--color-accent-main)]" />
            <p className="text-[13px]">{t('room.aiEmpty')}</p>
          </div>
        )}
        {aiMessages.map((m) => (
          <div key={m.id} className="flex gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${m.role === 'assistant' ? 'bg-[#ab68ff]' : 'bg-[var(--color-accent-main)]'}`}>
              {m.role === 'assistant' ? <Bot size={13} className="text-white" /> : <span className="text-[10px] text-white font-medium">{(m.authorName || '?').slice(0, 1)}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-[var(--color-text-tertiary)] mb-0.5">
                {m.role === 'assistant' ? 'AI' : m.authorName || t('room.someone')}
                {m.modelUsed ? ` · ${m.modelUsed}` : ''}
              </div>
              {m.status === 'thinking' ? (
                <div className="text-[13px] text-[var(--color-text-tertiary)] flex items-center gap-2">
                  <span className="typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>{t('room.thinking')}</span>
                </div>
              ) : m.status === 'error' ? (
                <div className="text-[13px] text-red-400">{m.errorMessage || t('room.aiError')}</div>
              ) : (
                <div
                  className={`text-[13.5px] text-[var(--color-text-primary)] whitespace-pre-wrap break-words leading-6 ${
                    m.status === 'streaming' ? 'typing-cursor' : ''
                  }`}
                >
                  {m.content || (m.status === 'streaming' ? '…' : '')}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* @AI composer / occupancy bar */}
      <div className="border-t border-[var(--color-border-light)] p-2.5">
        {/* status line */}
        <div className="flex items-center gap-2 mb-2 text-[11px]">
          {aiRunning ? (
            <span className="flex items-center gap-1 text-[var(--color-accent-main)]">
              <Loader2 size={12} className="animate-spin" /> {t('room.aiRunning')}
            </span>
          ) : someoneElseHolds ? (
            <span className="flex items-center gap-1 text-[var(--color-text-tertiary)]">
              <Clock size={12} /> {t('room.someoneTyping')} {remaining > 0 ? `(${fmt(remaining)})` : ''}
            </span>
          ) : iHoldLock ? (
            <span className="flex items-center gap-1 text-[var(--color-accent-main)]">
              <Clock size={12} /> {t('room.youHold')} {remaining > 0 ? `(${fmt(remaining)})` : ''}
            </span>
          ) : (
            <span className="text-[var(--color-text-tertiary)]">{t('room.atAiHint')}</span>
          )}
        </div>

        {/* files strip (only when composing) */}
        {iHoldLock && files.length > 0 && (
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

        {!iHoldLock ? (
          <button
            onClick={handleClaim}
            disabled={aiRunning || someoneElseHolds}
            className="w-full py-2 rounded-xl bg-[var(--color-accent-main)] text-white text-[13px] font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Bot size={15} /> {t('room.atAiButton')}
          </button>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              autoFocus
              placeholder={t('room.aiPlaceholder')}
              className="flex-1 resize-none bg-[var(--composer-bg)] border border-[var(--color-accent-main)] rounded-xl px-3 py-2 text-[13px] outline-none max-h-40"
            />
            <button onClick={handleRenewNo} className="p-2 rounded-xl hover:bg-[var(--overlay-6)] text-[var(--color-text-tertiary)]" title={t('room.cancel')}>
              <X size={16} />
            </button>
            <button
              onClick={handleSend}
              disabled={!draft.trim() || asking}
              className="p-2 rounded-xl bg-[var(--color-accent-main)] text-white disabled:opacity-40"
            >
              {asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        )}

        {/* renew prompt */}
        {showRenewPrompt && (
          <div className="mt-2 p-2 rounded-lg bg-[var(--color-main-surface-tertiary)] border border-[var(--color-border-light)] text-[12px] flex items-center justify-between">
            <span>{t('room.stillTyping')}</span>
            <div className="flex gap-2">
              <button onClick={handleRenewYes} className="px-2 py-1 rounded-md bg-[var(--color-accent-main)] text-white">{t('room.yesNeed')}</button>
              <button onClick={handleRenewNo} className="px-2 py-1 rounded-md border border-[var(--color-border-light)]">{t('room.noRelease')}</button>
            </div>
          </div>
        )}
      </div>
    </>
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
