import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Loader2,
  Swords,
  History,
  Trophy,
  Boxes,
  BarChart3,
  Play,
  FlaskConical,
  ListChecks,
  Download,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useArenaStore } from '../../stores/arenaStore';
import { useTranslation } from '../../i18n';
import { TopRightToggles } from '../layout/TopRightToggles';
import { MarkdownMessage } from '../common/MarkdownMessage';
import type { BattleCandidate } from '../../types';
import { PromptLabPanel } from './PromptLabPanel';
import { BenchmarkPanel } from './BenchmarkPanel';

interface ArenaLayoutProps {
  onClose: () => void;
}

export function ArenaLayout({ onClose }: ArenaLayoutProps) {
  const { t } = useTranslation();
  const tab = useArenaStore((s) => s.tab);
  const setTab = useArenaStore((s) => s.setTab);
  const fetchModels = useArenaStore((s) => s.fetchModels);
  const fetchHistory = useArenaStore((s) => s.fetchHistory);
  const fetchLeaderboard = useArenaStore((s) => s.fetchLeaderboard);
  const fetchStats = useArenaStore((s) => s.fetchStats);

  useEffect(() => {
    fetchModels();
    fetchHistory();
    fetchLeaderboard();
    fetchStats();
  }, [fetchModels, fetchHistory, fetchLeaderboard, fetchStats]);

  const tabs: { id: typeof tab; label: string; icon: typeof Swords }[] = [
    { id: 'battle', label: t('arena.tabBattle'), icon: Swords },
    { id: 'promptLab', label: t('arena.tabPromptLab'), icon: FlaskConical },
    { id: 'benchmark', label: t('arena.tabBenchmark'), icon: ListChecks },
    { id: 'history', label: t('arena.tabHistory'), icon: History },
    { id: 'leaderboard', label: t('arena.tabLeaderboard'), icon: Trophy },
    { id: 'models', label: t('arena.tabModels'), icon: Boxes },
    { id: 'stats', label: t('arena.tabStats'), icon: BarChart3 },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-[var(--color-main-surface-primary)] text-[var(--color-text-primary)]">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)]">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--overlay-5)] text-[var(--color-text-secondary)]"
          title={t('arena.backToChat')}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold tracking-tight">{t('arena.title')}</h1>
          <p className="text-[12px] text-[var(--color-text-tertiary)] truncate">
            {t('arena.subtitle')}
          </p>
        </div>
        <TopRightToggles variant="inline" />
      </header>

      <nav className="flex gap-1 px-3 py-2 border-b border-[var(--color-border-light)] overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap transition-colors ${
              tab === id
                ? 'bg-[var(--overlay-8)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--overlay-4)]'
            }`}
          >
            <Icon size={14} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'battle' && <BattlePanel />}
        {tab === 'promptLab' && <PromptLabPanel />}
        {tab === 'benchmark' && <BenchmarkPanel />}
        {tab === 'history' && <HistoryPanel />}
        {tab === 'leaderboard' && <LeaderboardPanel />}
        {tab === 'models' && <ModelsPanel />}
        {tab === 'stats' && <StatsPanel />}
      </div>
    </div>
  );
}

function BattlePanel() {
  const { t } = useTranslation();
  const models = useArenaStore((s) => s.models);
  const createBattle = useArenaStore((s) => s.createBattle);
  const currentBattle = useArenaStore((s) => s.currentBattle);
  const selectCandidate = useArenaStore((s) => s.selectCandidate);
  const clearCurrentBattle = useArenaStore((s) => s.clearCurrentBattle);
  const battleLoading = useArenaStore((s) => s.battleLoading);
  const battleError = useArenaStore((s) => s.battleError);

  const [question, setQuestion] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [hideNames, setHideNames] = useState(false);

  const battleEligible = useMemo(
    () => models.filter((m) => m.eligibleBattle && m.isActive),
    [models]
  );

  const toggleModel = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  const onStart = async () => {
    if (question.trim().length === 0 || selected.length < 2) return;
    await createBattle(
      question.trim(),
      selected,
      hideNames ? 'hidden_until_pick' : 'always_show_names'
    );
  };

  if (currentBattle) {
    return (
      <BattleResultView
        battle={currentBattle}
        loading={battleLoading}
        error={battleError}
        onSelect={selectCandidate}
        onNew={() => {
          clearCurrentBattle();
          setQuestion('');
        }}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <section>
        <label className="block text-[13px] text-[var(--color-text-secondary)] mb-1.5">
          {t('arena.question')}
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          placeholder={t('arena.questionPlaceholder')}
          className="w-full rounded-xl bg-[var(--overlay-3)] border border-[var(--color-border-light)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent-main)] resize-y min-h-[100px]"
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] text-[var(--color-text-secondary)]">
            {t('arena.pickModels')} ({selected.length})
          </label>
          <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-tertiary)] cursor-pointer">
            <input
              type="checkbox"
              checked={hideNames}
              onChange={(e) => setHideNames(e.target.checked)}
              className="rounded"
            />
            {t('arena.hideNamesUntilPick')}
          </label>
        </div>
        {battleEligible.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">{t('arena.noEligibleModels')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {battleEligible.map((m) => {
              const on = selected.includes(m.normalizedName);
              return (
                <button
                  key={m.normalizedName}
                  type="button"
                  onClick={() => toggleModel(m.normalizedName)}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                    on
                      ? 'border-[var(--color-accent-main)] bg-[var(--accent-tint-15)] text-[var(--color-text-primary)]'
                      : 'border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:bg-[var(--overlay-4)]'
                  }`}
                >
                  {m.displayName}
                  <span className="opacity-50 ml-1">×{m.stationCount}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">{t('arena.pickHint')}</p>
      </section>

      {battleError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {battleError}
        </div>
      )}

      <button
        type="button"
        disabled={battleLoading || question.trim().length === 0 || selected.length < 2}
        onClick={onStart}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent-main)] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        {battleLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
        {battleLoading ? t('arena.running') : t('arena.startBattle')}
      </button>
    </div>
  );
}

