import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from '../../i18n';
import {
  ArrowLeft, Upload, FileText, File, FileCode, FileImage, FileArchive,
  Trash2, RefreshCw, Loader, CheckCircle2, AlertCircle,
  HardDrive, Clock, Layers
} from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import type { FileLibraryEntry } from '../../types';

interface FileBrowserProps {
  onClose: () => void;
}

export function FileBrowser({ onClose }: FileBrowserProps) {
  const { t } = useTranslation();
  const files = useFileStore(s => s.files);
  const loading = useFileStore(s => s.loading);
  const uploading = useFileStore(s => s.uploading);
  const fetchFiles = useFileStore(s => s.fetchFiles);
  const uploadFiles = useFileStore(s => s.uploadFiles);
  const deleteFile = useFileStore(s => s.deleteFile);
  const reindexFile = useFileStore(s => s.reindexFile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const fileArray = Array.from(fileList);
    setUploadProgress(fileArray.map(f => f.name));
    await uploadFiles(fileArray);
    setUploadProgress([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      const fileArray = Array.from(e.dataTransfer.files);
      setUploadProgress(fileArray.map(f => f.name));
      await uploadFiles(fileArray);
      setUploadProgress([]);
    }
  }, [uploadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDelete = async (file: FileLibraryEntry) => {
    if (deleteConfirmId === file.id) {
      await deleteFile(file.id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(file.id);
      // Auto-cancel after 3 seconds
      setTimeout(() => setDeleteConfirmId(prev => prev === file.id ? null : prev), 3000);
    }
  };

  const handleReindex = async (id: string) => {
    await reindexFile(id);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const getFileIcon = (mimeType: string, name: string) => {
    if (mimeType.startsWith('image/')) return <FileImage size={18} className="text-purple-400" />;
    if (mimeType === 'application/pdf') return <FileText size={18} className="text-red-400" />;
    if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('tar') || mimeType.includes('gz'))
      return <FileArchive size={18} className="text-yellow-400" />;
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript') ||
        mimeType.includes('python') || name.endsWith('.py') || name.endsWith('.js') || name.endsWith('.ts') ||
        name.endsWith('.java') || name.endsWith('.c') || name.endsWith('.cpp') || name.endsWith('.go') ||
        name.endsWith('.rs') || name.endsWith('.rb'))
      return <FileCode size={18} className="text-green-400" />;
    return <File size={18} className="text-blue-400" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-500/15 text-yellow-400">
            <Loader size={10} className="animate-spin" />
            {t('files.processing')}
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-500/15 text-green-400">
            <CheckCircle2 size={10} />
            {t('files.ready')}
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400">
            <AlertCircle size={10} />
            {t('files.error')}
          </span>
        );
      default:
        return null;
    }
  };

  // Stats
  const readyCount = files.filter(f => f.status === 'ready').length;
  const processingCount = files.filter(f => f.status === 'processing').length;
  const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);
  const totalChunks = files.reduce((sum, f) => sum + f.chunkCount, 0);

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
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('files.title')}</h2>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              {files.length > 0
                ? `${files.length} ${files.length === 1 ? 'file' : 'files'} · ${formatFileSize(totalSize)}`
                : t('files.noFilesHint')}
            </p>
          </div>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {uploading ? (
            <>
              <Loader size={15} className="animate-spin" />
              {t('files.uploading')}
            </>
          ) : (
            <>
              <Upload size={15} />
              {t('files.upload')}
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Stats bar */}
      {files.length > 0 && (
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
            <HardDrive size={13} />
            <span>{formatFileSize(totalSize)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
            <Layers size={13} />
            <span>{totalChunks} {t('files.chunks', { count: totalChunks }).replace(/[0-9]+\s*/, '')}</span>
          </div>
          {readyCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle2 size={13} />
              <span>{readyCount} {t('files.ready')}</span>
            </div>
          )}
          {processingCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-400">
              <Loader size={13} className="animate-spin" />
              <span>{processingCount} {t('files.processing')}</span>
            </div>
          )}
        </div>
      )}

      {/* Content area with drop zone */}
      <div
        className="flex-1 overflow-y-auto relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 bg-[var(--color-accent-main)]/10 border-2 border-dashed border-[var(--color-accent-main)] rounded-lg m-3 flex items-center justify-center">
            <div className="text-center">
              <Upload size={36} className="mx-auto mb-2 text-[var(--color-accent-main)]" />
              <p className="text-sm font-medium text-[var(--color-accent-main)]">{t('files.dropHere')}</p>
            </div>
          </div>
        )}

        {/* Upload progress indicator */}
        {uploadProgress.length > 0 && (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-[rgba(16,163,127,0.08)] border border-[var(--color-accent-main)]/20">
            <div className="flex items-center gap-2 text-sm text-[var(--color-accent-main)]">
              <Loader size={14} className="animate-spin" />
              <span>{t('files.uploading')} {uploadProgress.length} file(s)...</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader size={28} className="animate-spin mb-3 text-[var(--color-text-tertiary)]" />
            <span className="text-sm text-[var(--color-text-tertiary)]">{t('common.loading')}</span>
          </div>
        ) : files.length === 0 ? (
          /* Empty state - also acts as initial drop zone */
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <div className="w-20 h-20 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-5">
              <HardDrive size={36} className="text-[var(--color-text-tertiary)] opacity-50" />
            </div>
            <p className="text-base font-medium text-[var(--color-text-secondary)] mb-1">{t('files.noFiles')}</p>
            <p className="text-sm text-[var(--color-text-tertiary)] mb-6 text-center max-w-xs">
              {t('files.noFilesHint')}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--color-accent-main)] hover:opacity-90 text-white text-sm font-medium transition-colors"
            >
              <Upload size={16} />
              {t('files.upload')}
            </button>
          </div>
        ) : (
          /* File list - table style like cloud storage */
          <div className="px-3 py-2">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_100px_90px] gap-2 px-3 py-2 text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border-light)] mb-1">
              <span>{t('files.title')}</span>
              <span className="text-right">Size</span>
              <span className="text-center">Status</span>
              <span className="flex items-center gap-1"><Clock size={11} /> Date</span>
              <span className="text-right">Actions</span>
            </div>

            {/* File rows */}
            {files.map(file => (
              <div
                key={file.id}
                className="group grid grid-cols-[1fr_100px_100px_100px_90px] gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] transition-colors"
              >
                {/* Name + icon */}
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(file.mimeType, file.originalName)}
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--color-text-primary)] truncate" title={file.originalName}>
                      {file.originalName}
                    </div>
                    {file.status === 'ready' && file.chunkCount > 0 && (
                      <div className="text-[11px] text-[var(--color-text-tertiary)]">
                        {file.chunkCount} {t('files.chunks', { count: file.chunkCount }).replace(/[0-9]+\s*/, '')}
                      </div>
                    )}
                    {file.status === 'error' && file.errorMessage && (
                      <div className="text-[11px] text-red-400 truncate" title={file.errorMessage}>
                        {file.errorMessage}
                      </div>
                    )}
                  </div>
                </div>

                {/* Size */}
                <div className="text-xs text-[var(--color-text-tertiary)] text-right">
                  {formatFileSize(file.fileSize)}
                </div>

                {/* Status */}
                <div className="text-center">
                  {getStatusBadge(file.status)}
                </div>

                {/* Date */}
                <div className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1">
                  {formatDate(file.createdAt)}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(file.status === 'error' || file.status === 'processing') && (
                    <button
                      onClick={() => handleReindex(file.id)}
                      className="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-main)] transition-colors"
                      title={t('files.reindex')}
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(file)}
                    className={`p-1.5 rounded-md transition-colors ${
                      deleteConfirmId === file.id
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-red-400'
                    }`}
                    title={deleteConfirmId === file.id ? t('common.confirm') : t('files.delete')}
                  >
                    {deleteConfirmId === file.id ? <CheckCircle2 size={14} /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
