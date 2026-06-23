import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, MessageSquare, Brain, Paperclip, Eye, FolderOpen, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface GuideOverlayProps {
  onClose: () => void;
}

interface GuideStep {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    icon: <Sparkles size={28} className="text-[var(--color-accent-main)]" />,
    titleKey: 'guide.step1Title',
    descKey: 'guide.step1Desc',
  },
  {
    icon: <Brain size={28} className="text-purple-400" />,
    titleKey: 'guide.step2Title',
    descKey: 'guide.step2Desc',
  },
  {
    icon: <MessageSquare size={28} className="text-blue-400" />,
    titleKey: 'guide.step3Title',
    descKey: 'guide.step3Desc',
  },
  {
    icon: <Paperclip size={28} className="text-green-400" />,
    titleKey: 'guide.step4Title',
    descKey: 'guide.step4Desc',
  },
  {
    icon: <Eye size={28} className="text-yellow-400" />,
    titleKey: 'guide.step5Title',
    descKey: 'guide.step5Desc',
  },
  {
    icon: <FolderOpen size={28} className="text-orange-400" />,
    titleKey: 'guide.step6Title',
    descKey: 'guide.step6Desc',
  },
];

export function GuideOverlay({ onClose }: GuideOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useTranslation();
  const step = GUIDE_STEPS[currentStep];
  const isLast = currentStep === GUIDE_STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md mx-4 bg-[var(--color-main-surface-primary)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-[var(--color-surface-elevated)]">
          <div
            className="h-full bg-[var(--color-accent-main)] transition-all duration-300 ease-out"
            style={{ width: `${((currentStep + 1) / GUIDE_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[var(--color-text-tertiary)] transition-colors"
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className="px-8 pt-8 pb-6 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[var(--color-border-light)] flex items-center justify-center mx-auto mb-5">
            {step.icon}
          </div>

          {/* Step counter */}
          <div className="text-xs text-[var(--color-text-tertiary)] mb-3 font-medium">
            {currentStep + 1} / {GUIDE_STEPS.length}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
            {t(step.titleKey)}
          </h3>

          {/* Description */}
          <p className="text-sm text-[var(--color-text-secondary)] leading-6 whitespace-pre-line">
            {t(step.descKey)}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border-light)] bg-[rgba(255,255,255,0.02)]">
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={isFirst}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={14} />
            {t('guide.prev')}
          </button>

          {/* Dots */}
          <div className="flex gap-1.5">
            {GUIDE_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  idx === currentStep
                    ? 'bg-[var(--color-accent-main)] w-4'
                    : 'bg-[var(--color-text-tertiary)] opacity-30 hover:opacity-50'
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-accent-main)] hover:opacity-90 text-white transition-all"
            >
              {t('guide.gotIt')}
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-accent-main)] hover:bg-[rgba(255,255,255,0.05)] transition-all"
            >
              {t('guide.next')}
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
