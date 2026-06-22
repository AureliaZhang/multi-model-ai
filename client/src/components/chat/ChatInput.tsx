import { useState, useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useModelStore } from '../../stores/modelStore';
import { Send, Paperclip, Square, LogIn, X, FileIcon, Globe, Lock, Eye, EyeOff } from 'lucide-react';
import type { PendingAttachment } from '../../types';
import { useTranslation } from '../../i18n';
import { FileSelector } from '../files/FileSelector';
import { fileApi } from '../../services/api';

interface ChatInputProps {
  isGuest?: boolean;
  onSignIn?: () => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv',
  'application/json', 'text/markdown',
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatInput({ isGuest = false, onSignIn }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const sendMessage = useChatStore(s => s.sendMessage);
  const stopStreaming = useChatStore(s => s.stopStreaming);
  const isStreaming = useChatStore(s => s.isStreaming);
  const models = useModelStore(s => s.models);
  const currentConversationId = useChatStore(s => s.currentConversationId);
  const currentVisibility = useChatStore(s => s.currentVisibility);
  const currentSelfReview = useChatStore(s => s.currentSelfReview);
  const updateConversation = useChatStore(s => s.updateConversation);
  const setVisibility = useChatStore(s => s.setVisibility);
  const setSelfReview = useChatStore(s => s.setSelfReview);
  const { t } = useTranslation();

  const [selectedModel, _setSelectedModel] = useState(() => localStorage.getItem('selected_model') || '');

  useEffect(() => {
    return () => {
      attachments.forEach(a => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const newAttachments: PendingAttachment[] = [];
    const filesToBackup: File[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`"${file.name}" 超过 20MB 限制。`);
        continue;
      }

      const base64 = await fileToBase64(file);
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

      newAttachments.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl,
        base64,
      });

      // Auto-backup non-image files to file library
      if (!file.type.startsWith('image/')) {
        filesToBackup.push(file);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);

    // Upload non-image files to file library in background
    if (filesToBackup.length > 0) {
      fileApi.upload(filesToBackup).catch(() => {
        // Silently fail - backup is best-effort
      });
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  }, []);

  const handleSend = useCallback(() => {
    if (isGuest) return;
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isStreaming) return;

    const model = selectedModel || models[0]?.normalizedName;
    if (!model) {
      alert(t('model.noModels') + ' ' + t('model.addStationFirst'));
      return;
    }

    sendMessage(
      trimmed || '(File attachment)',
      model,
      attachments.length > 0 ? attachments : undefined,
      selectedFileIds.length > 0 ? selectedFileIds : undefined,
    );
    setInput('');
    setAttachments([]);
    setSelectedFileIds([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, selectedModel, models, sendMessage, isGuest, attachments, t]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      processFiles(imageFiles);
    }
  }, [processFiles]);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  if (isGuest) {
    return (
      <div className="px-3 sm:px-5 pb-4 pt-2 w-full">
        <div className="w-full">
          <div className="relative flex items-center justify-center bg-[var(--composer-bg)] rounded-3xl overflow-hidden py-4 px-6">
            <div className="flex items-center gap-3 text-[var(--color-text-tertiary)]">
              <LogIn size={18} />
              <button
                onClick={onSignIn}
                className="text-sm hover:text-[var(--color-text-secondary)] hover:underline transition-colors"
              >
                {t('chat.pleaseSignIn')}
              </button>
            </div>
          </div>
          <p className="text-xs text-center mt-2 text-[var(--color-text-tertiary)]">
            {t('chat.guestCannotSend')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-5 pb-4 pt-2 w-full">
      <div className="w-full">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-2">
            {attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-2 bg-[var(--color-bg-secondary)] rounded-lg px-2.5 py-1.5 text-xs group"
              >
                {att.previewUrl ? (
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                    <img src={att.previewUrl} alt={att.file.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <FileIcon size={14} className="text-[var(--color-text-tertiary)] flex-shrink-0" />
                )}
                <span className="text-[var(--color-text-secondary)] max-w-[120px] truncate">
                  {att.file.name}
                </span>
                <span className="text-[var(--color-text-tertiary)]">
                  {(att.file.size / 1024).toFixed(0)}KB
                </span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="p-0.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Visibility, Self-Review toggles & File Selector */}
        <div className="flex items-center gap-1.5 mb-2 px-1 flex-wrap">
          {currentConversationId && (
            <>
              <span className="text-[11px] text-[var(--color-text-tertiary)] mr-0.5">{t('conversation.currentStatus')}</span>
              <button
                onClick={() => {
                  const newVis = currentVisibility === 'public' ? 'private' as const : 'public' as const;
                  setVisibility(newVis);
                  updateConversation(currentConversationId, { visibility: newVis });
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
                  currentVisibility === 'public'
                    ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]'
                    : 'bg-[rgba(168,85,247,0.15)] text-[#a855f7]'
                }`}
                title={t('conversation.visibilityDesc')}
              >
                {currentVisibility === 'private' ? <Lock size={11} /> : <Globe size={11} />}
                <span>{currentVisibility === 'private' ? t('conversation.private') : t('conversation.public')}</span>
              </button>
              <button
                onClick={() => {
                  const newVal = !currentSelfReview;
                  setSelfReview(newVal);
                  updateConversation(currentConversationId, { selfReview: newVal });
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
                  currentSelfReview
                    ? 'bg-[rgba(16,163,127,0.15)] text-[var(--color-accent-main)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                }`}
                title={t('conversation.selfReviewDesc')}
              >
                {currentSelfReview ? <Eye size={11} /> : <EyeOff size={11} />}
                <span>{t('conversation.selfReview')}</span>
              </button>
            </>
          )}
          <FileSelector
            selectedFileIds={selectedFileIds}
            onSelectionChange={setSelectedFileIds}
          />
        </div>

        <div
          ref={composerRef}
          className={`composer-focus-ring relative flex items-end bg-[var(--composer-bg)] rounded-3xl transition-shadow overflow-hidden ${
            isDragging ? 'ring-2 ring-[var(--button-primary-bg)] ring-opacity-50' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 p-3.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            title={t('chat.attachFile')}
          >
            <Paperclip size={18} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isDragging ? t('chat.dropFiles') : t('chat.messagePlaceholder')}
            rows={1}
            className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] py-3.5 px-0 resize-none outline-none text-[15px] max-h-[200px] leading-6"
          />

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="flex-shrink-0 p-3.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              title={t('chat.stopGenerating')}
            >
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                <Square size={14} fill="#212121" stroke="none" />
              </div>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && attachments.length === 0}
              className="flex-shrink-0 p-3.5 transition-colors"
              title={t('chat.sendMessage')}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                input.trim() || attachments.length > 0
                  ? 'bg-white hover:bg-gray-200'
                  : 'bg-[rgba(255,255,255,0.1)]'
              }`}>
                <Send size={14} className={input.trim() || attachments.length > 0 ? 'text-[#212121]' : 'text-[var(--color-text-tertiary)]'} />
              </div>
            </button>
          )}
        </div>

        <p className="text-xs text-center mt-2 text-[var(--color-text-tertiary)]">
          {t('chat.aiDisclaimer')}
        </p>
      </div>
    </div>
  );
}
