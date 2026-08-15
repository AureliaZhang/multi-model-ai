import { useEffect, useState } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { usersApi } from '../../services/api';
import { useTranslation } from '../../i18n';
import { GroupChatLayout } from './GroupChatLayout';
import type { UserPublic } from '../../types';
import { Users2, Plus, X, ArrowLeft, Loader2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { AnnouncementBanner } from '../common/AnnouncementBanner';
import { TopRightToggles } from '../layout/TopRightToggles';

interface RoomsPageProps {
  onClose: () => void;
}

/**
 * §10.6 Rooms entry page: left = group list + create, right = open group.
 * GroupChatLayout owns openRoom/closeRoom for the selected id.
 */
export function RoomsPage({ onClose }: RoomsPageProps) {
  const { t } = useTranslation();
  const rooms = useRoomStore((s) => s.rooms);
  const lastSeen = useRoomStore((s) => s.lastSeen);
  const roomsLoading = useRoomStore((s) => s.roomsLoading);
  const fetchRooms = useRoomStore((s) => s.fetchRooms);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // Desktop-only collapse for the group list (v0.7.77 owner request);
  // mobile keeps its list/detail behaviour untouched.
  const [listOpen, setListOpen] = useState(true);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return (
    <div className="h-full flex flex-col bg-[var(--color-main-surface-primary)]">
      {/* Team announcement also shows in the group-chat view (v0.7.76) */}
      <AnnouncementBanner />
      <div className="flex-1 min-h-0 flex">
      {/* Left: group list — full-width on mobile when nothing is open; the "1"
          of the page's 1:2:3 desktop split (this : group chat : AI replies,
          owner request). Clamped 200–320px so it neither squeezes group names
          on a laptop nor wastes a third of an ultrawide on a list of names —
          past those bounds the remaining space still splits 2:3. Hidden on
          mobile once a group is open (list/detail), and collapsible on desktop
          via listOpen, in which case the 2:3 below simply takes the full width. */}
      <div className={`${selectedId ? 'hidden' : 'flex'} ${listOpen ? 'md:flex' : 'md:hidden'} w-full md:w-auto md:flex-[1] md:min-w-[200px] md:max-w-[320px] flex-shrink-0 border-r border-[var(--color-border-light)] flex-col`}>
        <div className="p-2 flex items-center gap-1.5 border-b border-[var(--color-border-light)]">
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)]"
            title={t('common.back')}
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-primary)] text-sm flex-1 min-w-0"
          >
            <Plus size={16} strokeWidth={1.5} />
            <span className="truncate">{t('room.newGroup')}</span>
          </button>
          <button
            onClick={() => setListOpen(false)}
            className="hidden md:block flex-shrink-0 p-2 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            title={t('room.collapseList')}
            aria-label={t('room.collapseList')}
          >
            <PanelLeftClose size={17} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {roomsLoading && rooms.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[var(--color-text-tertiary)]">
              <Loader2 className="animate-spin" size={18} />
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center text-[var(--color-text-tertiary)] text-[13px] py-8 px-4">
              {t('room.empty')}
            </div>
          ) : (
            rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedId === r.id
                    ? 'bg-[var(--color-sidebar-surface-active)]'
                    : 'hover:bg-[var(--color-sidebar-surface-hover)]'
                }`}
              >
                <Users2 size={15} className="text-[var(--color-accent-main)] flex-shrink-0" />
                <span className="truncate text-[13px] text-[var(--color-text-secondary)] flex-1">{r.name}</span>
                {/* Unread dot (v0.7.61): activity since this member last opened the room */}
                {(!lastSeen[r.id] || r.updatedAt > lastSeen[r.id]) && selectedId !== r.id && (
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent-main)] flex-shrink-0" aria-label={t('room.unread')} />
                )}
                <span className="text-[11px] text-[var(--color-text-tertiary)] flex-shrink-0">
                  {r.memberCount ?? r.members?.length ?? ''}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Collapsed rail (desktop only): expand / back / new-group */}
      {!listOpen && (
        <div className="hidden md:flex w-11 flex-shrink-0 border-r border-[var(--color-border-light)] flex-col items-center gap-1 py-2">
          <button
            onClick={() => setListOpen(true)}
            className="p-2 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)]"
            title={t('room.expandList')}
            aria-label={t('room.expandList')}
          >
            <PanelLeft size={17} strokeWidth={1.5} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            title={t('common.back')}
          >
            <ArrowLeft size={17} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="p-2 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            title={t('room.newGroup')}
          >
            <Plus size={17} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Right: open group or empty state. On mobile this is hidden until a
          group is picked (then it's full-width with a back arrow). */}
      {/* md:flex-[5] is the "2+3" of the 1:2:3 split: this wrapper is a SIBLING
          of the group list, so the ratio the user sees is decided here, not
          inside GroupChatLayout. Leaving it at flex-1 next to a flex-[1] list
          would split the page 1:1 and then divide 2:3 inside that half —
          the same sibling-context trap that made group chat render at
          max-content in v0.7.87. */}
      <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 md:flex-[5] min-w-0`}>
        {selectedId ? (
          <GroupChatLayout key={selectedId} roomId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="relative h-full w-full flex flex-col items-center justify-center text-[var(--color-text-tertiary)] gap-2">
            {/* No group open → no header, so the toggles sit in the same corner spot */}
            <div className="absolute top-2.5 right-4">
              <TopRightToggles variant="inline" />
            </div>
            <Users2 size={40} className="opacity-30" />
            <p className="text-[13px]">{t('room.pickAGroup')}</p>
          </div>
        )}
      </div>

      </div>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const createRoom = useRoomStore((s) => s.createRoom);
  const [name, setName] = useState('');
  const [allUsers, setAllUsers] = useState<UserPublic[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    usersApi.listBasic().then((r) => {
      if (r.success && r.data) {
        setAllUsers(r.data);
        // Default-select the virtual placeholder so solo users can create a group immediately
        const vp = r.data.find((u) => u.isVirtual);
        if (vp) setPicked((prev) => (prev.length === 0 ? [vp.id] : prev));
      }
    });
  }, []);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    if (!name.trim() || picked.length === 0) {
      setErr(t('room.pickMembers'));
      return;
    }
    setBusy(true);
    const room = await createRoom(name.trim(), picked);
    setBusy(false);
    if (room) onCreated(room.id);
    else setErr(useRoomStore.getState().error || 'Failed');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-main-surface-secondary)] rounded-2xl w-full max-w-md p-4 dialog-panel overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-medium text-[var(--color-text-primary)]">{t('room.createTitle')}</h3>
          <button onClick={onClose}>
            <X size={18} className="text-[var(--color-text-tertiary)]" />
          </button>
        </div>

        <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3 leading-relaxed">
          {t('room.inviteOnlyHint')}
        </p>

        {err && <div className="text-[12px] text-red-400 mb-2">{err}</div>}

        <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t('room.groupName')}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-3 bg-[var(--composer-bg)] border border-[var(--color-border-light)] rounded-lg px-2 py-1.5 text-[13px] text-[var(--color-text-primary)]"
        />

        <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t('room.pickMembers')}</label>
        <div className="max-h-52 overflow-y-auto border border-[var(--color-border-light)] rounded-lg p-1 mb-3">
          {allUsers.length === 0 ? (
            <div className="text-[12px] text-[var(--color-text-tertiary)] px-2 py-3 text-center">
              {t('room.noInvitable')}
            </div>
          ) : (
            allUsers.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-main-surface-tertiary)] cursor-pointer"
              >
                <input type="checkbox" checked={picked.includes(u.id)} onChange={() => toggle(u.id)} />
                <span className="text-[13px] text-[var(--color-text-primary)] flex-1 min-w-0 truncate">
                  {u.isVirtual ? t('room.virtualName') : (u.displayName || u.username)}
                </span>
                {u.isVirtual && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] border border-[var(--color-border-light)] flex-shrink-0">
                    {t('room.virtualBadge')}
                  </span>
                )}
              </label>
            ))
          )}
        </div>
        <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3 leading-relaxed">
          {t('room.virtualHint')}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--overlay-5)]"
          >
            {t('room.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-1.5 text-[13px] bg-[var(--color-accent-main)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {busy && <Loader2 className="animate-spin" size={14} />}
            {t('room.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