function BattleResultView({
  battle,
  loading,
  error,
  onSelect,
  onNew,
}: {
  battle: NonNullable<ReturnType<typeof useArenaStore.getState>['currentBattle']>;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => Promise<void>;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const canSelect =
    !battle.selection &&
    battle.status !== 'completed' &&
    battle.candidates.some((c) => c.status === 'done');

  const selectedId = battle.selection?.selectedCandidateId;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">
            {t('arena.question')} · {battle.status}
          </div>
          <p className="text-sm whitespace-pre-wrap">{battle.questionText}</p>
        </div>
        <button
          onClick={onNew}
          className="text-[13px] px-3 py-1.5 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)] shrink-0"
        >
          {t('arena.newBattle')}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {battle.selection && (
        <div className="text-[13px] text-[var(--color-accent-main)] bg-[var(--accent-tint-10)] border border-[var(--accent-tint-25)] rounded-lg px-3 py-2">
          {t('arena.selectedModel')}: <strong>{battle.selection.selectedModelNormalizedName}</strong>
        </div>
      )}

      {/* items-start: each card takes its own height — an error card no longer
          stretches to match a long answer beside it (v0.7.79). */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {battle.candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            selected={selectedId === c.id}
            canSelect={!!canSelect && c.status === 'done' && !loading}
            onSelect={() => onSelect(c.id)}
            showPickLabel={t('arena.pickThis')}
            pickedLabel={t('arena.picked')}
          />
        ))}
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  canSelect,
  onSelect,
  showPickLabel,
  pickedLabel,
}: {
  candidate: BattleCandidate;
  selected: boolean;
  canSelect: boolean;
  onSelect: () => void;
  showPickLabel: string;
  pickedLabel: string;
}) {
  const { t } = useTranslation();
  // Fullscreen reading mode (v0.7.80): modal overlay with the whole answer.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col min-h-[120px] ${
        selected
          ? 'border-[var(--color-accent-main)] bg-[var(--accent-tint-8)]'
          : 'border-[var(--color-border-light)] bg-[var(--overlay-2)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[13px] font-medium truncate">
          {candidate.modelNormalizedName}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            {candidate.status}
            {candidate.latencyMs != null ? ` · ${candidate.latencyMs}ms` : ''}
          </span>
          {(candidate.content || candidate.errorMessage) && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="p-1 rounded-md hover:bg-[var(--overlay-6)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              title={t('arena.expandAnswer')}
              aria-label={t('arena.expandAnswer')}
            >
              <Maximize2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen reading overlay */}
      {expanded && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 sm:p-8"
          onClick={() => setExpanded(false)}
        >
          <div
            className="w-full max-w-4xl h-full rounded-2xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border-light)] flex-shrink-0">
              <span className="text-sm font-medium truncate">{candidate.modelNormalizedName}</span>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                {candidate.status}
                {candidate.latencyMs != null ? ` · ${candidate.latencyMs}ms` : ''}
              </span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="ml-auto p-1.5 rounded-lg hover:bg-[var(--overlay-6)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                title={t('arena.collapseAnswer')}
                aria-label={t('arena.collapseAnswer')}
              >
                <Minimize2 size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {candidate.status === 'error' ? (
                <p className="text-sm text-[var(--color-text-error)] whitespace-pre-wrap break-words">
                  {candidate.errorMessage || 'Error'}
                </p>
              ) : (
                <div className="text-[14px] text-[var(--color-text-secondary)] markdown-content">
                  <MarkdownMessage content={candidate.content || ''} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {candidate.status === 'error' ? (
        <div className="flex-1 text-[13px] text-[var(--color-text-error)] whitespace-pre-wrap break-words overflow-y-auto max-h-[420px]">
          {candidate.errorMessage || 'Error'}
        </div>
      ) : (
        <div className="flex-1 text-[13px] text-[var(--color-text-secondary)] overflow-y-auto max-h-[420px] markdown-content">
          {candidate.content ? <MarkdownMessage content={candidate.content} /> : '…'}
        </div>
      )}
      {canSelect && (
        <button
          type="button"
          onClick={onSelect}
          className="mt-3 w-full py-2 rounded-lg text-[13px] font-medium bg-[var(--color-accent-main)] text-white hover:opacity-90"
        >
          {showPickLabel}
        </button>
      )}
      {selected && (
        <div className="mt-3 flex items-center justify-center gap-1 text-[13px] text-[var(--color-accent-main)]">
          <Check size={14} /> {pickedLabel}
        </div>
      )}
    </div>
  );
}

function HistoryPanel() {
  const { t } = useTranslation();
  const history = useArenaStore((s) => s.history);
  const historyLoading = useArenaStore((s) => s.historyLoading);
  const loadBattle = useArenaStore((s) => s.loadBattle);
  const fetchHistory = useArenaStore((s) => s.fetchHistory);
  const exportBattles = useArenaStore((s) => s.exportBattles);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (historyLoading) {
    return <LoadingLine />;
  }

  if (history.length === 0) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">{t('arena.noHistory')}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => exportBattles().catch((e) => alert(e.message))}
          className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)]"
        >
          <Download size={12} /> CSV
        </button>
      </div>
      {history.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => loadBattle(h.id)}
          className="w-full text-left rounded-xl border border-[var(--color-border-light)] px-3 py-2.5 hover:bg-[var(--overlay-3)] transition-colors"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              {h.status} · {new Date(h.createdAt).toLocaleString()}
            </span>
            {h.selectedModel && (
              <span className="text-[11px] text-[var(--color-accent-main)] truncate max-w-[40%]">
                → {h.selectedModel}
              </span>
            )}
          </div>
          <div className="text-sm line-clamp-2">{h.questionText}</div>
        </button>
      ))}
    </div>
  );
}

