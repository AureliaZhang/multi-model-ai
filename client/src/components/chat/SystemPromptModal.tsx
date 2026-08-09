import { useEffect, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useModelStore } from '../../stores/modelStore';
import { useAuthStore } from '../../stores/authStore';
import { usePersonaStore, canModifyPersona } from '../../stores/personaStore';
import { useTranslation } from '../../i18n';
import { X, Wand2, Library, BookmarkPlus, Pencil, Trash2, Check } from 'lucide-react';
import type { Persona } from '../../types';

interface SystemPromptModalProps {
  onClose: () => void;
}

/**
 * Per-conversation persona / system prompt editor + team-shared persona library.
 *
 * The top half edits THIS conversation's system prompt (injected as the leading
 * system message on every send — server: routes/chat.ts); if no conversation
 * exists yet, saving lazily creates one so the persona applies from message #1.
 *
 * The bottom half is the TEAM-SHARED library (§10.8 Phase 4): reusable roles any
 * member can apply in one click, save the current text into, and — for personas
 * they created (or admins) — rename/delete. Read/use is open to everyone;
 * edit/delete is creator-or-admin (enforced server-side, mirrored in the UI).
 *
 * Rendered only while open (parent mounts it on demand), so the textarea seeds
 * from the active conversation without a syncing effect.
 */
