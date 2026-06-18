import { useEffect, useState } from 'react';
import { useStationStore } from '../../stores/stationStore';
import { useModelStore } from '../../stores/modelStore';
import { McpServerManager } from './McpServerManager';
import { useTranslation } from '../../i18n';
import { ArrowLeft, Plus, RefreshCw, Trash2, Activity, Download, ToggleLeft, ToggleRight, Radio, Info } from 'lucide-react';

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const stations = useStationStore(s => s.stations);
  const loading = useStationStore(s => s.loading);
  const fetchStations = useStationStore(s => s.fetchStations);
  const createStation = useStationStore(s => s.createStation);
  const deleteStation = useStationStore(s => s.deleteStation);
  const updateStation = useStationStore(s => s.updateStation);
  const pullModels = useStationStore(s => s.pullModels);
  const healthCheck = useStationStore(s => s.healthCheck);
  const fetchModels = useModelStore(s => s.fetchModels);
  const { t } = useTranslation();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newKey, setNewKey] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePullModels = async (id: string) => {
    try {
      setError('');
      setSuccess('');
      setActionLoading(`pull-${id}`);
      await pullModels(id);
      await fetchModels();
      const station = stations.find(s => s.id === id);
      setSuccess(t('settings.modelsPulled', { name: station?.name || 'station' }));
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleHealthCheck = async (id: string) => {
    try {
      setActionLoading(`health-${id}`);
      await healthCheck(id);
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await updateStation(id, { enabled });
      await fetchModels();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-main-surface-primary)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)]">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{t('settings.title')}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full">
        {/* Station Management Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{t('settings.relayStations')}</h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{t('settings.relayStationsDesc')}</p>
            </div>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white text-[13px] font-medium transition-colors duration-150"
            >
              <Plus size={16} strokeWidth={2} />
              {t('settings.addStation')}
            </button>
          </div>

          {/* Add station form */}
          {showAdd && (
            <div className="mb-5 p-5 rounded-2xl bg-[var(--color-main-surface-tertiary)] border border-[var(--color-border-light)]">
              <div className="grid gap-3.5">
                <div>
                  <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5 font-medium">{t('settings.stationName')}</label>
                  <input
                    type="text"
                    placeholder={t('settings.stationNamePlaceholder')}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-border-medium)] transition-colors placeholder-[var(--color-text-tertiary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5 font-medium">{t('settings.baseUrl')}</label>
                  <input
                    type="text"
                    placeholder={t('settings.baseUrlPlaceholder')}
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-border-medium)] transition-colors placeholder-[var(--color-text-tertiary)]"
                  />
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">{t('settings.baseUrlHint')}</p>
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5 font-medium">{t('settings.apiKey')}</label>
                  <input
                    type="password"
                    placeholder={t('settings.apiKeyPlaceholder')}
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-border-medium)] transition-colors placeholder-[var(--color-text-tertiary)]"
                  />
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">{t('settings.apiKeyHint')}</p>
                </div>
              </div>
              {error && (
                <p className="text-[var(--color-text-error)] text-sm px-3 py-2 rounded-lg bg-[var(--color-surface-error)] whitespace-pre-wrap break-all mt-3">{error}</p>
              )}
              <div className="flex gap-2.5 justify-end pt-3">
                <button
                  onClick={() => { setShowAdd(false); setError(''); }}
                  className="px-4 py-2 rounded-lg text-[13px] text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.05)] transition-colors font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAdd}
                  disabled={actionLoading === 'add'}
                  className="px-4 py-2 rounded-lg bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white text-[13px] font-medium disabled:opacity-40 transition-colors"
                >
                  {actionLoading === 'add' ? t('settings.adding') : t('settings.addStation')}
                </button>
              </div>
            </div>
          )}

          {/* Global error/success banner */}
          {error && !showAdd && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--color-surface-error)] border border-[var(--color-border-light)] flex items-start gap-3">
              <div className="flex-1 text-sm text-[var(--color-text-error)] whitespace-pre-wrap break-all">{error}</div>
              <button onClick={() => setError('')} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] flex-shrink-0 mt-0.5">✕</button>
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--color-surface-success)] border border-[var(--color-border-light)] flex items-start gap-3">
              <div className="flex-1 text-sm text-[var(--color-text-success)]">{success}</div>
              <button onClick={() => setSuccess('')} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] flex-shrink-0 mt-0.5">✕</button>
            </div>
          )}

          {/* Station list */}
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
              {stations.map(station => (
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
                            : 'bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)]'
                        }`}>
                          {station.healthStatus}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-tertiary)] truncate font-mono">{station.baseUrl}</p>
                    </div>

                    {/* Toggle */}
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

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handlePullModels(station.id)}
                      disabled={actionLoading === `pull-${station.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] text-xs text-[var(--color-text-secondary)] transition-colors disabled:opacity-40 font-medium"
                    >
                      <Download size={13} />
                      {actionLoading === `pull-${station.id}` ? t('settings.pulling') : t('settings.pullModels')}
                    </button>
                    <button
                      onClick={() => handleHealthCheck(station.id)}
                      disabled={actionLoading === `health-${station.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] text-xs text-[var(--color-text-secondary)] transition-colors disabled:opacity-40 font-medium"
                    >
                      <Activity size={13} />
                      {actionLoading === `health-${station.id}` ? t('settings.checking') : t('settings.healthCheck')}
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MCP Server Management Section */}
        <McpServerManager />

        {/* Info section */}
        <div className="p-5 rounded-2xl bg-[var(--color-main-surface-tertiary)] border border-[var(--color-border-light)]">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-[var(--color-text-tertiary)]" />
            <h3 className="font-medium text-sm text-[var(--color-text-primary)]">{t('settings.howItWorks')}</h3>
          </div>
          <ul className="text-xs text-[var(--color-text-tertiary)] space-y-2 leading-5">
            {[1, 2, 3, 4, 5].map(i => (
              <li key={i} className="flex gap-2"><span className="text-[var(--color-text-secondary)]">{i}.</span> {t(`settings.howItWorksStep${i}`)}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
