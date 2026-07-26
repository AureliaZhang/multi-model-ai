import { useEffect, useRef, useState, useCallback } from 'react';
import {
  BookOpen, Search, Upload, X, Loader2, RefreshCw, Download, Tag, FileText, AlertCircle, Link2,
} from 'lucide-react';
import { fileApi } from '../../services/api';
import type { FileLibraryEntry } from '../../types';
import { useTranslation } from '../../i18n';
import { MarkdownMessage } from '../common/MarkdownMessage';

/**
 * Team knowledge base (v0.7.65). Everyone can view + upload; only the uploader
 * or an admin can delete (enforced server-side). Uploads are team-visible by
 * definition and get an automatic AI digest: doc type + keywords + summary —
 * the searchable layer over long policy documents and crawled material.
 */
export function KnowledgeBasePanel() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<FileLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [docType, setDocType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [detail, setDetail] = useState<{ file: FileLibraryEntry; markdown: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // URL import (v0.7.67)
  const [showUrl, setShowUrl] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlError, setUrlError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  const load = useCallback(async (q: string, type: string) => {
    setLoading(true);
    try {
      const res = await fileApi.list({ scope: 'kb', limit: 200, q: q || undefined, docType: type || undefined });
      if (res.success && res.data) setEntries(res.data.files);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search; also the initial load (empty query).
  useEffect(() => {
    const timer = setTimeout(() => { void load(trimmed, docType); }, 250);
    return () => clearTimeout(timer);
  }, [trimmed, docType, load]);

  // While any doc is still processing / digesting, poll so cards update live.
  useEffect(() => {
    const busy = entries.some((e) => e.status === 'processing' || e.summaryStatus === 'pending');
    if (!busy) return;
    const timer = setTimeout(() => { void load(trimmed, docType); }, 4000);
    return () => clearTimeout(timer);
  }, [entries, trimmed, docType, load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    try {
      await fileApi.upload(files, null, true);
      await load(trimmed, docType);
    } finally {
      setUploading(false);
    }
  };

  const importUrl = async () => {
    const url = urlValue.trim();
    if (!url) return;
    setUrlBusy(true);
    setUrlError('');
    try {
      const res = await fileApi.importUrl(url);
      if (res.success) {
        setUrlValue('');
        setShowUrl(false);
        await load(trimmed, docType);
      } else {
        setUrlError(res.error || t('files.kbUrlFailed'));
      }
    } finally {
      setUrlBusy(false);
    }
  };

  const openDetail = async (entry: FileLibraryEntry) => {
    setDetailLoading(true);
    try {
      const res = await fileApi.reading(entry.id);
      if (res.success && res.data) setDetail(res.data);
    } finally {
      setDetailLoading(false);
    }
  };

  const regenerate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fileApi.summarize(id);
      if (res.success && res.data) {
        setEntries((prev) => prev.map((f) => (f.id === id ? res.data! : f)));
        if (detail?.file.id === id) setDetail({ ...detail, file: res.data });
      }
    } finally {
      setBusyId(null);
    }
  };

  const types = Array.from(new Set(entries.map((e) => e.docType).filter((x): x is string => !!x))).sort();

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Toolbar: search + type filter + upload */}
      <div className="px-5 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('files.kbSearch')}
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-accent-main)]"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)]" aria-label={t('common.cancel')}>
                <X size={13} />
              </button>
            )}
          </div>
          <span className="text-xs text-[var(--color-text-tertiary)] hidden sm:inline">{t('files.kbCount', { count: entries.length })}</span>
          <button
            onClick={() => { setShowUrl((v) => !v); setUrlError(''); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--button-secondary-bg)] hover:bg-[var(--button-secondary-hover)] text-[var(--color-text-secondary)] text-[13px] transition-colors"
            aria-expanded={showUrl}
          >
            <Link2 size={14} />
            {t('files.kbFromUrl')}
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white text-[13px] disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {t('files.kbUpload')}
          </button>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>
        {showUrl && (
          <div className="flex items-center gap-2">
            <input
              value={urlValue}
              onChange={(e) => { setUrlValue(e.target.value); setUrlError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void importUrl(); if (e.key === 'Escape') setShowUrl(false); }}
              placeholder={t('files.kbUrlPlaceholder')}
              className="flex-1 max-w-xl px-3 py-2 rounded-lg bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-accent-main)]"
              autoFocus
            />
            <button
              onClick={() => void importUrl()}
              disabled={urlBusy || !urlValue.trim()}
              className="px-3 py-2 rounded-lg bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white text-[13px] disabled:opacity-50 transition-colors"
            >
              {urlBusy ? <Loader2 size={14} className="animate-spin" /> : t('files.kbUrlImport')}
            </button>
            {urlError && <span className="text-[11px] text-[var(--color-text-error)] truncate max-w-[240px]" title={urlError}>{urlError}</span>}
          </div>
        )}
        <p className="text-[11px] text-[var(--color-text-tertiary)]">{t('files.kbUploadHint')}</p>
        {types.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setDocType('')}
              className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${docType === '' ? 'bg-[var(--accent-tint-15)] border-[var(--color-accent-main)] text-[var(--color-accent-main)]' : 'border-[var(--color-border-light)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}`}
            >
              {t('files.kbAllTypes')}
            </button>
            {types.map((ty) => (
              <button
                key={ty}
                onClick={() => setDocType(docType === ty ? '' : ty)}
                className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${docType === ty ? 'bg-[var(--accent-tint-15)] border-[var(--color-accent-main)] text-[var(--color-accent-main)]' : 'border-[var(--color-border-light)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}`}
              >
                {ty}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="p-4 sm:p-5">
        {loading && entries.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-tertiary)] text-sm">{t('common.loading')}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-14 text-[var(--color-text-tertiary)]">
            <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">{trimmed || docType ? t('files.kbNoResults') : t('files.kbEmpty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {entries.map((f) => (
              <div key={f.id} className="p-4 rounded-2xl bg-[var(--color-main-surface-secondary)] border border-[var(--color-border-light)] flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <FileText size={16} className="text-[var(--color-accent-main)] flex-shrink-0 mt-0.5" />
                  <span className="text-[13px] font-medium text-[var(--color-text-primary)] flex-1 min-w-0 break-all">{f.originalName}</span>
                  {f.docType && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--accent-tint-12)] text-[var(--color-accent-main)] flex-shrink-0">{f.docType}</span>
                  )}
                </div>

                {f.status === 'processing' ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]"><Loader2 size={11} className="animate-spin" /> {t('files.kbProcessing')}</div>
                ) : f.summaryStatus === 'pending' ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]"><Loader2 size={11} className="animate-spin" /> {t('files.kbDigestPending')}</div>
                ) : f.summaryStatus === 'error' ? (
                  <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-error)]">
                    <AlertCircle size={11} /> {t('files.kbDigestError')}
                    <button onClick={() => void regenerate(f.id)} disabled={busyId === f.id} className="underline hover:opacity-70 disabled:opacity-40">
                      {busyId === f.id ? '…' : t('files.kbRetry')}
                    </button>
                  </div>
                ) : f.summary ? (
                  <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">{f.summary}</p>
                ) : null}

                {(f.aiKeywords?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Tag size={10} className="text-[var(--color-text-tertiary)]" />
                    {f.aiKeywords!.slice(0, 6).map((k) => (
                      <button key={k} onClick={() => setQuery(k)} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--overlay-6)] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-main)] transition-colors">
                        {k}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-auto pt-1">
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">{new Date(f.createdAt).toLocaleDateString()}</span>
                  <span className="flex-1" />
                  <button
                    onClick={() => void openDetail(f)}
                    disabled={f.status !== 'ready'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] bg-[var(--button-secondary-bg)] hover:bg-[var(--button-secondary-hover)] text-[var(--color-text-secondary)] disabled:opacity-40 transition-colors"
                  >
                    <BookOpen size={11} /> {t('files.kbRead')}
                  </button>
                  <button
                    onClick={() => void fileApi.downloadOriginal(f.id, f.originalName)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] bg-[var(--button-secondary-bg)] hover:bg-[var(--button-secondary-hover)] text-[var(--color-text-secondary)] transition-colors"
                  >
                    <Download size={11} /> {t('files.kbOriginal')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reading overlay */}
      {(detail || detailLoading) && (
        <div role="dialog" aria-modal="true" aria-label={detail?.file.originalName || ''} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 sm:p-6">
          <div className="w-full max-w-3xl max-h-full flex flex-col rounded-2xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] shadow-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--color-border-light)] flex-shrink-0">
              <FileText size={16} className="text-[var(--color-accent-main)] flex-shrink-0" />
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex-1 min-w-0 truncate">{detail?.file.originalName || t('common.loading')}</h2>
              {detail?.file.docType && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--accent-tint-12)] text-[var(--color-accent-main)]">{detail.file.docType}</span>
              )}
              <button onClick={() => setDetail(null)} aria-label={t('common.cancel')} className="p-1.5 rounded-lg hover:bg-[var(--overlay-8)] text-[var(--color-text-tertiary)]">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {detail && (
                <>
                  {detail.file.summary && (
                    <div className="mb-4 p-3.5 rounded-xl bg-[var(--accent-tint-8)] border border-[var(--color-accent-main)]/20">
                      <div className="text-[11px] font-medium text-[var(--color-accent-main)] mb-1">{t('files.kbSummary')}</div>
                      <p className="text-[13px] text-[var(--color-text-primary)] leading-relaxed">{detail.file.summary}</p>
                      {(detail.file.aiKeywords?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-2">
                          {detail.file.aiKeywords!.map((k) => (
                            <span key={k} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--overlay-8)] text-[var(--color-text-secondary)]">{k}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="markdown-content">
                    <MarkdownMessage content={detail.markdown} />
                  </div>
                </>
              )}
              {!detail && detailLoading && (
                <div className="text-center py-10 text-[var(--color-text-tertiary)] text-sm">{t('common.loading')}</div>
              )}
            </div>

            {detail && (
              <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--color-border-light)] flex-shrink-0">
                <button
                  onClick={() => void fileApi.downloadOriginal(detail.file.id, detail.file.originalName)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[var(--button-secondary-bg)] hover:bg-[var(--button-secondary-hover)] text-[var(--color-text-secondary)] transition-colors"
                >
                  <Download size={12} /> {t('files.kbOriginal')}
                </button>
                <span className="flex-1" />
                <button
                  onClick={() => void regenerate(detail.file.id)}
                  disabled={busyId === detail.file.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] disabled:opacity-40 transition-colors"
                >
                  {busyId === detail.file.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  {t('files.kbRegenerate')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
