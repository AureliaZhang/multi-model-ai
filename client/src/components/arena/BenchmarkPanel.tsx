import { useEffect, useMemo, useState } from 'react';
import { ListChecks, Loader2, Play, Trash2, Download } from 'lucide-react';
import { useArenaStore } from '../../stores/arenaStore';
import { useTranslation } from '../../i18n';

export function BenchmarkPanel() {
  const { t } = useTranslation();
  const models = useArenaStore((s) => s.models);
  const prompts = useArenaStore((s) => s.prompts);
  const promptSets = useArenaStore((s) => s.promptSets);
  const fetchPrompts = useArenaStore((s) => s.fetchPrompts);
  const fetchPromptSets = useArenaStore((s) => s.fetchPromptSets);
  const createPromptSet = useArenaStore((s) => s.createPromptSet);
  const deletePromptSet = useArenaStore((s) => s.deletePromptSet);
  const benchmarkRuns = useArenaStore((s) => s.benchmarkRuns);
  const currentBenchmark = useArenaStore((s) => s.currentBenchmark);
  const benchmarkLoading = useArenaStore((s) => s.benchmarkLoading);
  const benchmarkError = useArenaStore((s) => s.benchmarkError);
  const fetchBenchmarkRuns = useArenaStore((s) => s.fetchBenchmarkRuns);
  const startBenchmark = useArenaStore((s) => s.startBenchmark);
  const loadBenchmark = useArenaStore((s) => s.loadBenchmark);
  const setVerdict = useArenaStore((s) => s.setVerdict);
  const clearBenchmark = useArenaStore((s) => s.clearBenchmark);
  const exportBenchmark = useArenaStore((s) => s.exportBenchmark);

  const [setName, setSetName] = useState('');
  const [pickedPromptIds, setPickedPromptIds] = useState<string[]>([]);
  const [setId, setSetId] = useState('');
  const [runModels, setRunModels] = useState<string[]>([]);

  const eligible = useMemo(() => models.filter((m) => m.isActive), [models]);

  useEffect(() => {
    fetchPrompts();
    fetchPromptSets();
    fetchBenchmarkRuns();
  }, [fetchPrompts, fetchPromptSets, fetchBenchmarkRuns]);

  useEffect(() => {
    if (!setId && promptSets[0]) setSetId(promptSets[0].id);
  }, [promptSets, setId]);

  if (currentBenchmark) {
    const results = currentBenchmark.results || [];
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] text-[var(--color-text-tertiary)]">
              {currentBenchmark.setName} · {currentBenchmark.status}
            </div>
            <h2 className="text-sm font-medium">{currentBenchmark.name || currentBenchmark.id.slice(0, 8)}</h2>
            {currentBenchmark.summary && (
              <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1">
                done {currentBenchmark.summary.done}/{currentBenchmark.summary.total} · error{' '}
                {currentBenchmark.summary.error} · pass {currentBenchmark.summary.pass} · fail{' '}
                {currentBenchmark.summary.fail}
              </p>
            )}
            {(currentBenchmark.status === 'queued' || currentBenchmark.status === 'running') && (
              <p className="text-[12px] text-[var(--color-accent-main)] mt-1 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> {t('arena.asyncRunning')}
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportBenchmark(currentBenchmark.id).catch((e) => alert(e.message))}
              className="inline-flex items-center gap-1 text-[13px] px-3 py-1.5 rounded-lg border border-[var(--color-border-light)]"
            >
              <Download size={12} /> CSV
            </button>
            <button
              type="button"
              onClick={clearBenchmark}
              className="text-[13px] px-3 py-1.5 rounded-lg border border-[var(--color-border-light)]"
            >
              {t('arena.back')}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {results.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-[var(--color-border-light)] p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-medium">{r.promptTitle || r.promptId.slice(0, 6)}</span>
                <span className="text-[var(--color-text-tertiary)]">× {r.modelNormalizedName}</span>
                <span className="text-[var(--color-text-tertiary)]">
                  {r.status}
                  {r.latencyMs != null ? ` · ${r.latencyMs}ms` : ''}
                </span>
              </div>
              <div className="text-[13px] whitespace-pre-wrap max-h-40 overflow-y-auto text-[var(--color-text-secondary)]">
                {r.status === 'error' ? r.errorMessage : r.content || '—'}
              </div>
              <div className="flex gap-1">
                {(['unset', 'pass', 'fail', 'skip'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVerdict(r.id, v)}
                    className={`px-2 py-0.5 rounded text-[11px] border ${
                      r.manualVerdict === v
                        ? 'border-[var(--color-accent-main)] bg-[var(--accent-tint-15)]'
                        : 'border-[var(--color-border-light)]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <p className="text-[12px] text-[var(--color-text-tertiary)]">{t('arena.benchmarkHint')}</p>

      <section className="space-y-2 border border-[var(--color-border-light)] rounded-xl p-3">
        <h3 className="text-[13px] font-medium flex items-center gap-1.5">
          <ListChecks size={14} /> {t('arena.createSet')}
        </h3>
        <input
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          placeholder={t('arena.setName')}
          className="w-full rounded-lg border border-[var(--color-border-light)] bg-transparent px-2 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {prompts.map((p) => {
            const on = pickedPromptIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setPickedPromptIds((prev) =>
                    on ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                  )
                }
                className={`px-2 py-1 rounded-full text-[11px] border ${
                  on ? 'border-[var(--color-accent-main)] bg-[var(--accent-tint-12)]' : 'border-[var(--color-border-light)]'
                }`}
              >
                {p.title}
              </button>
            );
          })}
        </div>
        {prompts.length === 0 && (
          <p className="text-[12px] text-[var(--color-text-tertiary)]">{t('arena.needPromptsFirst')}</p>
        )}
        <button
          type="button"
          onClick={async () => {
            if (!setName.trim() || pickedPromptIds.length < 1) return;
            const ok = await createPromptSet(setName.trim(), '', pickedPromptIds);
            if (ok) {
              setSetName('');
              setPickedPromptIds([]);
            }
          }}
          className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-accent-main)] text-white"
        >
          {t('arena.saveSet')}
        </button>
      </section>

      <section className="space-y-2 border border-[var(--color-border-light)] rounded-xl p-3">
        <h3 className="text-[13px] font-medium">{t('arena.runBenchmark')}</h3>
        <select
          value={setId}
          onChange={(e) => setSetId(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-border-light)] bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">{t('arena.pickSet')}</option>
          {promptSets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.promptCount ?? 0})
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {eligible.map((m) => {
            const on = runModels.includes(m.normalizedName);
            return (
              <button
                key={m.normalizedName}
                type="button"
                onClick={() =>
                  setRunModels((prev) =>
                    on ? prev.filter((x) => x !== m.normalizedName) : [...prev, m.normalizedName]
                  )
                }
                className={`px-2 py-1 rounded-full text-[11px] border ${
                  on ? 'border-[var(--color-accent-main)] bg-[var(--accent-tint-12)]' : 'border-[var(--color-border-light)]'
                }`}
              >
                {m.displayName}
              </button>
            );
          })}
        </div>
        {benchmarkError && (
          <div className="text-sm text-red-400">{benchmarkError}</div>
        )}
        <button
          type="button"
          disabled={benchmarkLoading || !setId || runModels.length < 1}
          onClick={() => startBenchmark(setId, runModels)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent-main)] text-white text-sm disabled:opacity-40"
        >
          {benchmarkLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {benchmarkLoading ? t('arena.running') : t('arena.startRun')}
        </button>
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          {t('arena.runCostHint')
            .replace('{p}', String(promptSets.find((s) => s.id === setId)?.promptCount ?? '?'))
            .replace('{m}', String(runModels.length))}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-[13px] text-[var(--color-text-secondary)]">{t('arena.setsAndRuns')}</h3>
        {promptSets.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-[13px]">
            <span className="flex-1 truncate">
              {s.name} · {s.promptCount ?? 0} prompts
            </span>
            <button type="button" onClick={() => deletePromptSet(s.id)} className="p-1 opacity-60">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {benchmarkRuns.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => loadBenchmark(r.id)}
            className="w-full text-left text-[13px] rounded-lg border border-[var(--color-border-light)] px-3 py-2 hover:bg-[var(--overlay-3)]"
          >
            {r.name || r.setName} · {r.status} · {r.doneCount ?? 0}/{r.caseCount ?? 0}
          </button>
        ))}
      </section>
    </div>
  );
}
