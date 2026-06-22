import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Check, ChevronDown, X } from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { useTranslation } from '../../i18n';

interface FileSelectorProps {
  selectedFileIds: string[];
  onSelectionChange: (fileIds: string[]) => void;
}

export function FileSelector({ selectedFileIds, onSelectionChange }: FileSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const files = useFileStore(s => s.files);
  const loading = useFileStore(s => s.loading);
  const fetchFiles = useFileStore(s => s.fetchFiles);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors ${
          selectedCount > 0
            ? 'bg-[rgba(16,163,127,0.15)] text-[var(--color-accent-main)]'
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
        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border-light)] bg-[var(--color-main-surface-tertiary)] shadow-lg z-50">
          {loading ? (
            <div className="px-3 py-4 text-center text-xs text-[var(--color-text-tertiary)]">
              {t('common.loading')}
            </div>
          ) : readyFiles.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-[var(--color-text-tertiary)]">
              {t('files.noFileSelected')}
            </div>
          ) : (
            <>
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
      )}
    </div>
  );
}
