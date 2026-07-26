import { useState, useEffect, useRef, useCallback } from 'react';
import { FolderOpen, Check, ChevronDown, X, ChevronRight, Folder } from 'lucide-react';
import { fileApi } from '../../services/api';
import { useTranslation } from '../../i18n';
import type { FileLibraryEntry, FileFolder } from '../../types';

interface FileSelectorProps {
  selectedFileIds: string[];
  onSelectionChange: (fileIds: string[]) => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function FileSelector({ selectedFileIds, onSelectionChange }: FileSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileLibraryEntry[]>([]);
  const [folders, setFolders] = useState<FileFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const fetchFilesAndFolders = useCallback(async (folderId?: string | null) => {
    setLoading(true);
    try {
      const res = await fileApi.list({ limit: 200, folderId: folderId || undefined });
      if (res.success && res.data) {
        setFolders(res.data.folders || []);
        setFiles(res.data.files);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch files when dropdown opens or folder changes
  useEffect(() => {
    if (isOpen) {
      fetchFilesAndFolders(currentFolderId);
    }
  }, [isOpen, currentFolderId, fetchFilesAndFolders]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigateToFolder = async (folderId: string, _folderName: string) => {
    setBreadcrumb(prev => [...prev, { id: currentFolderId || 'root', name: breadcrumb.length === 0 ? t('files.title') : (breadcrumb[breadcrumb.length - 1]?.name || '') }]);
    setCurrentFolderId(folderId);
    // Fetch breadcrumb path from API
    try {
      const pathRes = await fileApi.folders.getPath(folderId);
      if (pathRes.success && pathRes.data) {
        setBreadcrumb(pathRes.data);
      }
    } catch {
      // keep existing breadcrumb
    }
  };

  const navigateUp = (targetFolderId: string | null) => {
    setCurrentFolderId(targetFolderId);
    if (targetFolderId === null) {
      setBreadcrumb([]);
    } else {
      // Trim breadcrumb to the target level
      const idx = breadcrumb.findIndex(b => b.id === targetFolderId);
      if (idx >= 0) {
        setBreadcrumb(breadcrumb.slice(0, idx));
      }
    }
  };

  const readyFiles = files.filter(f => f.status === 'ready');
  const selectedCount = selectedFileIds.length;

  const toggleFile = (fileId: string) => {
    if (selectedFileIds.includes(fileId)) {
      onSelectionChange(selectedFileIds.filter(id => id !== fileId));
    } else {
      onSelectionChange([...selectedFileIds, fileId]);
    }
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange([]);
  };

  const handleToggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Reset to root when opening
      setCurrentFolderId(null);
      setBreadcrumb([]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggleOpen}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors ${
          selectedCount > 0
            ? 'bg-[var(--accent-tint-15)] text-[var(--color-accent-main)]'
            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
        }`}
        title={t('files.selectFilesForChat')}
      >
        <FolderOpen size={11} />
        <span>
          {selectedCount > 0
            ? t('files.selectedFiles', { count: selectedCount })
            : t('files.selectFiles')}
        </span>
        {selectedCount > 0 ? (
          <X size={10} className="ml-0.5 hover:text-[var(--color-text-secondary)]" onClick={clearSelection} />
        ) : (
          <ChevronDown size={10} className="ml-0.5" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-80 max-h-80 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-main-surface-tertiary)] shadow-lg z-50 flex flex-col">
          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--color-border-light)] text-[10px] text-[var(--color-text-tertiary)] overflow-x-auto flex-shrink-0">
            <button
              onClick={() => navigateUp(null)}
              className={`hover:text-[var(--color-text-secondary)] transition-colors flex-shrink-0 px-1 py-0.5 rounded ${
                currentFolderId === null ? 'text-[var(--color-accent-main)] font-medium' : ''
              }`}
            >
              {t('files.title')}
            </button>
            {breadcrumb.map((item) => (
              <span key={item.id} className="flex items-center gap-0.5 flex-shrink-0">
                <ChevronRight size={10} className="opacity-50" />
                <button
                  onClick={() => navigateUp(item.id)}
                  className="hover:text-[var(--color-text-secondary)] transition-colors px-1 py-0.5 rounded truncate max-w-[100px]"
                >
                  {item.name}
                </button>
              </span>
            ))}
          </div>

          {/* File/folder list */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {loading ? (
              <div className="px-3 py-4 text-center text-xs text-[var(--color-text-tertiary)]">
                {t('common.loading')}
              </div>
            ) : folders.length === 0 && readyFiles.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[var(--color-text-tertiary)]">
                {t('files.noFileSelected')}
              </div>
            ) : (
              <>
                {/* Folders */}
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => navigateToFolder(folder.id, folder.name)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--color-sidebar-surface-hover)] text-[var(--color-text-secondary)]"
                  >
                    <Folder size={14} className="text-[var(--color-accent-main)] flex-shrink-0" />
                    <span className="truncate flex-1">{folder.name}</span>
                    <ChevronRight size={12} className="text-[var(--color-text-tertiary)] flex-shrink-0" />
                  </button>
                ))}

                {/* Files */}
                {readyFiles.map(file => {
                  const isSelected = selectedFileIds.includes(file.id);
                  return (
                    <button
                      key={file.id}
                      onClick={() => toggleFile(file.id)}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--color-sidebar-surface-hover)] ${
                        isSelected ? 'text-[var(--color-accent-main)]' : 'text-[var(--color-text-secondary)]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-accent-main)] border-[var(--color-accent-main)]'
                          : 'border-[var(--color-border-light)]'
                      }`}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <span className="truncate flex-1">{file.originalName}</span>
                      <span className="text-[var(--color-text-tertiary)] flex-shrink-0">
                        {t('files.chunks', { count: file.chunkCount })}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Selection summary */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--color-border-light)] text-[10px] flex-shrink-0">
              <span className="text-[var(--color-accent-main)]">
                {t('files.selectedFiles', { count: selectedCount })}
              </span>
              <button
                onClick={() => onSelectionChange([])}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                {t('files.clearSelection')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
