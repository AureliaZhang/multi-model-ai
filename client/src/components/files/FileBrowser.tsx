import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from '../../i18n';
import {
  ArrowLeft, Upload, FileText, File, FileCode, FileImage, FileArchive,
  Trash2, RefreshCw, Loader, CheckCircle2, AlertCircle,
  HardDrive, Clock, Layers, FolderPlus, Folder, ChevronRight,
  FolderOpen, Edit2, X, Lock, Users
} from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { useAuthStore } from '../../stores/authStore';
import type { FileLibraryEntry, FileFolder } from '../../types';

interface FileBrowserProps {
  onClose: () => void;
}

export function FileBrowser({ onClose }: FileBrowserProps) {
  const { t } = useTranslation();
  const files = useFileStore(s => s.files);
  const folders = useFileStore(s => s.folders);
  const currentFolderId = useFileStore(s => s.currentFolderId);
  const breadcrumb = useFileStore(s => s.breadcrumb);
  const loading = useFileStore(s => s.loading);
  const uploading = useFileStore(s => s.uploading);
  const uploadFiles = useFileStore(s => s.uploadFiles);
  const deleteFile = useFileStore(s => s.deleteFile);
  const reindexFile = useFileStore(s => s.reindexFile);
  const createFolder = useFileStore(s => s.createFolder);
  const deleteFolder = useFileStore(s => s.deleteFolder);
  const renameFolder = useFileStore(s => s.renameFolder);
  const navigateToFolder = useFileStore(s => s.navigateToFolder);
  const scope = useFileStore(s => s.scope);
  const setScope = useFileStore(s => s.setScope);
  const setVisibility = useFileStore(s => s.setVisibility);
  const user = useAuthStore(s => s.user);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteFolderConfirmId, setDeleteFolderConfirmId] = useState<string | null>(null);

  // Create folder dialog
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename folder inline
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    navigateToFolder(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // File upload (individual files)
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const fileArray = Array.from(fileList);
    setUploadProgress(fileArray.map(f => f.name));
    await uploadFiles(fileArray);
    setUploadProgress([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadFiles]);

  // Folder upload (webkitdirectory)
  const handleFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const fileArray = Array.from(fileList);
    setUploadProgress(fileArray.map(f => f.name));
    await uploadFiles(fileArray);
    setUploadProgress([]);
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, [uploadFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles: File[] = [];

    // Handle both files and directory drops
    const items = e.dataTransfer.items;
    if (items) {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }

      if (entries.length > 0) {
        // Process entries recursively for directories
        const processEntry = async (entry: FileSystemEntry): Promise<File[]> => {
          if (entry.isFile) {
            return new Promise((resolve) => {
              (entry as FileSystemFileEntry).file((file) => resolve([file]));
            });
          } else if (entry.isDirectory) {
            const dirReader = (entry as FileSystemDirectoryEntry).createReader();
            return new Promise((resolve) => {
              dirReader.readEntries(async (entries) => {
                const files: File[] = [];
                for (const e of entries) {
                  files.push(...await processEntry(e));
                }
                resolve(files);
              });
            });
          }
          return [];
        };

        for (const entry of entries) {
          droppedFiles.push(...await processEntry(entry));
        }
      }
    }

    if (droppedFiles.length === 0 && e.dataTransfer.files.length > 0) {
      droppedFiles.push(...Array.from(e.dataTransfer.files));
    }

    if (droppedFiles.length > 0) {
      setUploadProgress(droppedFiles.map(f => f.name));
      await uploadFiles(droppedFiles);
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
      setTimeout(() => setDeleteConfirmId(prev => prev === file.id ? null : prev), 3000);
    }
  };

  const handleDeleteFolder = async (folder: FileFolder) => {
    if (deleteFolderConfirmId === folder.id) {
      await deleteFolder(folder.id);
      setDeleteFolderConfirmId(null);
    } else {
      setDeleteFolderConfirmId(folder.id);
      setTimeout(() => setDeleteFolderConfirmId(prev => prev === folder.id ? null : prev), 3000);
    }
  };

  const handleReindex = async (id: string) => {
    await reindexFile(id);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setNewFolderName('');
    setShowCreateFolder(false);
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!renameValue.trim()) return;
    await renameFolder(folderId, renameValue.trim());
    setRenamingFolderId(null);
    setRenameValue('');
  };

  const handleFolderDoubleClick = (folder: FileFolder) => {
    navigateToFolder(folder.id);
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

  // Visibility badge + (for own files / admin) a click-to-toggle private⇄team.
  const canChangeVisibility = (file: FileLibraryEntry) =>
    user?.role === 'admin' || (file.uploadedBy != null && file.uploadedBy === user?.id);

  const renderVisibility = (file: FileLibraryEntry) => {
    const isTeam = file.visibility === 'team';
    const Icon = isTeam ? Users : Lock;
    const label = isTeam ? t('files.visTeam') : t('files.visPrivate');
    if (!canChangeVisibility(file)) {
      return (
        <span
          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]"
          title={label}
        >
          <Icon size={11} /> {label}
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setVisibility(file.id, isTeam ? 'private' : 'team')}
        title={isTeam ? t('files.makePrivate') : t('files.makeTeam')}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors ${
          isTeam
            ? 'text-[var(--color-accent-main)] hover:bg-[var(--overlay-5)]'
            : 'text-[var(--color-text-tertiary)] hover:bg-[var(--overlay-5)] hover:text-[var(--color-text-secondary)]'
        }`}
      >
        <Icon size={11} /> {label}
      </button>
    );
  };

  // Stats (current folder files only)
  const readyCount = files.filter(f => f.status === 'ready').length;
  const processingCount = files.filter(f => f.status === 'processing').length;
  const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);
  const totalChunks = files.reduce((sum, f) => sum + f.chunkCount, 0);
  const isEmpty = files.length === 0 && folders.length === 0;

  return (
    <div className="h-full flex flex-col bg-[var(--color-main-surface-primary)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-light)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label={t('common.back')}
            className="p-1.5 rounded-lg hover:bg-[var(--overlay-5)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('files.title')}</h2>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              {!isEmpty
                ? `${folders.length + files.length} ${folders.length + files.length === 1 ? 'item' : 'items'} · ${formatFileSize(totalSize)}`
                : t('files.noFilesHint')}
            </p>
          </div>
        </div>

        {/* Uploads / folder creation only in the "mine" view (new files are private;
            the team view is a flat read-only listing of what's been shared). */}
        {scope === 'mine' && (
        <div className="flex items-center gap-2">
          {/* New Folder button */}
          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--overlay-5)] text-[var(--color-text-secondary)] text-sm font-medium transition-colors"
          >
            <FolderPlus size={15} />
            {t('files.newFolder')}
          </button>

          {/* Upload Folder button */}
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--overlay-5)] disabled:opacity-50 text-[var(--color-text-secondary)] text-sm font-medium transition-colors"
          >
            <FolderOpen size={15} />
            {t('files.uploadFolder')}
          </button>

          {/* Upload Files button */}
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
        </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is not in standard types
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          className="hidden"
        />
      </div>

      {/* Scope tabs: my files (browsable by folder) vs the flat team-shared list */}
      <div className="flex items-center gap-1 px-5 pt-2.5 border-b border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] flex-shrink-0">
        <button
          onClick={() => setScope('mine')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            scope === 'mine'
              ? 'border-[var(--color-accent-main)] text-[var(--color-text-primary)]'
              : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Lock size={14} />
          {t('files.scopeMine')}
        </button>
        <button
          onClick={() => setScope('team')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            scope === 'team'
              ? 'border-[var(--color-accent-main)] text-[var(--color-text-primary)]'
              : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Users size={14} />
          {t('files.scopeTeam')}
        </button>
      </div>

      {/* Breadcrumb navigation (only meaningful in the folder-browsable "mine" view) */}
      {scope === 'mine' && (
      <div className="flex items-center gap-1 px-5 py-2 border-b border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] flex-shrink-0 text-sm">
        <button
          onClick={() => navigateToFolder(null)}
          className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--overlay-5)] transition-colors ${
            !currentFolderId ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <HardDrive size={14} />
          {t('files.title')}
        </button>
        {breadcrumb.map((item, idx) => (
          <span key={item.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-[var(--color-text-tertiary)]" />
            <button
              onClick={() => navigateToFolder(item.id)}
              className={`px-2 py-1 rounded hover:bg-[var(--overlay-5)] transition-colors ${
                idx === breadcrumb.length - 1 ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {item.name}
            </button>
          </span>
        ))}
      </div>
      )}

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
          <div className="mx-5 mt-3 p-3 rounded-lg bg-[var(--accent-tint-8)] border border-[var(--color-accent-main)]/20">
            <div className="flex items-center gap-2 text-sm text-[var(--color-accent-main)]">
              <Loader size={14} className="animate-spin" />
              <span>{t('files.uploading')} {uploadProgress.length} file(s)...</span>
            </div>
          </div>
        )}

        {/* Create folder dialog */}
        {showCreateFolder && (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)]">
            <div className="flex items-center gap-2">
              <Folder size={16} className="text-yellow-400 flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowCreateFolder(false); setNewFolderName(''); } }}
                placeholder={t('files.folderNamePlaceholder')}
                className="flex-1 px-2 py-1 rounded bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-main)]"
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-3 py-1 rounded bg-[var(--color-accent-main)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium transition-colors"
              >
                {t('common.confirm')}
              </button>
              <button
                onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}
                className="p-1 rounded hover:bg-[var(--overlay-5)] text-[var(--color-text-tertiary)]"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader size={28} className="animate-spin mb-3 text-[var(--color-text-tertiary)]" />
            <span className="text-sm text-[var(--color-text-tertiary)]">{t('common.loading')}</span>
          </div>
        ) : isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <div className="w-20 h-20 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-5">
              <HardDrive size={36} className="text-[var(--color-text-tertiary)] opacity-50" />
            </div>
            <p className="text-base font-medium text-[var(--color-text-secondary)] mb-1">{t('files.noFiles')}</p>
            <p className="text-sm text-[var(--color-text-tertiary)] mb-6 text-center max-w-xs">
              {t('files.noFilesHint')}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateFolder(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--overlay-5)] text-[var(--color-text-secondary)] text-sm font-medium transition-colors"
              >
                <FolderPlus size={16} />
                {t('files.newFolder')}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--color-accent-main)] hover:opacity-90 text-white text-sm font-medium transition-colors"
              >
                <Upload size={16} />
                {t('files.upload')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2 px-3 py-2">
              {folders.map(folder => (
                <div
                  key={folder.id}
                  className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-main-surface-secondary)] p-3"
                  onDoubleClick={() => handleFolderDoubleClick(folder)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Folder size={18} className="text-yellow-400 flex-shrink-0" />
                      {renamingFolderId === folder.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') { setRenamingFolderId(null); setRenameValue(''); } }}
                          onBlur={() => handleRenameFolder(folder.id)}
                          className="flex-1 px-1.5 py-0.5 rounded bg-[var(--color-main-surface-primary)] border border-[var(--color-accent-main)] text-sm outline-none"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <div className="min-w-0">
                          <div className="text-sm text-[var(--color-text-primary)] truncate">{folder.name}</div>
                          <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                            {t('files.folder')} · {formatDate(folder.createdAt)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenamingFolderId(folder.id); setRenameValue(folder.name); }}
                        className="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]"
                        title={t('files.renameFolder')}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                        className={`p-1.5 rounded-md ${
                          deleteFolderConfirmId === folder.id
                            ? 'bg-red-500/20 text-red-400'
                            : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-red-400'
                        }`}
                        title={deleteFolderConfirmId === folder.id ? t('common.confirm') : t('files.deleteFolder')}
                      >
                        {deleteFolderConfirmId === folder.id ? <CheckCircle2 size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {files.map(file => (
                <div
                  key={file.id}
                  className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-main-surface-secondary)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getFileIcon(file.mimeType, file.originalName)}
                      <div className="min-w-0">
                        <div className="text-sm text-[var(--color-text-primary)] truncate">{file.originalName}</div>
                        <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span>·</span>
                          <span>{formatDate(file.createdAt)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          {getStatusBadge(file.status)}
                          {renderVisibility(file)}
                        </div>
                        {file.status === 'error' && file.errorMessage && (
                          <div className="text-[11px] text-red-400 mt-1 truncate">{file.errorMessage}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(file.status === 'error' || file.status === 'processing') && (
                        <button
                          onClick={() => handleReindex(file.id)}
                          className="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]"
                          title={t('files.reindex')}
                        >
                          <RefreshCw size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(file)}
                        className={`p-1.5 rounded-md ${
                          deleteConfirmId === file.id
                            ? 'bg-red-500/20 text-red-400'
                            : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-red-400'
                        }`}
                        title={deleteConfirmId === file.id ? t('common.confirm') : t('files.delete')}
                      >
                        {deleteConfirmId === file.id ? <CheckCircle2 size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block px-3 py-2 overflow-x-auto">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_100px_90px] gap-2 px-3 py-2 text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border-light)] mb-1 min-w-[620px]">
              <span>{t('files.title')}</span>
              <span className="text-right">{t('files.colSize')}</span>
              <span className="text-center">{t('files.colStatus')}</span>
              <span className="flex items-center gap-1"><Clock size={11} /> {t('files.colDate')}</span>
              <span className="text-right">{t('files.colActions')}</span>
            </div>

            {/* Folder rows */}
            {folders.map(folder => (
              <div
                key={folder.id}
                className="group grid grid-cols-[1fr_100px_100px_100px_90px] gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] transition-colors min-w-[620px] cursor-pointer"
                onDoubleClick={() => handleFolderDoubleClick(folder)}
              >
                {/* Folder name + icon */}
                <div className="flex items-center gap-3 min-w-0">
                  <Folder size={18} className="text-yellow-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    {renamingFolderId === folder.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') { setRenamingFolderId(null); setRenameValue(''); } }}
                          onBlur={() => handleRenameFolder(folder.id)}
                          className="flex-1 px-1.5 py-0.5 rounded bg-[var(--color-main-surface-primary)] border border-[var(--color-accent-main)] text-sm text-[var(--color-text-primary)] outline-none"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--color-text-primary)] truncate" title={folder.name}>
                        {folder.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Size (folders don't show size) */}
                <div className="text-xs text-[var(--color-text-tertiary)] text-right">—</div>

                {/* Status (folders show as folder) */}
                <div className="text-center">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-500/10 text-yellow-400">
                    <Folder size={10} />
                    {t('files.folder')}
                  </span>
                </div>

                {/* Date */}
                <div className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1">
                  {formatDate(folder.createdAt)}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingFolderId(folder.id);
                      setRenameValue(folder.name);
                    }}
                    className="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-main)] transition-colors"
                    title={t('files.renameFolder')}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder);
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      deleteFolderConfirmId === folder.id
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-red-400'
                    }`}
                    title={deleteFolderConfirmId === folder.id ? t('common.confirm') : t('files.deleteFolder')}
                  >
                    {deleteFolderConfirmId === folder.id ? <CheckCircle2 size={14} /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}

            {/* File rows */}
            {files.map(file => (
              <div
                key={file.id}
                className="group grid grid-cols-[1fr_100px_100px_100px_90px] gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-[var(--color-sidebar-surface-hover)] transition-colors min-w-[620px]"
              >
                {/* Name + icon */}
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(file.mimeType, file.originalName)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm text-[var(--color-text-primary)] truncate" title={file.originalName}>
                        {file.originalName}
                      </span>
                      {renderVisibility(file)}
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
          </>
        )}
      </div>
    </div>
  );
}
