import { useEffect, useState, useRef, useCallback } from 'react';
import { useMemoryStore } from '../../stores/memoryStore';
import {
  ArrowLeft, Search, Trash2, ChevronLeft, ChevronRight,
  Brain, Clock, Tag, Filter, X, Settings, ToggleLeft, ToggleRight,
} from 'lucide-react';
import type { MemoryEntry } from '../../types';

interface MemoryBrowserProps {
  onClose: () => void;
}

export function MemoryBrowser({ onClose }: MemoryBrowserProps) {
  const {
    entries, total, page, totalPages, loading, error,
    searchQuery, searchResults, config, selectedTag,
    fetchEntries, searchMemories, clearSearch, fetchConfig,
    updateConfig, deleteEntry, setSelectedTag, clearError,
  } = useMemoryStore();

  const [input, setInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchEntries();
    fetchConfig();
  }, [fetchEntries, fetchConfig]);

  const handleSearch = useCallback((value: string) => {
    setInput(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        searchMemories(value);
      } else {
        clearSearch();
      }
    }, 300);
  }, [searchMemories, clearSearch]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this memory entry?')) return;
    await deleteEntry(id);
  };

  const handlePageChange = (newPage: number) => {
    fetchEntries(newPage, selectedTag || undefined);
  };

  const handleToggleConfig = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  const displayEntries = searchQuery ? searchResults : entries;

  // Collect all unique tags from entries
  const allTags = new Set<string>();
  entries.forEach(e => e.tags?.forEach(t => allTags.add(t)));
  searchResults.forEach(e => e.tags?.forEach(t => allTags.add(t)));

  return (
    <div className="h-full flex flex-col bg-[var(--color-main-surface-primary)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)]">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <Brain size={18} className="text-[var(--color-accent-main)]" />
        <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Memory Store</h1>
        <span className="text-xs text-[var(--color-text-tertiary)] ml-auto">{total} entries</span>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)] transition-colors"
          title="Memory Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Config panel */}
      {showConfig && config && (
        <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-main-surface-tertiary)]">
          <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">Memory Settings</h3>
          <div className="space-y-2.5">
            <ConfigToggle
              label="Auto-save conversations"
              description="Automatically save every chat turn to memory"
              enabled={config.autoSave}
              onToggle={() => handleToggleConfig('autoSave', !config.autoSave)}
            />
            <ConfigToggle
              label="Context injection"
              description="Inject relevant memories into AI context"
              enabled={config.contextInjection}
              onToggle={() => handleToggleConfig('contextInjection', !config.contextInjection)}
            />
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-[var(--color-text-secondary)]">Max context memories</span>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">How many memories to inject per message</p>
              </div>
              <select
                value={config.maxContextMemories}
                onChange={e => updateConfig({ maxContextMemories: parseInt(e.target.value) })}
                className="px-2 py-1 rounded-lg bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] text-xs outline-none"
              >
                {[3, 5, 10, 15, 20].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="px-4 py-3 border-b border-[var(--color-border-light)]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={input}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search memories by keyword..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--color-main-surface-tertiary)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-border-medium)] transition-colors placeholder-[var(--color-text-tertiary)]"
          />
          {input && (
            <button
              onClick={() => { setInput(''); clearSearch(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tag filters */}
        {allTags.size > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[var(--color-accent-main)] text-white"
              >
                <X size={10} />
                Clear filter
              </button>
            )}
            {Array.from(allTags).slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-colors ${
                  selectedTag === tag
                    ? 'bg-[var(--color-accent-main)] text-white'
                    : 'bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)] hover:bg-[rgba(255,255,255,0.08)]'
                }`}
              >
                <Tag size={10} />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-[var(--color-text-error)] hover:underline">Dismiss</button>
        </div>
      )}

      {/* Memory entries list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-tertiary)] text-sm">
            <div className="animate-spin w-5 h-5 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full mx-auto mb-2" />
            Loading memories...
          </div>
        ) : displayEntries.length === 0 ? (
          <div className="text-center py-12">
            <Brain size={32} className="mx-auto mb-3 text-[var(--color-text-tertiary)]" />
            <p className="text-[var(--color-text-secondary)] text-sm mb-1">
              {searchQuery ? 'No memories found' : 'No memories yet'}
            </p>
            <p className="text-[var(--color-text-tertiary)] text-xs">
              {searchQuery ? 'Try different keywords' : 'Start chatting to build your memory store'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-light)]">
            {displayEntries.map(entry => (
              <MemoryEntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!searchQuery && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-[var(--color-border-light)]">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function ConfigToggle({ label, description, enabled, onToggle }: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
        <p className="text-[11px] text-[var(--color-text-tertiary)]">{description}</p>
      </div>
      <button onClick={onToggle} className="flex-shrink-0">
        {enabled ? (
          <ToggleRight size={24} className="text-[var(--color-accent-main)]" />
        ) : (
          <ToggleLeft size={24} className="text-[var(--color-text-tertiary)]" />
        )}
      </button>
    </div>
  );
}

function MemoryEntryCard({ entry, onDelete }: { entry: MemoryEntry; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="px-4 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {/* Summary (main display) */}
          <div className="text-sm text-[var(--color-text-primary)] leading-5">
            {entry.summary || entry.content.substring(0, 120)}
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]">
              <Clock size={10} />
              {formatDate(entry.createdAt)}
            </span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${
              entry.role === 'user'
                ? 'bg-[rgba(59,130,246,0.1)] text-blue-400'
                : 'bg-[rgba(171,104,255,0.1)] text-purple-400'
            }`}>
              {entry.role === 'user' ? 'User' : 'AI'}
            </span>
            {entry.tags && entry.tags.length > 0 && (
              <div className="flex items-center gap-1">
                {entry.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {entry.keywords && entry.keywords.length > 0 && (
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                [{entry.keywords.slice(0, 4).join(', ')}]
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-surface-error)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-error)] transition-all"
          title="Delete memory"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-2 ml-0 pl-0 border-t border-[var(--color-border-light)] pt-2">
          <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-5">
            {entry.content}
          </p>
          {entry.keywords && entry.keywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.keywords.map(kw => (
                <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)]">
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
