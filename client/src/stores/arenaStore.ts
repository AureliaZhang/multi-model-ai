import { create } from 'zustand';
import { arenaApi } from '../services/api';
import type {
  ArenaModelRow,
  BattleDetail,
  BattleListItem,
  LeaderboardRow,
  ArenaStatsSummary,
  ArenaPrompt,
  ArenaPromptSet,
  PromptExperiment,
  BenchmarkRun,
} from '../types';

export type ArenaTab =
  | 'battle'
  | 'history'
  | 'leaderboard'
  | 'models'
  | 'stats'
  | 'promptLab'
  | 'benchmark';

interface ArenaState {
  tab: ArenaTab;
  models: ArenaModelRow[];
  modelsLoading: boolean;
  currentBattle: BattleDetail | null;
  battleLoading: boolean;
  battleError: string | null;
  history: BattleListItem[];
  historyTotal: number;
  historyLoading: boolean;
  leaderboard: LeaderboardRow[];
  leaderboardLoading: boolean;
  stats: ArenaStatsSummary | null;
  statsLoading: boolean;

  prompts: ArenaPrompt[];
  promptsLoading: boolean;
  promptSets: ArenaPromptSet[];
  promptSetsLoading: boolean;
  currentExperiment: PromptExperiment | null;
  experiments: PromptExperiment[];
  experimentLoading: boolean;
  experimentError: string | null;

  benchmarkRuns: BenchmarkRun[];
  currentBenchmark: BenchmarkRun | null;
  benchmarkLoading: boolean;
  benchmarkError: string | null;

