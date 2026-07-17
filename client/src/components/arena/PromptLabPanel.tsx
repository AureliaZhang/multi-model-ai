import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Loader2, Play, Plus, Trash2, Download } from 'lucide-react';
import { useArenaStore } from '../../stores/arenaStore';
import { useTranslation } from '../../i18n';

/**
 * Prompt Lab — only "1 prompt × many models" (one question, multi answers).
 * Multi-prompt mode removed from UI by product choice.
 */
export function PromptLabPanel() {
  const { t } = useTranslation();
  const models = useArenaStore((s) => s.models);
  const prompts = useArenaStore((s) => s.prompts);
  const fetchPrompts = useArenaStore((s) => s.fetchPrompts);
  const createPrompt = useArenaStore((s) => s.createPrompt);
  const deletePrompt = useArenaStore((s) => s.deletePrompt);
  const currentExperiment = useArenaStore((s) => s.currentExperiment);
  const experiments = useArenaStore((s) => s.experiments);
  const experimentLoading = useArenaStore((s) => s.experimentLoading);
  const experimentError = useArenaStore((s) => s.experimentError);
  const runMultiModelExperiment = useArenaStore((s) => s.runMultiModelExperiment);
  const fetchExperiments = useArenaStore((s) => s.fetchExperiments);
  const loadExperiment = useArenaStore((s) => s.loadExperiment);
  const selectExperimentCell = useArenaStore((s) => s.selectExperimentCell);
  const clearExperiment = useArenaStore((s) => s.clearExperiment);
  const exportExperiment = useArenaStore((s) => s.exportExperiment);

  const [promptBody, setPromptBody] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [libTitle, setLibTitle] = useState('');
  const [libBody, setLibBody] = useState('');

  const eligible = useMemo(
    () => models.filter((m) => m.isActive),
    [models]
  );

  useEffect(() => {
    fetchPrompts();
    fetchExperiments();
  }, [fetchPrompts, fetchExperiments]);

  const toggleModel = (n: string) => {
    setSelectedModels((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  };

  const onRun = async () => {
    if (!promptBody.trim() || selectedModels.length < 1) return;
    await runMultiModelExperiment(
      promptBody.trim(),
      selectedModels,
      undefined,
      systemPrompt.trim() || undefined
    );
  };

  if (currentExperiment) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] text-[var(--color-text-tertiary)] uppercase tracking-wide">
              {currentExperiment.status}
            </div>
            <h2 className="text-sm font-medium">{currentExperiment.title || t('arena.experimentResult')}</h2>
            <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5">{t('arena.onePromptManyModels')}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportExperiment(currentExperiment.id).catch((e) => alert(e.message))}
              className="inline-flex items-center gap-1 text-[13px] px-3 py-1.5 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)]"
            >
              <Download size={12} /> CSV
            </button>
            <button
              type="button"
              onClick={clearExperiment}
              className="text-[13px] px-3 py-1.5 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)]"
            >
              {t('arena.newExperiment')}
            </button>
          </div>
        </div>
        {experimentError && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {experimentError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentExperiment.cells.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border p-3 min-h-[160px] flex flex-col ${
                c.selected
                  ? 'border-[var(--color-accent-main)] bg-[rgba(16,163,127,0.08)]'
                  : 'border-[var(--color-border-light)] bg-[var(--overlay-2)]'
              }`}
            >
              <div className="text-[12px] text-[var(--color-text-tertiary)] mb-1 flex justify-between gap-2">
                <span className="font-medium text-[var(--color-text-secondary)] truncate">
                  {c.modelNormalizedName}
                </span>
                <span>
                  {c.status}
                  {c.latencyMs != null ? ` · ${c.latencyMs}ms` : ''}
                </span>
              </div>
              <div className="flex-1 text-[13px] whitespace-pre-wrap overflow-y-auto max-h-[280px] text-[var(--color-text-secondary)]">
                {c.status === 'error' ? c.errorMessage : c.content || '…'}
              </div>
              {c.status === 'done' && !c.selected && (
                <button
                  type="button"
                  onClick={() => selectExperimentCell(c.id)}
                  className="mt-2 w-full py-1.5 rounded-lg text-[12px] border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)]"
                >
                  {t('arena.preferThis')}
                </button>
              )}
              {c.selected && (
                <div className="mt-2 text-center text-[12px] text-[var(--color-accent-main)]">
                  {t('arena.preferred')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
          {t('arena.onePromptManyModels')}
        </h2>
        <p className="text-[12px] text-[var(--color-text-tertiary)]">{t('arena.promptLabHintSimple')}</p>
      </div>

      <textarea
        value={promptBody}
        onChange={(e) => setPromptBody(e.target.value)}
        rows={4}
        placeholder={t('arena.questionPlaceholder')}
        className="w-full rounded-xl bg-[var(--overlay-3)] border border-[var(--color-border-light)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent-main)]"
      />
      <input
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        placeholder={t('arena.systemOptional')}
        className="w-full rounded-xl bg-[var(--overlay-3)] border border-[var(--color-border-light)] px-3 py-2 text-sm outline-none"
      />

      <div>
        <div className="text-[13px] text-[var(--color-text-secondary)] mb-2">
          {t('arena.pickModels')} ({selectedModels.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {eligible.map((m) => {
            const on = selectedModels.includes(m.normalizedName);
            return (
              <button
                key={m.normalizedName}
                type="button"
                onClick={() => toggleModel(m.normalizedName)}
                className={`px-3 py-1.5 rounded-full text-[12px] border ${
                  on
                    ? 'border-[var(--color-accent-main)] bg-[rgba(16,163,127,0.15)]'
                    : 'border-[var(--color-border-light)]'
                }`}
              >
                {m.displayName}
              </button>
            );
          })}
        </div>
        {eligible.length === 0 && (
          <p className="text-[12px] text-[var(--color-text-tertiary)] mt-2">{t('arena.noEligibleModels')}</p>
        )}
      </div>

      {experimentError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {experimentError}
        </div>
      )}

      <button
        type="button"
        disabled={experimentLoading || !promptBody.trim() || selectedModels.length < 1}
        onClick={onRun}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent-main)] text-white text-sm font-medium disabled:opacity-40"
      >
        {experimentLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
        {experimentLoading ? t('arena.running') : t('arena.runExperiment')}
      </button>

      {/* Prompt library mini */}
      <section className="border-t border-[var(--color-border-light)] pt-4 space-y-3">
        <h3 className="text-[13px] font-medium flex items-center gap-1.5">
          <FlaskConical size={14} /> {t('arena.promptLibrary')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={libTitle}
            onChange={(e) => setLibTitle(e.target.value)}
            placeholder={t('arena.promptTitle')}
            className="rounded-lg border border-[var(--color-border-light)] bg-transparent px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={async () => {
              if (!libTitle.trim() || !libBody.trim()) return;
              const ok = await createPrompt({ title: libTitle.trim(), body: libBody.trim() });
              if (ok) {
                setLibTitle('');
                setLibBody('');
              }
            }}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-border-light)] text-sm py-1.5 hover:bg-[var(--overlay-4)]"
          >
            <Plus size={14} /> {t('arena.savePrompt')}
          </button>
        </div>
        <textarea
          value={libBody}
          onChange={(e) => setLibBody(e.target.value)}
          rows={2}
          placeholder={t('arena.promptBody')}
          className="w-full rounded-lg border border-[var(--color-border-light)] bg-transparent px-2 py-1.5 text-sm"
        />
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {prompts.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 text-[13px] border-b border-[var(--color-border-light)]/40 py-1"
            >
              <button
                type="button"
                className="flex-1 text-left truncate hover:text-[var(--color-accent-main)]"
                onClick={() => setPromptBody(p.body)}
                title={p.body}
              >
                {p.title}
              </button>
              <button type="button" onClick={() => deletePrompt(p.id)} className="p-1 opacity-60 hover:opacity-100">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {experiments.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[13px] text-[var(--color-text-secondary)]">{t('arena.recentExperiments')}</h3>
          {experiments
            .filter((e) => e.mode === 'multi_model' || !e.mode)
            .slice(0, 10)
            .map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => loadExperiment(e.id)}
              className="w-full text-left text-[13px] rounded-lg border border-[var(--color-border-light)] px-3 py-2 hover:bg-[var(--overlay-3)]"
            >
              {e.title || e.id.slice(0, 8)} · {e.status}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

// Benchmark lives in BenchmarkPanel.tsx
