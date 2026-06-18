import { useState, useRef, useEffect } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { ChevronDown, Eye, ImageIcon, Code, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n';
import type { ModelCapability } from '../../types';

const capabilityIcons: Record<ModelCapability, React.ReactNode> = {
  text: null,
  vision: <Eye size={11} />,
  'image-gen': <ImageIcon size={11} />,
  code: <Code size={11} />,
};

interface ModelSelectorProps {
  value?: string;
  onChange?: (normalizedName: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const models = useModelStore(s => s.models);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(value || '');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const capabilityLabels: Record<ModelCapability, string> = {
    text: t('model.capability.text'),
    vision: t('model.capability.vision'),
    'image-gen': t('model.capability.image-gen'),
    code: t('model.capability.code'),
  };

  useEffect(() => {
    if (models.length > 0 && !selected) {
      setSelected(models[0].normalizedName);
      onChange?.(models[0].normalizedName);
    }
  }, [models, selected, onChange]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedModel = models.find(m => m.normalizedName === selected);

  const handleSelect = (normalizedName: string) => {
    setSelected(normalizedName);
    onChange?.(normalizedName);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-primary)] text-base font-medium transition-colors duration-150"
      >
        <span>{selectedModel?.displayName || t('model.select')}</span>
        <ChevronDown size={18} className={`text-[var(--color-text-tertiary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-[420px] overflow-y-auto bg-[#2f2f2f] border border-[var(--color-border-medium)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 py-1.5 dropdown-enter">
          {models.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--color-text-tertiary)] text-sm">
              <Sparkles size={24} className="mx-auto mb-2 text-[var(--color-text-tertiary)]" />
              {t('model.noModels')}<br />
              <span className="text-xs">{t('model.addStationFirst')}</span>
            </div>
          ) : (
            models.map(model => (
              <button
                key={model.normalizedName}
                onClick={() => handleSelect(model.normalizedName)}
                className={`w-full text-left px-4 py-2.5 hover:bg-[rgba(255,255,255,0.05)] transition-colors duration-100 flex items-center justify-between rounded-lg mx-0.5 ${
                  selected === model.normalizedName ? 'bg-[rgba(255,255,255,0.07)]' : ''
                }`}
                style={{ width: 'calc(100% - 4px)' }}
              >
                <div className="flex flex-col">
                  <span className="text-sm text-[var(--color-text-primary)] leading-5">
                    {model.displayName}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {t('model.stations', { count: model.stations.length, s: model.stations.length > 1 ? 's' : '' })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {model.capabilities
                    .filter(c => c !== 'text')
                    .map(cap => (
                      <span
                        key={cap}
                        className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-[rgba(255,255,255,0.06)] text-[var(--color-text-tertiary)]"
                        title={capabilityLabels[cap]}
                      >
                        {capabilityIcons[cap]}
                        {capabilityLabels[cap]}
                      </span>
                    ))}
                  <span className={`w-1.5 h-1.5 rounded-full ml-1 ${
                    model.stations.some(s => s.healthy) ? 'bg-[var(--color-text-success)]' : 'bg-[var(--color-text-error)]'
                  }`} title={model.stations.some(s => s.healthy) ? t('model.healthy') : t('model.unhealthy')} />
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
