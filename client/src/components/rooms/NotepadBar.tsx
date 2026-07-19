import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useTranslation } from '../../i18n';
import {
  StickyNote, Pencil, Check, X, Lock, BellRing, UserCheck, UserX, Loader2,
} from 'lucide-react';

/**
 * §10.6.14 Group notepad — a pinned "sticky note" for work-log style notes,
 * shown under the column-b (chat) header.
 *
 * Permissions:
 *   - The owner can always edit.
 *   - Other members are read-only until the owner grants them edit rights.
 *   - A read-only member can request edit rights; the owner sees a small
 *     request queue with approve / deny, and can revoke a granted editor.
 *
 * All state lives in the room store's `notepad` (kept fresh via WS + refetch).
 */
export function NotepadBar() {
  const { t } = useTranslation();
  const notepad = useRoomStore((s) => s.notepad);
  const saveNotepad = useRoomStore((s) => s.saveNotepad);
  const requestNotepadEdit = useRoomStore((s) => s.requestNotepadEdit);
  const resolveNotepadRequest = useRoomStore((s) => s.resolveNotepadRequest);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Keep the draft in sync when we enter edit mode.
  useEffect(() => {
    if (editing) {
      setDraft(notepad?.content ?? '');
      // focus after paint
      setTimeout(() => taRef.current?.focus(), 0);
    }
  }, [editing, notepad?.content]);

  if (!notepad) return null;

  const { content, canEdit, isOwner, requests } = notepad;
  const hasContent = content.trim().length > 0;
  const pendingRequests = isOwner ? requests.filter((r) => r.status === 'pending') : [];
  // A member's own latest request (backend returns 0-1 for non-owners).
  const myPending = !isOwner && requests.some((r) => r.status === 'pending');

  const startEdit = () => setEditing(true);
  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };
  const save = async () => {
    setBusy(true);
    const err = await saveNotepad(draft);
    setBusy(false);
    if (!err) setEditing(false);
    else alert(err);
  };

  const requestEdit = async () => {
    setBusy(true);
    const err = await requestNotepadEdit();
    setBusy(false);
    if (!err) setRequested(true);
    else alert(err);
  };

  return (
    <div className="border-b border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-accent-main)_5%,transparent)]">
      <div className="px-3 py-2">
        {/* header row */}
        <div className="flex items-center gap-1.5 mb-1">
          <StickyNote size={12} className="text-[var(--color-accent-main)] flex-shrink-0" />
          <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
            {t('room.notepadTitle')}
          </span>
          <div className="flex-1" />

          {/* owner request badge */}
          {isOwner && pendingRequests.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-amber-500 hover:opacity-80"
              title={t('room.notepadRequests')}
            >
              <BellRing size={11} /> {pendingRequests.length}
            </button>
          )}

          {/* edit / request-edit control */}
          {!editing && canEdit && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-main)]"
              title={t('room.notepadEdit')}
            >
              <Pencil size={11} /> {t('room.notepadEdit')}
            </button>
          )}
          {!editing && !canEdit && (
            myPending || requested ? (
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
                <Lock size={11} /> {t('room.notepadRequestSent')}
              </span>
            ) : (
              <button
                onClick={requestEdit}
                disabled={busy}
                className="flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-main)] disabled:opacity-50"
                title={t('room.notepadRequestEdit')}
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
                {t('room.notepadRequestEdit')}
              </button>
            )
          )}
        </div>

        {/* body */}
        {editing ? (
          <div>
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder={t('room.notepadPlaceholder')}
              className="w-full resize-none bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg px-2 py-1.5 text-[12px] leading-5 outline-none focus:border-[var(--color-accent-main)]"
            />
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={save}
                disabled={busy}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--color-accent-main)] text-white text-[11px] disabled:opacity-50"
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} {t('room.notepadSave')}
              </button>
              <button
                onClick={cancelEdit}
                disabled={busy}
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--color-border-light)] text-[var(--color-text-secondary)] text-[11px]"
              >
                <X size={11} /> {t('room.notepadCancel')}
              </button>
            </div>
          </div>
        ) : (
          <p
            className={`text-[12px] leading-5 whitespace-pre-wrap break-words ${
              hasContent ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-tertiary)] italic'
            }`}
          >
            {hasContent ? content : t('room.notepadEmpty')}
          </p>
        )}

        {/* read-only hint for members without rights */}
        {!editing && !canEdit && !hasContent && (
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{t('room.notepadReadonly')}</p>
        )}

        {/* owner: request queue */}
        {isOwner && expanded && pendingRequests.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-[var(--color-border-light)] pt-2">
            <div className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
              {t('room.notepadRequests')}
            </div>
            {pendingRequests.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1 truncate text-[var(--color-text-secondary)]">
                  {r.displayName || r.username || r.userId}
                </span>
                <button
                  onClick={() => resolveNotepadRequest(r.id, true)}
                  className="flex items-center gap-0.5 text-[10px] text-[var(--color-accent-main)] hover:opacity-80"
                >
                  <UserCheck size={11} /> {t('room.notepadApprove')}
                </button>
                <button
                  onClick={() => resolveNotepadRequest(r.id, false)}
                  className="flex items-center gap-0.5 text-[10px] text-red-400 hover:opacity-80"
                >
                  <UserX size={11} /> {t('room.notepadDeny')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