function LeaderboardPanel() {
  const { t } = useTranslation();
  const leaderboard = useArenaStore((s) => s.leaderboard);
  const loading = useArenaStore((s) => s.leaderboardLoading);
  const fetchLeaderboard = useArenaStore((s) => s.fetchLeaderboard);
  const exportLeaderboard = useArenaStore((s) => s.exportLeaderboard);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (loading) return <LoadingLine />;
  if (leaderboard.length === 0) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">{t('arena.noLeaderboard')}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto overflow-x-auto">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[12px] text-[var(--color-text-tertiary)]">{t('arena.leaderboardHint')}</p>
        <button
          type="button"
          onClick={() => exportLeaderboard().catch((e) => alert(e.message))}
          className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)] shrink-0"
        >
          <Download size={12} /> CSV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[12px] text-[var(--color-text-tertiary)] border-b border-[var(--color-border-light)]">
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">{t('arena.colModel')}</th>
            <th className="py-2 pr-3 font-medium">{t('arena.colSelections')}</th>
            <th className="py-2 pr-3 font-medium">{t('arena.colAppearances')}</th>
            <th className="py-2 pr-3 font-medium">{t('arena.colRate')}</th>
            <th className="py-2 font-medium">{t('arena.colLatency')}</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row, i) => (
            <tr key={row.modelNormalizedName} className="border-b border-[var(--color-border-light)]/50">
              <td className="py-2.5 pr-3 text-[var(--color-text-tertiary)]">{i + 1}</td>
              <td className="py-2.5 pr-3 font-medium">{row.modelNormalizedName}</td>
              <td className="py-2.5 pr-3">{row.selections}</td>
              <td className="py-2.5 pr-3">{row.appearances}</td>
              <td className="py-2.5 pr-3">{(row.selectionRate * 100).toFixed(1)}%</td>
              <td className="py-2.5">{row.avgLatencyMs != null ? `${row.avgLatencyMs}ms` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelsPanel() {
  const { t } = useTranslation();
  const models = useArenaStore((s) => s.models);
  const loading = useArenaStore((s) => s.modelsLoading);
  const toggleEligibleBattle = useArenaStore((s) => s.toggleEligibleBattle);
  const fetchModels = useArenaStore((s) => s.fetchModels);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  if (loading) return <LoadingLine />;

  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <p className="text-[12px] text-[var(--color-text-tertiary)] mb-2">{t('arena.modelsHint')}</p>
      {models.map((m) => (
        <div
          key={m.normalizedName}
          className="flex items-center gap-3 rounded-xl border border-[var(--color-border-light)] px-3 py-2.5"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{m.displayName}</div>
            <div className="text-[11px] text-[var(--color-text-tertiary)] truncate">
              {m.normalizedName} · {m.stationCount} station(s)
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)] cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={m.eligibleBattle}
              onChange={(e) => toggleEligibleBattle(m.normalizedName, e.target.checked)}
            />
            {t('arena.eligibleBattle')}
          </label>
        </div>
      ))}
    </div>
  );
}

