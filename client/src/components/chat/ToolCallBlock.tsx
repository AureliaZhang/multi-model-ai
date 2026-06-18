import { Wrench, ChevronDown, ChevronUp, CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n';
import type { ToolCallInfo } from '../../types';

interface ToolCallBlockProps {
  toolCall: ToolCallInfo;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const statusIcon = toolCall.result ? (
    <CheckCircle size={14} className="text-green-400" />
  ) : (
    <Loader2 size={14} className="text-yellow-400 animate-spin" />
  );

  // Extract a friendly name (remove the mcp_xxxxxxxx_ prefix)
  const displayName = toolCall.name.replace(/^mcp_[a-f0-9]+_/, '');

  return (
    <div className="my-2 rounded-lg border border-[var(--color-border-light)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
      >
        <Wrench size={14} className="text-[var(--color-text-tertiary)] flex-shrink-0" />
        {statusIcon}
        <span className="text-xs font-medium text-[var(--color-text-secondary)] flex-1 truncate">
          {displayName}
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-[var(--color-text-tertiary)]" />
        ) : (
          <ChevronDown size={14} className="text-[var(--color-text-tertiary)]" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-[var(--color-border-light)]">
          {/* Arguments */}
          {Object.keys(toolCall.arguments).length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                {t('toolCall.arguments')}
              </div>
              <pre className="text-xs text-[var(--color-text-secondary)] bg-[rgba(0,0,0,0.2)] rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {toolCall.result && (
            <div className="mt-2">
              <div className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                {t('toolCall.result')}
              </div>
              <pre className="text-xs text-[var(--color-text-secondary)] bg-[rgba(0,0,0,0.2)] rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-[200px]">
                {toolCall.result}
              </pre>
            </div>
          )}

          {/* Loading state */}
          {!toolCall.result && (
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <Loader2 size={12} className="animate-spin" />
              {t('toolCall.executingTool')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
