import { useEffect, useState } from 'react';
import { useStationStore } from '../../stores/stationStore';
import { useModelStore } from '../../stores/modelStore';
import { McpServerManager } from './McpServerManager';
import { RegexManager } from '../regex/RegexManager';
import { useTranslation } from '../../i18n';
import {
  ArrowLeft, Plus, RefreshCw, Trash2, Activity, Download,
  ToggleLeft, ToggleRight, Radio, Info, ChevronDown, ChevronRight, Check, Pencil,
} from 'lucide-react';
import type { StationModelRow } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { useAuthStore } from '../../stores/authStore';
import { webSearchApi } from '../../services/api';
import { AnnouncementManager } from './AnnouncementManager';
import { TopRightToggles } from '../layout/TopRightToggles';
import { ModelPrefsSection } from './ModelPrefsSection';

interface SettingsPageProps {
  onClose: () => void;
}

function capLabel(cap: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    text: t('model.capability.text'),
    vision: t('model.capability.vision'),
    'image-gen': t('model.capability.image-gen'),
    code: t('model.capability.code'),
    tts: t('model.capability.tts'),
    embedding: t('model.capability.embedding'),
  };
  return map[cap] || cap;
}

function capColor(cap: string): string {
  // Theme-aware badge palettes (index.css): readable in BOTH light and dark —
  // the old hard-coded light-on-transparent colors washed out on light theme.
  switch (cap) {
    case 'text': return 'bg-[var(--badge-blue-bg)] text-[var(--badge-blue-fg)]';
    case 'vision': return 'bg-[var(--badge-purple-bg)] text-[var(--badge-purple-fg)]';
    case 'image-gen': return 'bg-[var(--badge-pink-bg)] text-[var(--badge-pink-fg)]';
    case 'code': return 'bg-[var(--badge-green-bg)] text-[var(--badge-green-fg)]';
    case 'tts': return 'bg-[var(--badge-orange-bg)] text-[var(--badge-orange-fg)]';
    case 'embedding': return 'bg-[var(--badge-gray-bg)] text-[var(--badge-gray-fg)]';
    default: return 'bg-[var(--overlay-6)] text-[var(--color-text-tertiary)]';
  }
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const stations = useStationStore(s => s.stations);
  const stationModels = useStationStore(s => s.stationModels);
  const loading = useStationStore(s => s.loading);
  const fetchStations = useStationStore(s => s.fetchStations);
  const createStation = useStationStore(s => s.createStation);
  const deleteStation = useStationStore(s => s.deleteStation);
  const updateStation = useStationStore(s => s.updateStation);
  const pullModels = useStationStore(s => s.pullModels);
  const fetchStationModels = useStationStore(s => s.fetchStationModels);
  const setModelExposed = useStationStore(s => s.setModelExposed);
  const setModelAdminEnabled = useStationStore(s => s.setModelAdminEnabled);
  const renameModel = useStationStore(s => s.renameModel);
  const bulkSetExposed = useStationStore(s => s.bulkSetExposed);
  const healthCheck = useStationStore(s => s.healthCheck);
  const fetchModels = useModelStore(s => s.fetchModels);
  const { t } = useTranslation();
  const isAdmin = useAuthStore(st => st.user?.role === 'admin');

  // In-chat web search config (v0.7.74)
  const [wsEnabled, setWsEnabled] = useState(false);
  const [wsKey, setWsKey] = useState('');
  const [wsSaved, setWsSaved] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    webSearchApi.getConfig().then((res) => {
      if (!cancelled && res.success && res.data) {
        setWsEnabled(res.data.enabled);
        setWsKey(res.data.apiKey);
      }
    });
    return () => { cancelled = true; };
  }, [isAdmin]);
  const saveWebSearch = async () => {
    const res = await webSearchApi.setConfig({ enabled: wsEnabled, apiKey: wsKey });
    if (res.success) {
      setWsSaved(true);
      setTimeout(() => setWsSaved(false), 1500);
    }
  };

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newKey, setNewKey] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Inline station edit (v0.7.75): name / URL / key of an EXISTING station.
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [esName, setEsName] = useState('');
  const [esUrl, setEsUrl] = useState('');
  const [esKey, setEsKey] = useState('');
  const startEditStation = (s: { id: string; name: string; baseUrl: string }) => {
    setEditingStationId(s.id);
    setEsName(s.name);
    setEsUrl(s.baseUrl);
    setEsKey(''); // blank = keep the stored key
  };
  const saveEditStation = async () => {
    if (!editingStationId || !esName.trim() || !esUrl.trim()) return;
    setActionLoading(`edit-${editingStationId}`);
    try {
      await updateStation(editingStationId, {
        name: esName.trim(),
        baseUrl: esUrl.trim(),
        ...(esKey.trim() ? { apiKey: esKey.trim() } : {}),
      });
      setEditingStationId(null);
    } finally {
      setActionLoading(null);
    }
  };

  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  const handleAdd = async () => {
    if (!newName || !newUrl || !newKey) {
      setError(t('settings.allFieldsRequired'));
      return;
    }
    setError('');
    try {
      setActionLoading('add');
      await createStation({ name: newName, baseUrl: newUrl, apiKey: newKey });
      setNewName('');
      setNewUrl('');
      setNewKey('');
      setShowAdd(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePullModels = async (id: string) => {
    try {
      setError('');
      setSuccess('');
      setActionLoading(`pull-${id}`);
      const models = await pullModels(id);
      await fetchModels();
      setExpanded((e) => ({ ...e, [id]: true }));
      const station = stations.find(s => s.id === id);
      const exposed = models.filter((m) => m.enabled).length;
      setSuccess(
        t('settings.modelsPulledDetail', {
          name: station?.name || 'station',
          total: String(models.length),
          exposed: String(exposed),
        })
      );
      setTimeout(() => setSuccess(''), 6000);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = async (id: string) => {
    const next = !expanded[id];
    setExpanded((e) => ({ ...e, [id]: next }));
    if (next && !stationModels[id]) {
      try {
        setActionLoading(`list-${id}`);
        await fetchStationModels(id);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleToggleModel = async (stationId: string, model: StationModelRow) => {
    try {
      await setModelExposed(stationId, model.id, !model.enabled);
      await fetchModels();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const startRename = (model: StationModelRow) => {
    setEditingModelId(model.id);
    setEditName(model.displayName);
  };

  const cancelRename = () => {
    setEditingModelId(null);
    setEditName('');
  };

  const handleRenameModel = async (stationId: string, modelRowId: string) => {
    const name = editName.trim();
    if (!name) {
      setError(t('settings.renameEmpty'));
      return;
    }
    try {
      setError('');
      await renameModel(stationId, modelRowId, name);
      await fetchModels();
      setEditingModelId(null);
      setEditName('');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const handleBulk = async (stationId: string, flags: { enabled?: boolean; adminEnabled?: boolean }) => {
    try {
      setActionLoading(`bulk-${stationId}`);
      await bulkSetExposed(stationId, flags);
      await fetchModels();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (stationId: string, model: StationModelRow) => {
    try {
      const next = !(model.adminEnabled !== false);
      await setModelAdminEnabled(stationId, model.id, next);
      await fetchModels();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const handleHealthCheck = async (id: string) => {
    try {
      setActionLoading(`health-${id}`);
      await healthCheck(id);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('settings.deleteConfirm'))) return;
    try {
      setActionLoading(`delete-${id}`);
      await deleteStation(id);
      await fetchModels();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await updateStation(id, { enabled });
      await fetchModels();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-main-surface-primary)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)]">
        <button
          onClick={onClose}
          aria-label={t('common.back')}
          className="p-1.5 rounded-lg hover:bg-[var(--overlay-5)] text-[var(--color-text-secondary)] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{t('settings.title')}</h1>
        <div className="ml-auto">
          <TopRightToggles variant="inline" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto w-full">
        {/* Default model slots (v0.7.92) — everyone's, so it sits above the
            admin-only blocks. Replaces the daily-model modal. */}
        <ModelPrefsSection />
        {/* Admin announcement (v0.7.76): compact card → dialog → preview → confirm */}
        {isAdmin && <AnnouncementManager />}
        {/* In-chat web search (v0.7.74): provider key + switch */}
        {isAdmin && (
          <div className="mb-5 p-4 rounded-2xl bg-[var(--color-main-surface-secondary)] border border-[var(--color-border-light)]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm text-[var(--color-text-primary)]">{t('webSearch.title')}</h3>
              <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
                <input type="checkbox" checked={wsEnabled} onChange={e => setWsEnabled(e.target.checked)} />
                {t('webSearch.enabled')}
              </label>
            </div>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mb-2">{t('webSearch.desc')}</p>
            <input
              type="password"
              value={wsKey}
              onChange={e => setWsKey(e.target.value)}
              placeholder={t('webSearch.keyPlaceholder')}
              className="w-full px-3 py-2 rounded-lg bg-[var(--composer-bg)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-main)]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void saveWebSearch()}
                className="px-3 py-1.5 rounded-lg bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white text-xs transition-colors"
              >
                {wsSaved ? '✓' : t('common.save')}
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--color-surface-error)] text-[var(--color-text-error)] text-sm whitespace-pre-wrap">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--color-surface-success)] text-[var(--color-text-success)] text-sm">
            {success}
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{t('settings.relayStations')}</h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{t('settings.relayStationsDesc')}</p>
            </div>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-main)] text-white text-xs font-medium"
            >
              <Plus size={14} />
              {t('settings.addStation')}
            </button>
          </div>

          {showAdd && (
            <div className="mb-4 p-4 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-main-surface-tertiary)] space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('settings.stationNamePlaceholder')}
                className="w-full px-3 py-2 rounded-xl bg-[var(--composer-bg)] border border-[var(--color-border-light)] text-sm outline-none"
              />
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={t('settings.baseUrlPlaceholder')}
                className="w-full px-3 py-2 rounded-xl bg-[var(--composer-bg)] border border-[var(--color-border-light)] text-sm outline-none font-mono"
              />
              <p className="text-[11px] text-[var(--color-text-tertiary)]">{t('settings.baseUrlHint')}</p>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder={t('settings.apiKeyPlaceholder')}
                className="w-full px-3 py-2 rounded-xl bg-[var(--composer-bg)] border border-[var(--color-border-light)] text-sm outline-none font-mono"
                type="password"
              />
              <p className="text-[11px] text-[var(--color-text-tertiary)]">{t('settings.apiKeyHint')}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={actionLoading === 'add'}
                  className="px-4 py-2 rounded-xl bg-[var(--color-accent-main)] text-white text-sm disabled:opacity-50"
                >
                  {actionLoading === 'add' ? t('settings.adding') : t('settings.addStation')}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--color-border-light)] text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-[var(--color-text-tertiary)] text-sm">
              <RefreshCw size={20} className="mx-auto mb-2 animate-spin" />
              {t('common.loading')}
            </div>
          ) : stations.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-[var(--color-border-light)]">
              <Radio size={32} className="mx-auto mb-3 text-[var(--color-text-tertiary)]" />
              <p className="text-[var(--color-text-secondary)] text-sm mb-1">{t('settings.noStations')}</p>
              <p className="text-[var(--color-text-tertiary)] text-xs">{t('settings.addStationHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stations.map(station => {
                const models = stationModels[station.id] || [];
                const isOpen = !!expanded[station.id];
                
                return (
                  <div
                    key={station.id}
                    className="group p-4 rounded-2xl bg-[var(--color-main-surface-tertiary)] border border-[var(--color-border-light)] hover:border-[var(--color-border-medium)] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <h3 className="font-medium text-sm text-[var(--color-text-primary)]">{station.name}</h3>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            station.healthStatus === 'healthy'
                              ? 'bg-[var(--color-surface-success)] text-[var(--color-text-success)]'
                              : station.healthStatus === 'unhealthy'
                              ? 'bg-[var(--color-surface-error)] text-[var(--color-text-error)]'
                              : 'bg-[var(--overlay-5)] text-[var(--color-text-tertiary)]'
                          }`}>
                            {station.healthStatus}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-tertiary)] truncate font-mono">{station.baseUrl}</p>
                      </div>

                      <button
                        onClick={() => handleToggle(station.id, !station.enabled)}
                        className="ml-3 flex-shrink-0"
                        title={station.enabled ? t('common.disable') : t('common.enable')}
                      >
                        {station.enabled ? (
                          <ToggleRight size={28} className="text-[var(--color-accent-main)]" />
                        ) : (
                          <ToggleLeft size={28} className="text-[var(--color-text-tertiary)]" />
                        )}
                      </button>
                    </div>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => handlePullModels(station.id)}
                        disabled={actionLoading === `pull-${station.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--overlay-5)] hover:bg-[var(--overlay-8)] text-xs text-[var(--color-text-secondary)] transition-colors disabled:opacity-40 font-medium"
                      >
                        <Download size={13} />
                        {actionLoading === `pull-${station.id}` ? t('settings.pulling') : t('settings.pullModels')}
                      </button>
                      <button
                        onClick={() => handleHealthCheck(station.id)}
                        disabled={actionLoading === `health-${station.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--overlay-5)] hover:bg-[var(--overlay-8)] text-xs text-[var(--color-text-secondary)] transition-colors disabled:opacity-40 font-medium"
                      >
                        <Activity size={13} />
                        {actionLoading === `health-${station.id}` ? t('settings.checking') : t('settings.healthCheck')}
                      </button>
                      <button
                        onClick={() => toggleExpand(station.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--overlay-5)] hover:bg-[var(--overlay-8)] text-xs text-[var(--color-text-secondary)] transition-colors font-medium"
                      >
                        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        {t('settings.manageModels')}
                        {models.length > 0 && (
                          <span className="text-[var(--color-text-tertiary)]">
                            ({models.filter(m => m.adminEnabled !== false).length}/{models.filter(m => m.enabled).length}/{models.length})
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          editingStationId === station.id ? setEditingStationId(null) : startEditStation(station)
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--overlay-5)] hover:bg-[var(--overlay-8)] text-xs text-[var(--color-text-secondary)] transition-colors font-medium"
                      >
                        <Pencil size={13} />
                        {t('settings.editStation')}
                      </button>
                      <button
                        onClick={() => handleDelete(station.id)}
                        disabled={actionLoading === `delete-${station.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--color-surface-error)] text-xs text-[var(--color-text-error)] transition-colors disabled:opacity-40 font-medium ml-auto"
                      >
                        <Trash2 size={13} />
                        {t('common.delete')}
                      </button>
                    </div>

                    {/* Inline station edit form (v0.7.75) */}
                    {editingStationId === station.id && (
                      <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] space-y-2.5">
                        <input
                          value={esName}
                          onChange={(e) => setEsName(e.target.value)}
                          placeholder={t('settings.stationNamePlaceholder')}
                          className="w-full px-3 py-2 rounded-xl bg-[var(--composer-bg)] border border-[var(--color-border-light)] text-sm outline-none focus:border-[var(--color-accent-main)]"
                        />
                        <input
                          value={esUrl}
                          onChange={(e) => setEsUrl(e.target.value)}
                          placeholder={t('settings.baseUrlPlaceholder')}
                          className="w-full px-3 py-2 rounded-xl bg-[var(--composer-bg)] border border-[var(--color-border-light)] text-sm outline-none font-mono focus:border-[var(--color-accent-main)]"
                        />
                        <input
                          value={esKey}
                          onChange={(e) => setEsKey(e.target.value)}
                          placeholder={t('settings.editStationKeyPlaceholder')}
                          type="password"
                          className="w-full px-3 py-2 rounded-xl bg-[var(--composer-bg)] border border-[var(--color-border-light)] text-sm outline-none font-mono focus:border-[var(--color-accent-main)]"
                        />
                        <p className="text-[11px] text-[var(--color-text-tertiary)]">{t('settings.editStationKeyHint')}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => void saveEditStation()}
                            disabled={actionLoading === `edit-${station.id}` || !esName.trim() || !esUrl.trim()}
                            className="px-4 py-2 rounded-xl bg-[var(--color-accent-main)] text-white text-sm disabled:opacity-50"
                          >
                            {actionLoading === `edit-${station.id}` ? t('common.loading') : t('common.save')}
                          </button>
                          <button
                            onClick={() => setEditingStationId(null)}
                            className="px-4 py-2 rounded-xl border border-[var(--color-border-light)] text-sm"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-[var(--color-border-light)]">
                        <p className="text-[11px] text-[var(--color-text-tertiary)] mb-2">
                          {t('settings.modelExposureHint')}
                        </p>
                        {actionLoading === `list-${station.id}` && (
                          <div className="text-xs text-[var(--color-text-tertiary)] py-2 flex items-center gap-2">
                            <RefreshCw size={12} className="animate-spin" /> {t('common.loading')}
                          </div>
                        )}
                        {models.length === 0 && actionLoading !== `list-${station.id}` && (
                          <p className="text-xs text-[var(--color-text-tertiary)] py-2">
                            {t('settings.noModelsYet')}
                          </p>
                        )}
                        {models.length > 0 && (
                          <>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <button type="button" onClick={() => handleBulk(station.id, { adminEnabled: true })} className="text-[11px] px-2 py-1 rounded-md border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)]">
                                {t('settings.selectAllAdmin')}
                              </button>
                              <button type="button" onClick={() => handleBulk(station.id, { adminEnabled: false, enabled: false })} className="text-[11px] px-2 py-1 rounded-md border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)]">
                                {t('settings.clearAllAdmin')}
                              </button>
                              <button type="button" onClick={() => handleBulk(station.id, { enabled: true, adminEnabled: true })} className="text-[11px] px-2 py-1 rounded-md border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)]">
                                {t('settings.publicAll')}
                              </button>
                              <button type="button" onClick={() => handleBulk(station.id, { enabled: false })} className="text-[11px] px-2 py-1 rounded-md border border-[var(--color-border-light)] hover:bg-[var(--overlay-4)]">
                                {t('settings.unpublicAll')}
                              </button>
                            </div>
                            <ul className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                              {models.map((m) => (
                                <li
                                  key={m.id}
                                  className="flex items-start gap-2 p-2 rounded-xl bg-[var(--overlay-4)] border border-[var(--color-border-light)]/60"
                                >
                                  <div className="flex flex-col gap-1 flex-shrink-0 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAdmin(station.id, m)}
                                      className={`w-5 h-5 rounded flex items-center justify-center border ${
                                        m.adminEnabled !== false
                                          ? 'bg-[rgba(59,130,246,0.9)] border-[rgba(59,130,246,0.9)] text-white'
                                          : 'border-[var(--color-border-medium)] text-transparent'
                                      }`}
                                      title={t('settings.adminPool')}
                                    >
                                      <Check size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleModel(station.id, m)}
                                      className={`w-5 h-5 rounded flex items-center justify-center border ${
                                        m.enabled
                                          ? 'bg-[var(--color-accent-main)] border-[var(--color-accent-main)] text-white'
                                          : 'border-[var(--color-border-medium)] text-transparent'
                                      }`}
                                      title={t('settings.publicPool')}
                                    >
                                      <Check size={12} />
                                    </button>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {editingModelId === m.id ? (
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <input
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameModel(station.id, m.id);
                                            if (e.key === 'Escape') cancelRename();
                                          }}
                                          className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-[var(--composer-bg)] border border-[var(--color-border-light)] text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-main)]"
                                          autoFocus
                                          maxLength={120}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleRenameModel(station.id, m.id)}
                                          className="px-2 py-1 rounded-md text-[11px] bg-[var(--color-accent-main)] text-white"
                                        >
                                          {t('common.save')}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelRename}
                                          className="px-2 py-1 rounded-md text-[11px] border border-[var(--color-border-light)] text-[var(--color-text-secondary)]"
                                        >
                                          {t('common.cancel')}
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="text-[13px] text-[var(--color-text-primary)] truncate font-medium flex-1">
                                          {m.displayName}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => startRename(m)}
                                          className="flex-shrink-0 p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--overlay-6)]"
                                          title={t('settings.renameModel')}
                                        >
                                          <Pencil size={12} />
                                        </button>
                                      </div>
                                    )}
                                    <div className="text-[10px] text-[var(--color-text-tertiary)] font-mono truncate">
                                      {m.modelId}
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(m.capabilities || []).map((c) => (
                                        <span
                                          key={String(c)}
                                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${capColor(String(c))}`}
                                        >
                                          {capLabel(String(c), t)}
                                        </span>
                                      ))}
                                      {m.adminEnabled !== false && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--badge-blue-bg)] text-[var(--badge-blue-fg)]">
                                          {t('settings.adminPool')}
                                        </span>
                                      )}
                                      {m.enabled ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-tint-15)] text-[var(--color-accent-main)]">
                                          {t('settings.publicPool')}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--overlay-5)] text-[var(--color-text-tertiary)]">
                                          {t('settings.notPublic')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <McpServerManager />

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-5">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{t('regex.title')}</h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">SillyTavern-style regex scripts and presets for content transformation</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border-light)] overflow-hidden">
            <RegexManager embedded />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--color-main-surface-tertiary)] border border-[var(--color-border-light)]">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-[var(--color-text-tertiary)]" />
            <h3 className="font-medium text-sm text-[var(--color-text-primary)]">{t('settings.howItWorks')}</h3>
          </div>
          <ul className="text-xs text-[var(--color-text-tertiary)] space-y-2 leading-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <li key={i} className="flex gap-2">
                <span className="text-[var(--color-text-secondary)]">{i}.</span>
                {t(`settings.howItWorksStep${i}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
