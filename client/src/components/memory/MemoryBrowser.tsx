import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from '../../i18n';
import { useMemoryStore } from '../../stores/memoryStore';
import { memoryApi } from '../../services/api';
import {
  ArrowLeft, Search, Trash2, Loader, Clock, User, Tag,
  ChevronLeft, ChevronRight, X, Settings, ChevronDown, ChevronUp,
  RefreshCw, Layers, AlertCircle, Brain, Key, Globe
} from 'lucide-react';

interface MemoryBrowserProps {
  onClose: () => void;
}

export function MemoryBrowser({ onClose }: MemoryBrowserProps) {
  const { t } = useTranslation();
  const {
    entries, loading, config, total, page, totalPages, allTags, selectedTag,
    fetchEntries, fetchTags, fetchConfig, updateConfig, deleteEntry, setSelectedTag, searchMemories,
    searchResults, searching, backfillEmbeddings
  } = useMemoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Embedding API config state
  const [embBaseUrl, setEmbBaseUrl] = useState('');
  const [embApiKey, setEmbApiKey] = useState('');
  const [embModel, setEmbModel] = useState('');
  const [embModels, setEmbModels] = useState<{ id: string; name: string }[]>([]);
  const [embFetching, setEmbFetching] = useState(false);
  const [embFetchError, setEmbFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
    fetchTags();
    fetchConfig();
  }, [fetchEntries, fetchTags, fetchConfig]);

  // Sync embedding config from store to local state
  useEffect(() => {
    if (config) {
      setEmbBaseUrl(config.embeddingApiBaseUrl || '');
      setEmbApiKey(config.embeddingApiKey || '');
      setEmbModel(config.embeddingModel || '');
    }
  }, [config]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        searchMemories(value.trim());
      } else {
        fetchEntries(1, selectedTag || undefined);
      }
    }, 300);
  }, [searchMemories, fetchEntries, selectedTag]);

  const handleDelete = async (id: string) => {
    if (deleteConfirmId === id) {
      await deleteEntry(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000);
    }
  };

  const handleTagClick = (tag: string) => {
    const newTag = selectedTag === tag ? null : tag;
    setSelectedTag(newTag);
    fetchEntries(1, newTag || undefined);
  };

  const handlePageChange = (newPage: number) => {
    fetchEntries(newPage, selectedTag || undefined);
  };

  const handleConfigToggle = (key: string, value: boolean) => {
    updateConfig({ [key]: value });
  };

  const handleBackfill = async () => {
    await backfillEmbeddings();
  };

  const handleFetchEmbeddingModels = async () => {
    if (!embBaseUrl.trim() || !embApiKey.trim()) return;
    setEmbFetching(true);
    setEmbFetchError(null);
    try {
      const res = await memoryApi.fetchEmbeddingModels(embBaseUrl.trim(), embApiKey.trim());
      if (res.success && res.data) {
        setEmbModels(res.data);
        if (res.data.length === 0) {
          setEmbFetchError(t('memory.noEmbeddingModels'));
        } else if (res.data.length === 1) {
          setEmbModel(res.data[0].id);
        }
      } else {
        setEmbFetchError(res.error || t('memory.fetchModelsFailed'));
      }
    } catch (err: any) {
      setEmbFetchError(err.message);
    } finally {
      setEmbFetching(false);
    }
  };

  const handleSaveEmbeddingConfig = () => {
    updateConfig({
      embeddingApiBaseUrl: embBaseUrl.trim() || null,
      embeddingApiKey: embApiKey.trim() || null,
      embeddingModel: embModel || null,
    });
  };

  const displayEntries = searchQuery.trim() ? searchResults : entries;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getImportanceColor = (importance: number) => {
    if (importance >= 0.8) return 'text-red-400 bg-red-500/10';
    if (importance >= 0.6) return 'text-yellow-400 bg-yellow-500/10';
    return 'text-green-400 bg-green-500/10';
  };

  const getImportanceLabel = (importance: number) => {
    if (importance >= 0.8) return 'High';
    if (importance >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-main-surface-primary)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-light)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('memory.title')}</h2>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              {t('memory.entries', { count: total }).replace('{count}', String(total))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBackfill}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border-light)] hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] text-sm font-medium transition-colors"
            title="Regenerate embeddings for all entries"
          >
            <RefreshCw size={14} />
            Re-embed
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors ${
              showSettings
                ? 'border-[var(--color-accent-main)] bg-[var(--color-accent-main)]/10 text-[var(--color-accent-main)]'
                : 'border-[var(--color-border-light)] hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)]'
            } text-sm font-medium`}
          >
            <Settings size={14} />
            {t('memory.settings')}
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-5 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] flex-shrink-0 space-y-4">
          {/* Toggle configs */}
          <div className="grid grid-cols-2 gap-3">
            <ConfigToggle
              label={t('memory.autoSave')}
              description={t('memory.autoSaveDesc')}
              enabled={config?.autoSave ?? true}
              onToggle={(v) => handleConfigToggle('auto_save', v)}
            />
            <ConfigToggle
              label={t('memory.contextInjection')}
              description={t('memory.contextInjectionDesc')}
              enabled={config?.contextInjection ?? true}
              onToggle={(v) => handleConfigToggle('context_injection', v)}
            />
          </div>

          {/* Embedding API Config */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain size={14} className="text-[var(--color-accent-main)]" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('memory.embeddingApi')}</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3">{t('memory.embeddingApiDesc')}</p>

            <div className="space-y-2.5">
              {/* Base URL */}
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase mb-1 flex items-center gap-1">
                  <Globe size={10} /> {t('memory.embBaseUrl')}
                </label>
                <input
                  type="text"
                  value={embBaseUrl}
                  onChange={e => setEmbBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-3 py-1.5 rounded-md bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-main)] transition-colors"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase mb-1 flex items-center gap-1">
                  <Key size={10} /> {t('memory.embApiKey')}
                </label>
                <input
                  type="password"
                  value={embApiKey}
                  onChange={e => setEmbApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-1.5 rounded-md bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-main)] transition-colors"
                />
              </div>

              {/* Fetch Models + Model Select */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase mb-1 block">{t('memory.embModel')}</label>
                  <select
                    value={embModel}
                    onChange={e => setEmbModel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-main)] transition-colors"
                  >
                    <option value="">{t('memory.autoDetect')}</option>
                    {embModels.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleFetchEmbeddingModels}
                  disabled={embFetching || !embBaseUrl.trim() || !embApiKey.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--color-border-light)] hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {embFetching ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {t('memory.fetchModels')}
                </button>
              </div>

              {embFetchError && (
                <p className="text-[11px] text-red-400">{embFetchError}</p>
              )}

              {/* Save button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveEmbeddingConfig}
                  className="px-4 py-1.5 rounded-md bg-[var(--color-accent-main)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {t('memory.saveEmbConfig')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="px-5 py-3 border-b border-[var(--color-border-light)] flex-shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('memory.searchPlaceholder')}
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-main)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Tag size={12} className="text-[var(--color-text-tertiary)]" />
            {allTags.slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                  selectedTag === tag
                    ? 'bg-[var(--color-accent-main)] text-white'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] border border-[var(--color-border-light)]'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTag && (
              <button
                onClick={() => { setSelectedTag(null); fetchEntries(1); }}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium text-[var(--color-text-tertiary)] hover:text-red-400 transition-colors"
              >
                {t('memory.clearFilter')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading || searching ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader size={28} className="animate-spin mb-3 text-[var(--color-text-tertiary)]" />
            <span className="text-sm text-[var(--color-text-tertiary)]">
              {searching ? 'Searching...' : t('memory.loading')}
            </span>
          </div>
        ) : displayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <div className="w-20 h-20 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-5">
              <Brain size={36} className="text-[var(--color-text-tertiary)] opacity-50" />
            </div>
            <p className="text-base font-medium text-[var(--color-text-secondary)] mb-1">
              {searchQuery ? t('memory.noFound') : t('memory.noYet')}
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)] text-center max-w-xs">
              {searchQuery ? t('memory.tryDifferent') : t('memory.startChatting')}
            </p>
          </div>
        ) : (
          <div className="px-3 py-2">
            {/* Table header */}
            <div className="grid grid-cols-[150px_80px_50px_1fr_80px_80px_70px] gap-2 px-3 py-2 text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border-light)] mb-1">
              <span className="flex items-center gap-1"><Clock size={11} /> {t('memory.colTime')}</span>
              <span className="flex items-center gap-1"><User size={11} /> {t('memory.colUser')}</span>
              <span>{t('memory.colRole')}</span>
              <span>{t('memory.colKeywords')}</span>
              <span className="text-center">{t('memory.colImportance')}</span>
              <span className="flex items-center gap-1"><Layers size={11} /> {t('memory.colEmbedding')}</span>
              <span className="text-right">{t('memory.colActions')}</span>
            </div>

            {/* Rows */}
            {displayEntries.map(entry => (
              <div key={entry.id}>
                <div
                  className="group grid grid-cols-[150px_80px_50px_1fr_80px_80px_70px] gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] transition-colors cursor-pointer"
                  onClick={() => setExpandedRowId(expandedRowId === entry.id ? null : entry.id)}
                >
                  {/* Time */}
                  <div className="text-xs text-[var(--color-text-tertiary)] truncate">
                    {formatDate(entry.createdAt)}
                  </div>

                  {/* User */}
                  <div className="text-xs text-[var(--color-text-secondary)] truncate" title={entry.username || entry.userId || '-'}>
                    {entry.username || entry.userId || '-'}
                  </div>

                  {/* Role */}
                  <div>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      entry.role === 'user'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {entry.role === 'user' ? 'U' : 'AI'}
                    </span>
                  </div>

                  {/* Keywords */}
                  <div className="flex items-center gap-1 flex-wrap min-w-0">
                    {entry.keywords.slice(0, 3).map((kw, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[10px] text-[var(--color-text-tertiary)] border border-[var(--color-border-light)] truncate max-w-[100px]">
                        {kw}
                      </span>
                    ))}
                    {entry.keywords.length > 3 && (
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">+{entry.keywords.length - 3}</span>
                    )}
                  </div>

                  {/* Importance */}
                  <div className="text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getImportanceColor(entry.importance)}`}>
                      {getImportanceLabel(entry.importance)}
                    </span>
                  </div>

                  {/* Embedding status */}
                  <div className="flex items-center justify-center">
                    {entry.embedding && entry.embedding.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-green-400">
                        <Brain size={10} />
                        {entry.embedding.length}d
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
                        <AlertCircle size={10} />
                        —
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedRowId(expandedRowId === entry.id ? null : entry.id); }}
                      className="p-1 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                    >
                      {expandedRowId === entry.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                      className={`p-1 rounded-md transition-colors ${
                        deleteConfirmId === entry.id
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-red-400'
                      }`}
                    >
                      {deleteConfirmId === entry.id ? <X size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail row */}
                {expandedRowId === entry.id && (
                  <div className="mx-3 mb-2 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)]">
                    {/* Summary */}
                    {entry.summary && (
                      <div className="mb-2">
                        <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase">{t('memory.summary')}:</span>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{entry.summary}</p>
                      </div>
                    )}
                    {/* Content preview */}
                    <div className="mb-2">
                      <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase">{t('memory.content')}:</span>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {entry.content.length > 500 ? entry.content.substring(0, 500) + '...' : entry.content}
                      </p>
                    </div>
                    {/* Tags */}
                    {entry.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase">{t('memory.tags')}:</span>
                        {entry.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-accent-main)]/10 text-[var(--color-accent-main)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !searchQuery && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border-light)] flex-shrink-0">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {t('memory.page', { page, totalPages }).replace('{page}', String(page)).replace('{totalPages}', String(totalPages))}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 text-[var(--color-text-tertiary)] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 text-[var(--color-text-tertiary)] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigToggle({ label, description, enabled, onToggle }: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm text-[var(--color-text-primary)]">{label}</div>
        <div className="text-[11px] text-[var(--color-text-tertiary)]">{description}</div>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
          enabled ? 'bg-[var(--color-accent-main)]' : 'bg-[var(--color-border-light)]'
        }`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  );
}
