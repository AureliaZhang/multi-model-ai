import { useEffect, useState } from 'react';
import {
  Globe2, Plus, X, Loader2, Pencil, Trash2, Tag, Search, Power,
} from 'lucide-react';
import { lorebookApi, type LorebookEntry } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../i18n';

/**
 * Project lorebook / 世界书 (v0.7.72) — SillyTavern-style World Info for the
 * team. Keyword-triggered entries: when a chat mentions a keyword, the entry
 * is injected into the AI's context automatically. Everyone can read and add;
 * you can edit/delete your own entries; admins can manage everything.
 */
export function LorebookPanel() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<LorebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Editor state: null = closed, '' = new entry, id = editing that entry.
  const [editing, setEditing] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fKeywords, setFKeywords] = useState('');
  const [fContent, setFContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await lorebookApi.list();
      if (res.success && res.data) setEntries(res.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const canModify = (e: LorebookEntry) =>
    !!user && (user.role === 'admin' || (e.createdBy != null && e.createdBy === user.id));

  const openNew = () => {
    setEditing('');
    setFTitle('');
    setFKeywords('');
    setFContent('');
    setError('');
  };
  const openEdit = (e: LorebookEntry) => {
    setEditing(e.id);
    setFTitle(e.title);
    setFKeywords(e.keywords.join('、'));
    setFContent(e.content);
    setError('');
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = { title: fTitle, content: fContent, keywords: fKeywords };
      const res = editing
        ? await lorebookApi.update(editing, payload)
        : await lorebookApi.create(payload);
      if (res.success) {
        setEditing(null);
        await load();
      } else {
        setError(res.error || t('lorebook.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (e: LorebookEntry) => {
    setBusyId(e.id);
    try {
      const res = await lorebookApi.update(e.id, { enabled: !e.enabled });
      const updated = res.data;
      if (res.success && updated) {
        setEntries((prev) => prev.map((x) => (x.id === e.id ? updated : x)));
      }
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (e: LorebookEntry) => {
    if (!window.confirm(t('lorebook.deleteConfirm'))) return;
    setBusyId(e.id);
    try {
      const res = await lorebookApi.remove(e.id);
      if (res.success) setEntries((prev) => prev.filter((x) => x.id !== e.id));
    } finally {
      setBusyId(null);
    }
  };

  const f = filter.trim().toLowerCase();
  const visible = f
    ? entries.filter(
        (e) =>
          e.title.toLowerCase().includes(f) ||
          e.content.toLowerCase().includes(f) ||
          e.keywords.some((k) => k.toLowerCase().includes(f))
      )
    : entries;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 py-4">
        {/* Intro + toolbar */}
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed mb-3">
          {t('lorebook.intro')}
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('lorebook.searchPlaceholder')}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-main)]"
            />
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-main)] hover:opacity-90 text-white text-sm font-medium transition-opacity flex-shrink-0"
          >
            <Plus size={15} />
            {t('lorebook.newEntry')}
          </button>
        </div>

        {/* Editor card */}
        {editing !== null && (
          <div className="mb-4 p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {editing ? t('lorebook.editEntry') : t('lorebook.newEntry')}
              </h3>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-[var(--overlay-5)] text-[var(--color-text-tertiary)]">
                <X size={16} />
              </button>
            </div>
            <input
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              placeholder={t('lorebook.titlePlaceholder')}
              className="w-full mb-2 px-3 py-2 rounded-lg bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-sm focus:outline-none focus:border-[var(--color-accent-main)]"
            />
            <input
              value={fKeywords}
              onChange={(e) => setFKeywords(e.target.value)}
              placeholder={t('lorebook.keywordsPlaceholder')}
              className="w-full mb-2 px-3 py-2 rounded-lg bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-sm focus:outline-none focus:border-[var(--color-accent-main)]"
            />
            <textarea
              value={fContent}
              onChange={(e) => setFContent(e.target.value)}
              placeholder={t('lorebook.contentPlaceholder')}
              rows={5}
              className="w-full mb-2 px-3 py-2 rounded-lg bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-sm resize-y focus:outline-none focus:border-[var(--color-accent-main)]"
            />
            {error && <p className="text-xs text-[var(--color-text-error)] mb-2">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => void save()}
                disabled={saving || !fTitle.trim() || !fContent.trim() || !fKeywords.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--color-accent-main)] hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        )}

        {/* Entries */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--color-text-tertiary)]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16">
            <Globe2 size={32} className="mx-auto mb-3 text-[var(--color-text-tertiary)]" />
            <p className="text-sm text-[var(--color-text-tertiary)]">
              {entries.length === 0 ? t('lorebook.empty') : t('lorebook.noMatch')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((e) => (
              <div
                key={e.id}
                className={`p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] transition-opacity ${
                  e.enabled ? '' : 'opacity-55'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] min-w-0 break-words">
                    {e.title}
                    {!e.enabled && (
                      <span className="ml-2 text-[10px] font-normal text-[var(--color-text-tertiary)] border border-[var(--color-border-light)] rounded px-1.5 py-0.5 align-middle">
                        {t('lorebook.disabled')}
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {canModify(e) && (
                      <>
                        <button
                          onClick={() => void toggleEnabled(e)}
                          disabled={busyId === e.id}
                          title={e.enabled ? t('lorebook.disable') : t('lorebook.enable')}
                          className={`p-1.5 rounded-md hover:bg-[var(--overlay-5)] transition-colors ${
                            e.enabled ? 'text-[var(--color-accent-main)]' : 'text-[var(--color-text-tertiary)]'
                          }`}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(e)}
                          title={t('common.edit')}
                          className="p-1.5 rounded-md hover:bg-[var(--overlay-5)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => void remove(e)}
                          disabled={busyId === e.id}
                          title={t('common.delete')}
                          className="p-1.5 rounded-md hover:bg-[var(--overlay-5)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-error)]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {e.keywords.map((k) => (
                    <span
                      key={k}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-tint-10)] text-[var(--color-accent-main)] text-[11px]"
                    >
                      <Tag size={10} />
                      {k}
                    </span>
                  ))}
                </div>
                <p className="text-[13px] text-[var(--color-text-secondary)] whitespace-pre-wrap break-words leading-relaxed">
                  {e.content}
                </p>
                <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
                  {e.createdByName || t('lorebook.unknownAuthor')} · {new Date(e.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