export function SystemPromptModal({ onClose }: SystemPromptModalProps) {
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const createConversation = useChatStore((s) => s.createConversation);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const models = useModelStore((s) => s.models);
  const user = useAuthStore((s) => s.user);
  const personas = usePersonaStore((s) => s.personas);
  const personasLoaded = usePersonaStore((s) => s.loaded);
  const fetchPersonas = usePersonaStore((s) => s.fetch);
  const createPersona = usePersonaStore((s) => s.create);
  const updatePersona = usePersonaStore((s) => s.update);
  const removePersona = usePersonaStore((s) => s.remove);
  const { t } = useTranslation();

  const current = conversations.find((c) => c.id === currentConversationId);
  const [value, setValue] = useState(current?.systemPrompt || '');
  const [saving, setSaving] = useState(false);
  // Inline "save current text as a team persona" form.
  const [saveOpen, setSaveOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  // Which library persona is being renamed inline (id) + its draft title.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const hasExisting = !!(current?.systemPrompt && current.systemPrompt.trim());

  useEffect(() => {
    if (!personasLoaded) void fetchPersonas();
  }, [personasLoaded, fetchPersonas]);

  const persist = async (systemPrompt: string | null) => {
    setSaving(true);
    try {
      let convId = currentConversationId;
      if (!convId) {
        const model = localStorage.getItem('selected_model') || models[0]?.normalizedName;
        if (!model) return; // no model available — nothing to attach to
        convId = await createConversation(model);
      }
      await updateConversation(convId, { systemPrompt });
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => void persist(value.trim() ? value : null).then(onClose);
  const onClear = () => {
    setValue('');
    void persist(null).then(onClose);
  };

  // Apply a library persona: load its body into the editor (no auto-save, so the
  // member can tweak before committing to the conversation).
  const applyPersona = (p: Persona) => {
    setValue(p.body);
    setSaveOpen(false);
    setEditingId(null);
  };

  const onSaveAsPersona = async () => {
    const title = newTitle.trim();
    const body = value.trim();
    if (!title || !body) return;
    const created = await createPersona({ title, body });
    if (created) {
      setNewTitle('');
      setSaveOpen(false);
    }
  };

  const startRename = (p: Persona) => {
    setEditingId(p.id);
    setEditTitle(p.title);
  };
  const commitRename = async (p: Persona) => {
    const title = editTitle.trim();
    if (title && title !== p.title) await updatePersona(p.id, { title });
    setEditingId(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('persona.title')}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-primary)] shadow-2xl p-5 relative max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--overlay-6)]"
          aria-label={t('common.dismiss')}
        >
          <X size={16} />
        </button>

        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1 pr-8 flex items-center gap-2">
          <Wand2 size={18} className="text-[var(--color-accent-main)]" />
          {t('persona.title')}
        </h2>
        <p className="text-[12px] text-[var(--color-text-tertiary)] mb-4 leading-5">
          {t('persona.desc')}
        </p>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          placeholder={t('persona.placeholder')}
          className="w-full rounded-xl bg-[var(--overlay-4)] border border-[var(--color-border-light)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] resize-y leading-6 focus:outline-none focus:border-[var(--color-accent-main)]"
        />

        <div className="flex items-center gap-2 mt-4">
          {hasExisting && (
            <button
              type="button"
              disabled={saving}
              onClick={onClear}
              className="px-3 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)] disabled:opacity-50"
            >
              {t('persona.clear')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-3 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--overlay-5)]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="px-4 py-2.5 rounded-xl bg-[var(--color-accent-main)] text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>

        {/* Team-shared persona library */}
        <div className="mt-6 pt-5 border-t border-[var(--color-border-light)]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Library size={16} className="text-[var(--color-text-secondary)]" />
              {t('persona.libraryTitle')}
            </h3>
            <button
              type="button"
              disabled={!value.trim()}
              onClick={() => {
                setSaveOpen((v) => !v);
                setNewTitle('');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--overlay-5)] disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('persona.saveAs')}
            >
              <BookmarkPlus size={15} strokeWidth={1.75} />
              <span className="hidden sm:inline">{t('persona.saveAs')}</span>
            </button>
          </div>
          <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3 leading-5">
            {t('persona.libraryDesc')}
          </p>

          {saveOpen && (
            <div className="flex items-center gap-2 mb-3">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveAsPersona();
                  if (e.key === 'Escape') setSaveOpen(false);
                }}
                placeholder={t('persona.namePlaceholder')}
                className="flex-1 rounded-lg bg-[var(--overlay-4)] border border-[var(--color-border-light)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-main)]"
              />
              <button
                type="button"
                disabled={!newTitle.trim() || !value.trim()}
                onClick={() => void onSaveAsPersona()}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-accent-main)] text-white text-sm font-medium disabled:opacity-50"
              >
                {t('common.save')}
              </button>
            </div>
          )}

          {personas.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-tertiary)] py-2">
              {t('persona.libraryEmpty')}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {personas.map((p) => {
                const canEdit = canModifyPersona(p, user);
                const isEditing = editingId === p.id;
                return (
                  <li
                    key={p.id}
                    className="group flex items-center gap-2 rounded-xl border border-[var(--color-border-light)] px-3 py-2 hover:bg-[var(--overlay-4)]"
                  >
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitRename(p);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 rounded-lg bg-[var(--overlay-4)] border border-[var(--color-border-light)] px-2 py-1 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-main)]"
                        />
                        <button
                          type="button"
                          onClick={() => void commitRename(p)}
                          className="p-1.5 rounded-lg text-[var(--color-accent-main)] hover:bg-[var(--overlay-6)]"
                          aria-label={t('common.save')}
                        >
                          <Check size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => applyPersona(p)}
                          className="flex-1 min-w-0 text-left"
                          title={p.body}
                        >
                          <span className="block text-sm text-[var(--color-text-primary)] truncate">
                            {p.title}
                          </span>
                          <span className="block text-[11px] text-[var(--color-text-tertiary)] truncate">
                            {p.description || p.body}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPersona(p)}
                          className="flex-shrink-0 px-2 py-1 rounded-lg text-xs font-medium text-[var(--color-accent-main)] hover:bg-[var(--overlay-6)]"
                        >
                          {t('persona.apply')}
                        </button>
                        {canEdit && (
                          <>
                            {/* Reveal-on-hover only on hover-capable pointers; on
                                touch these stay visible (see MessageBubble). */}
                            <button
                              type="button"
                              onClick={() => startRename(p)}
                              className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--overlay-6)] pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
                              aria-label={t('persona.rename')}
                              title={t('persona.rename')}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void removePersona(p.id)}
                              className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-danger,#e5484d)] hover:bg-[var(--overlay-6)] pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
                              aria-label={t('common.delete')}
                              title={t('common.delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