function StatsPanel() {
  const { t } = useTranslation();
  const stats = useArenaStore((s) => s.stats);
  const loading = useArenaStore((s) => s.statsLoading);
  const fetchStats = useArenaStore((s) => s.fetchStats);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading || !stats) return <LoadingLine />;

  const cards = [
    { label: t('arena.statTotal'), value: stats.totalBattles },
    { label: t('arena.statCompleted'), value: stats.completedBattles },
    { label: t('arena.statAwaiting'), value: stats.awaitingSelection },
    { label: t('arena.statSelections'), value: stats.totalSelections },
    { label: t('arena.statToday'), value: stats.battlesToday },
    { label: t('arena.statPrompts'), value: stats.promptCount ?? 0 },
    { label: t('arena.statSets'), value: stats.setCount ?? 0 },
    { label: t('arena.statExperiments'), value: stats.experimentCount ?? 0 },
    { label: t('arena.statBenchRuns'), value: stats.benchmarkRunCount ?? 0 },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-[var(--color-border-light)] bg-[var(--overlay-2)] px-3 py-3"
          >
            <div className="text-[11px] text-[var(--color-text-tertiary)] mb-1">{c.label}</div>
            <div className="text-xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-[13px] text-[var(--color-text-secondary)] mb-2">{t('arena.topSelected')}</h3>
        {stats.topSelected.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">—</p>
        ) : (
          <ul className="space-y-1">
            {stats.topSelected.map((row) => (
              <li
                key={row.model}
                className="flex justify-between text-sm border-b border-[var(--color-border-light)]/40 py-1.5"
              >
                <span>{row.model}</span>
                <span className="text-[var(--color-text-tertiary)]">{row.selections}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LoadingLine() {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
      <Loader2 size={16} className="animate-spin" /> Loading…
    </div>
  );
}
