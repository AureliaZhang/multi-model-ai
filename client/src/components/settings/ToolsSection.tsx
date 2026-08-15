import { Brain, FolderOpen, Download, Upload, Users, ScrollText, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../i18n';

interface ToolsSectionProps {
  isGuest?: boolean;
  onOpenMemory: () => void;
  onOpenFiles: () => void;
  onOpenUsers: () => void;
  onOpenUsage: () => void;
}

interface ToolRow {
  key: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

/**
 * "Tools & data" (v0.7.94) — the six destinations that used to sit in the
 * sidebar footer, moved here at the owner's request so the sidebar could be
 * narrowed to conversations plus the two things opened daily (group chat and,
 * for admins, the arena).
 *
 * Settings is now their ONLY entrance, which is why Layout sends these four
 * pages back to Settings rather than to the chat — a back button that drops you
 * somewhere you never came from is worse than the click it saves.
 *
 * Export/import moved with their logic: they are file-picker flows rather than
 * navigation, and nothing else in the sidebar used them.
 */
export function ToolsSection({ isGuest = false, onOpenMemory, onOpenFiles, onOpenUsers, onOpenUsage }: ToolsSectionProps) {
  const { t } = useTranslation();
  const isAdmin = useAuthStore((st) => st.user?.role === 'admin');
  const exportConversations = useChatStore((s) => s.exportConversations);
  const importConversations = useChatStore((s) => s.importConversations);

  const handleExport = async () => {
    try {
      await exportConversations();
    } catch (err) {
      console.error('[ToolsSection] export failed:', err);
      alert(t('sidebar.exportFailed'));
    }
  };

  const importFile = async (file: File) => {
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
      console.error('[ToolsSection] import failed:', err);
      alert(t('sidebar.importFailed'));
    }
  };

  const handleImport = () => {
    // Built on demand rather than a hidden <input> plus a ref, as the sidebar
    // did it: the row table below is assembled during render, and a ref read
    // reachable from it trips react-hooks' "cannot access refs during render"
    // even though the read only ever happens on click. A throwaway element
    // also means no stale value to reset between picks.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void importFile(file);
    });
    input.click();
  };

  // Same visibility rules the sidebar footer had: signed-in members get the
  // libraries and the import/export pair, admins additionally get the two admin
  // pages. A guest sees neither, so the whole card disappears.
  const rows: ToolRow[] = [];
  if (!isGuest) {
    rows.push(
      { key: 'memory', icon: Brain, label: t('sidebar.memoryStore'), onClick: onOpenMemory },
      { key: 'files', icon: FolderOpen, label: t('sidebar.fileLibrary'), onClick: onOpenFiles },
      { key: 'export', icon: Download, label: t('sidebar.exportChats'), onClick: handleExport },
      { key: 'import', icon: Upload, label: t('sidebar.importChats'), onClick: handleImport }
    );
  }
  if (isAdmin) {
    rows.push(
      { key: 'users', icon: Users, label: t('sidebar.userManagement'), onClick: onOpenUsers },
      { key: 'usage', icon: ScrollText, label: t('sidebar.usageLogs'), onClick: onOpenUsage }
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="mb-5 p-4 rounded-2xl bg-[var(--color-main-surface-secondary)] border border-[var(--color-border-light)]">
      <h3 className="font-medium text-sm text-[var(--color-text-primary)]">{t('settings.toolsTitle')}</h3>
      <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1 mb-3">{t('settings.toolsDesc')}</p>
      {/* One column on a phone, two side by side once there is room. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.key}
              onClick={row.onClick}
              className="touch-target flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)] text-[13px] w-full transition-colors duration-150"
            >
              <Icon size={16} strokeWidth={1.5} className="flex-shrink-0" />
              <span className="flex-1 text-left truncate">{row.label}</span>
              <ChevronRight size={14} className="flex-shrink-0 opacity-40" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