  setTab: (tab: ArenaTab) => void;
  fetchModels: () => Promise<void>;
  toggleEligibleBattle: (normalizedName: string, eligible: boolean) => Promise<void>;
  createBattle: (
    question: string,
    models: string[],
    revealMode?: 'hidden_until_pick' | 'always_show_names'
  ) => Promise<BattleDetail | null>;
  selectCandidate: (candidateId: string) => Promise<void>;
  clearCurrentBattle: () => void;
  loadBattle: (id: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  fetchStats: () => Promise<void>;

  fetchPrompts: () => Promise<void>;
  createPrompt: (data: { title: string; body: string; systemPrompt?: string }) => Promise<boolean>;
  deletePrompt: (id: string) => Promise<void>;
  fetchPromptSets: () => Promise<void>;
  createPromptSet: (name: string, description: string, promptIds: string[]) => Promise<boolean>;
  deletePromptSet: (id: string) => Promise<void>;

  runMultiModelExperiment: (promptBody: string, models: string[], title?: string, systemPrompt?: string) => Promise<void>;
  // DEPRECATED: multi_prompt UI removed (framework: Prompt Lab = one prompt × many models only).
  // Kept for API compatibility with existing experiments in DB; do not expose in UI.
  runMultiPromptExperiment: (model: string, prompts: { body: string; systemPrompt?: string }[], title?: string) => Promise<void>;
  fetchExperiments: () => Promise<void>;
  loadExperiment: (id: string) => Promise<void>;
  selectExperimentCell: (cellId: string) => Promise<void>;
  clearExperiment: () => void;

  fetchBenchmarkRuns: () => Promise<void>;
  startBenchmark: (setId: string, models: string[], name?: string, asyncRun?: boolean) => Promise<void>;
  loadBenchmark: (id: string) => Promise<void>;
  setVerdict: (resultId: string, verdict: 'unset' | 'pass' | 'fail' | 'skip') => Promise<void>;
  pollBenchmark: (id: string) => Promise<void>;
  exportLeaderboard: () => Promise<void>;
  exportBattles: () => Promise<void>;
  exportBenchmark: (runId: string) => Promise<void>;
  exportExperiment: (id: string) => Promise<void>;
  clearBenchmark: () => void;
}

export const useArenaStore = create<ArenaState>((set, get) => ({
  tab: 'battle',
  models: [],
  modelsLoading: false,
  currentBattle: null,
  battleLoading: false,
  battleError: null,
  history: [],
  historyTotal: 0,
  historyLoading: false,
  leaderboard: [],
  leaderboardLoading: false,
  stats: null,
  statsLoading: false,

  prompts: [],
  promptsLoading: false,
  promptSets: [],
  promptSetsLoading: false,
  currentExperiment: null,
  experiments: [],
  experimentLoading: false,
  experimentError: null,

  benchmarkRuns: [],
  currentBenchmark: null,
  benchmarkLoading: false,
  benchmarkError: null,

  setTab: (tab) => set({ tab }),

  fetchModels: async () => {
    set({ modelsLoading: true });
    try {
      const res = await arenaApi.listModels();
      if (res.success && res.data) set({ models: res.data, modelsLoading: false });
      else set({ modelsLoading: false, battleError: res.error || 'Failed to load models' });
    } catch (err: any) {
      set({ modelsLoading: false, battleError: err.message });
    }
  },

  toggleEligibleBattle: async (normalizedName, eligible) => {
    const res = await arenaApi.updateModel(normalizedName, { eligibleBattle: eligible });
    if (res.success) await get().fetchModels();
  },

  createBattle: async (question, models, revealMode) => {
    set({ battleLoading: true, battleError: null });
    try {
      const res = await arenaApi.createBattle({
        question,
        models,
        revealMode,
        runImmediately: true,
      });
      if (res.success && res.data) {
        set({ currentBattle: res.data, battleLoading: false, tab: 'battle' });
        return res.data;
      }
      set({ battleLoading: false, battleError: res.error || 'Create battle failed' });
      return null;
    } catch (err: any) {
      set({ battleLoading: false, battleError: err.message });
      return null;
    }
  },

  selectCandidate: async (candidateId) => {
    const battle = get().currentBattle;
    if (!battle) return;
    set({ battleLoading: true, battleError: null });
    try {
      const res = await arenaApi.selectCandidate(battle.id, candidateId);
      if (res.success && res.data) {
        set({ currentBattle: res.data, battleLoading: false });
        get().fetchLeaderboard();
        get().fetchStats();
        get().fetchHistory();
      } else {
        set({ battleLoading: false, battleError: res.error || 'Select failed' });
      }
    } catch (err: any) {
      set({ battleLoading: false, battleError: err.message });
    }
  },

  clearCurrentBattle: () => set({ currentBattle: null, battleError: null }),

  loadBattle: async (id) => {
    set({ battleLoading: true, battleError: null });
    try {
      const res = await arenaApi.getBattle(id);
      if (res.success && res.data) {
        set({ currentBattle: res.data, battleLoading: false, tab: 'battle' });
      } else set({ battleLoading: false, battleError: res.error || 'Load failed' });
    } catch (err: any) {
      set({ battleLoading: false, battleError: err.message });
    }
  },

  fetchHistory: async () => {
    set({ historyLoading: true });
    try {
      const res = await arenaApi.listBattles(50, 0);
      if (res.success && res.data) {
        set({ history: res.data.items, historyTotal: res.data.total, historyLoading: false });
      } else set({ historyLoading: false });
    } catch {
      set({ historyLoading: false });
    }
  },

  fetchLeaderboard: async () => {
    set({ leaderboardLoading: true });
    try {
      const res = await arenaApi.leaderboard();
      if (res.success && res.data) set({ leaderboard: res.data, leaderboardLoading: false });
      else set({ leaderboardLoading: false });
    } catch {
      set({ leaderboardLoading: false });
    }
  },

  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const res = await arenaApi.statsSummary();
      if (res.success && res.data) set({ stats: res.data, statsLoading: false });
      else set({ statsLoading: false });
    } catch {
      set({ statsLoading: false });
    }
  },

  fetchPrompts: async () => {
    set({ promptsLoading: true });
    try {
      const res = await arenaApi.listPrompts();
      if (res.success && res.data) set({ prompts: res.data, promptsLoading: false });
      else set({ promptsLoading: false });
    } catch {
      set({ promptsLoading: false });
    }
  },

  createPrompt: async (data) => {
    const res = await arenaApi.createPrompt(data);
    if (res.success) {
      await get().fetchPrompts();
      return true;
    }
    return false;
  },

  deletePrompt: async (id) => {
    await arenaApi.deletePrompt(id);
    await get().fetchPrompts();
  },

  fetchPromptSets: async () => {
    set({ promptSetsLoading: true });
    try {
      const res = await arenaApi.listPromptSets();
      if (res.success && res.data) set({ promptSets: res.data, promptSetsLoading: false });
      else set({ promptSetsLoading: false });
    } catch {
      set({ promptSetsLoading: false });
    }
  },

  createPromptSet: async (name, description, promptIds) => {
    const res = await arenaApi.createPromptSet({ name, description, promptIds });
    if (res.success) {
      await get().fetchPromptSets();
      return true;
    }
    return false;
  },

  deletePromptSet: async (id) => {
    await arenaApi.deletePromptSet(id);
    await get().fetchPromptSets();
  },

  runMultiModelExperiment: async (promptBody, models, title, systemPrompt) => {
    set({ experimentLoading: true, experimentError: null });
    try {
      const res = await arenaApi.createExperiment({
        mode: 'multi_model',
        promptBody,
        models,
        title,
        systemPrompt,
        runImmediately: true,
      });
      if (res.success && res.data) {
        set({ currentExperiment: res.data, experimentLoading: false, tab: 'promptLab' });
        get().fetchExperiments();
        get().fetchStats();
      } else {
        set({ experimentLoading: false, experimentError: res.error || 'Failed' });
      }
    } catch (err: any) {
      set({ experimentLoading: false, experimentError: err.message });
    }
  },

  // DEPRECATED multi_prompt — UI removed; backend still accepts mode for history.
  runMultiPromptExperiment: async (model, prompts, title) => {
    set({ experimentLoading: true, experimentError: null });
    try {
      const res = await arenaApi.createExperiment({
        mode: 'multi_prompt',
        model,
        prompts,
        title,
        runImmediately: true,
      });
      if (res.success && res.data) {
        set({ currentExperiment: res.data, experimentLoading: false, tab: 'promptLab' });
        get().fetchExperiments();
        get().fetchStats();
      } else {
        set({ experimentLoading: false, experimentError: res.error || 'Failed' });
      }
    } catch (err: any) {
      set({ experimentLoading: false, experimentError: err.message });
    }
  },

  fetchExperiments: async () => {
    try {
      const res = await arenaApi.listExperiments(50);
      if (res.success && res.data) set({ experiments: res.data });
    } catch {
      /* ignore */
    }
  },

  loadExperiment: async (id) => {
    set({ experimentLoading: true, experimentError: null });
    try {
      const res = await arenaApi.getExperiment(id);
      if (res.success && res.data) {
        set({ currentExperiment: res.data, experimentLoading: false, tab: 'promptLab' });
      } else set({ experimentLoading: false, experimentError: res.error || 'Load failed' });
    } catch (err: any) {
      set({ experimentLoading: false, experimentError: err.message });
    }
  },

  selectExperimentCell: async (cellId) => {
    const exp = get().currentExperiment;
    if (!exp) return;
    const res = await arenaApi.selectExperimentCell(exp.id, cellId);
    if (res.success && res.data) set({ currentExperiment: res.data });
  },

  clearExperiment: () => set({ currentExperiment: null, experimentError: null }),

  fetchBenchmarkRuns: async () => {
    try {
      const res = await arenaApi.listBenchmarkRuns(50);
      if (res.success && res.data) set({ benchmarkRuns: res.data });
    } catch {
      /* ignore */
    }
  },

  startBenchmark: async (setId, models, name, asyncRun = true) => {
    set({ benchmarkLoading: true, benchmarkError: null });
    try {
      const res = await arenaApi.createBenchmarkRun({
        setId,
        models,
        name,
        runImmediately: true,
        async: asyncRun,
      });
      if (res.success && res.data) {
        set({ currentBenchmark: res.data, benchmarkLoading: false, tab: 'benchmark' });
        get().fetchBenchmarkRuns();
        get().fetchStats();
        // Poll if still queued/running
        if (res.data.status === 'queued' || res.data.status === 'running') {
          const id = res.data.id;
          const poll = async () => {
            for (let i = 0; i < 120; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const cur = await arenaApi.getBenchmarkRun(id);
              if (cur.success && cur.data) {
                set({ currentBenchmark: cur.data });
                if (cur.data.status !== 'queued' && cur.data.status !== 'running') {
                  get().fetchBenchmarkRuns();
                  get().fetchStats();
                  break;
                }
              }
            }
          };
          poll().catch(() => undefined);
        }
      } else {
        set({ benchmarkLoading: false, benchmarkError: res.error || 'Failed' });
      }
    } catch (err: any) {
      set({ benchmarkLoading: false, benchmarkError: err.message });
    }
  },

  loadBenchmark: async (id) => {
    set({ benchmarkLoading: true, benchmarkError: null });
    try {
      const res = await arenaApi.getBenchmarkRun(id);
      if (res.success && res.data) {
        set({ currentBenchmark: res.data, benchmarkLoading: false, tab: 'benchmark' });
      } else set({ benchmarkLoading: false, benchmarkError: res.error || 'Load failed' });
    } catch (err: any) {
      set({ benchmarkLoading: false, benchmarkError: err.message });
    }
  },

  setVerdict: async (resultId, verdict) => {
    const res = await arenaApi.setBenchmarkVerdict(resultId, verdict);
    if (res.success && res.data) set({ currentBenchmark: res.data });
  },

  pollBenchmark: async (id) => {
    const res = await arenaApi.getBenchmarkRun(id);
    if (res.success && res.data) set({ currentBenchmark: res.data });
  },

  exportLeaderboard: async () => {
    await arenaApi.downloadExport('/arena/export/leaderboard.csv', 'arena-leaderboard.csv');
  },
  exportBattles: async () => {
    await arenaApi.downloadExport('/arena/export/battles.csv', 'arena-battles.csv');
  },
  exportBenchmark: async (runId) => {
    await arenaApi.downloadExport(
      `/arena/export/benchmarks/${runId}.csv`,
      `arena-benchmark-${runId.slice(0, 8)}.csv`
    );
  },
  exportExperiment: async (id) => {
    await arenaApi.downloadExport(
      `/arena/export/experiments/${id}.csv`,
      `arena-experiment-${id.slice(0, 8)}.csv`
    );
  },

  clearBenchmark: () => set({ currentBenchmark: null, benchmarkError: null }),
}));
