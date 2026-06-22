import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from '../../i18n';
import { Upload, FileText, Trash2, RefreshCw, Loader, CheckCircle, AlertCircle, X } from 'lucide-react';
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

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    await uploadFiles(Array.from(fileList));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  }, [uploadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDelete = async (file: FileLibraryEntry) => {
    if (confirm(t('files.deleteConfirm'))) {
      await deleteFile(file.id);
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

  const statusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <Loader size={14} className="animate-spin text-yellow-400" />;
      case 'ready': return <CheckCircle size={14} className="text-green-400" />;
      case 'error': return <AlertCircle size={14} className="text-red-400" />;
      default: return null;
    }
  };

  const statusText = (status: string) => {
    switch (status) {
      case 'processing': return t('files.processing');
      case 'ready': return t('files.ready');
      case 'error': return t('files.error');
      default: return status;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--color-bg-primary)] border border-[var(--color-border-light)] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-light)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('files.title')}</h2>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Upload area */}
        <div className="px-5 pt-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-[var(--color-accent-main)] bg-[rgba(16,163,127,0.08)]'
                : 'border-[var(--color-border-light)] hover:border-[var(--color-accent-main)] hover:bg-[var(--color-bg-secondary)]'
            }`}
          >
            <Upload size={28} className="mx-auto mb-2 text-[var(--color-text-tertiary)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              {uploading ? t('files.uploading') : t('files.dropHere')}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{t('files.dropHereHint')}</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="text-center py-8 text-[var(--color-text-tertiary)]">
              <Loader size={24} className="animate-spin mx-auto mb-2" />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={40} className="mx-auto mb-3 text-[var(--color-text-tertiary)] opacity-40" />
              <p className="text-sm text-[var(--color-text-secondary)]">{t('files.noFiles')}</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{t('files.noFilesHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-sidebar-surface-hover)] transition-colors"
                >
                  <FileText size={18} className="text-[var(--color-text-tertiary)] flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--color-text-primary)] truncate">{file.originalName}</div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] mt-0.5">
                      <span>{formatFileSize(file.fileSize)}</span>
                      {file.status === 'ready' && (
                        <span>{t('files.chunks', { count: file.chunkCount })}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      {statusIcon(file.status)}
                      <span className={`${
                        file.status === 'ready' ? 'text-green-400' :
                        file.status === 'error' ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {statusText(file.status)}
                      </span>
                    </div>

                    {file.status === 'error' && (
                      <button
                        onClick={() => handleReindex(file.id)}
                        className="p-1 rounded hover:bg-[var(--color-bg-primary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-main)] transition-colors"
                        title={t('files.reindex')}
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(file)}
                      className="p-1 rounded hover:bg-[var(--color-bg-primary)] text-[var(--color-text-tertiary)] hover:text-red-400 transition-colors"
                      title={t('files.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
