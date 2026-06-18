import { useEffect, useState } from 'react';
import { useMcpStore } from '../../stores/mcpStore';
import { useTranslation } from '../../i18n';
import {
  Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight, PlugZap,
  ChevronDown, ChevronUp, Wrench, Server, AlertCircle, CheckCircle, XCircle,
} from 'lucide-react';

export function McpServerManager() {
  const servers = useMcpStore(s => s.servers);
  const tools = useMcpStore(s => s.tools);
  const selectedServerId = useMcpStore(s => s.selectedServerId);
  const loading = useMcpStore(s => s.loading);
  const fetchServers = useMcpStore(s => s.fetchServers);
  const createServer = useMcpStore(s => s.createServer);
  const deleteServer = useMcpStore(s => s.deleteServer);
  const updateServer = useMcpStore(s => s.updateServer);
  const connectServer = useMcpStore(s => s.connectServer);
  const selectServer = useMcpStore(s => s.selectServer);
  const toggleTool = useMcpStore(s => s.toggleTool);
  const { t } = useTranslation();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [connectResult, setConnectResult] = useState<{ serverId: string; count: number } | null>(null);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleAdd = async () => {
    if (!newName || !newUrl) {
      setError(t('mcp.nameUrlRequired'));
      return;
    }
    setError('');
    try {
      setActionLoading('add');
      await createServer({ name: newName, url: newUrl, description: newDesc || undefined });
      setNewName('');
      setNewUrl('');
      setNewDesc('');
      setShowAdd(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnect = async (id: string) => {
    try {
      setActionLoading(`connect-${id}`);
      setConnectResult(null);
      const result = await connectServer(id);
      setConnectResult({ serverId: id, count: result.toolsCount });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('mcp.deleteConfirm'))) return;
    try {
      setActionLoading(`delete-${id}`);
      await deleteServer(id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleServer = async (id: string, enabled: boolean) => {
    try {
      await updateServer(id, { enabled });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleTool = async (toolId: string, enabled: boolean) => {
    try {
      await toggleTool(toolId, enabled);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle size={12} className="text-green-400" />;
      case 'error': return <XCircle size={12} className="text-red-400" />;
      default: return <AlertCircle size={12} className="text-[var(--color-text-tertiary)]" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-[var(--color-surface-success)] text-[var(--color-text-success)]';
      case 'error': return 'bg-[var(--color-surface-error)] text-[var(--color-text-error)]';
      default: return 'bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)]';
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{t('mcp.title')}</h2>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{t('mcp.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white text-[13px] font-medium transition-colors duration-150"
        >
          <Plus size={16} strokeWidth={2} />
          {t('mcp.addServer')}
        </button>
      </div>

      {/* Add server form */}
      {showAdd && (
        <div className="mb-5 p-5 rounded-2xl bg-[var(--color-main-surface-tertiary)] border border-[var(--color-border-light)]">
          <div className="grid gap-3.5">
            <div>
              <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5 font-medium">{t('mcp.serverName')}</label>
              <input
                type="text"
                placeholder={t('mcp.serverNamePlaceholder')}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-border-medium)] transition-colors placeholder-[var(--color-text-tertiary)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5 font-medium">{t('mcp.serverUrl')}</label>
              <input
                type="text"
                placeholder={t('mcp.serverUrlPlaceholder')}
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-border-medium)] transition-colors placeholder-[var(--color-text-tertiary)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-tertiary)] mb-1.5 font-medium">{t('mcp.description')}</label>
              <input
                type="text"
                placeholder={t('mcp.descriptionPlaceholder')}
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-main-surface-primary)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-border-medium)] transition-colors placeholder-[var(--color-text-tertiary)]"
              />
            </div>
            {error && (
              <p className="text-[var(--color-text-error)] text-sm px-3 py-2 rounded-lg bg-[var(--color-surface-error)]">{error}</p>
            )}
            <div className="flex gap-2.5 justify-end pt-1">
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
                {actionLoading === 'add' ? t('mcp.adding') : t('mcp.addServer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server list */}
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)] text-sm">
          <RefreshCw size={20} className="mx-auto mb-2 animate-spin" />
          {t('mcp.loadingServers')}
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-[var(--color-border-light)]">
          <Server size={32} className="mx-auto mb-3 text-[var(--color-text-tertiary)]" />
          <p className="text-[var(--color-text-secondary)] text-sm mb-1">{t('mcp.noServers')}</p>
          <p className="text-[var(--color-text-tertiary)] text-xs">{t('mcp.noServersHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map(server => (
            <div
              key={server.id}
              className="group rounded-2xl bg-[var(--color-main-surface-tertiary)] border border-[var(--color-border-light)] hover:border-[var(--color-border-medium)] transition-colors"
            >
              {/* Server header */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="font-medium text-sm text-[var(--color-text-primary)]">{server.name}</h3>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusColor(server.status)}`}>
                        {statusIcon(server.status)}
                        {server.status}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)]">
                        {t('mcp.tools', { count: server.toolCount || 0 })}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] truncate font-mono">{server.url}</p>
                    {server.description && (
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{server.description}</p>
                    )}
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleServer(server.id, !server.enabled)}
                    className="ml-3 flex-shrink-0"
                    title={server.enabled ? t('common.disable') : t('common.enable')}
                  >
                    {server.enabled ? (
                      <ToggleRight size={28} className="text-[var(--color-accent-main)]" />
                    ) : (
                      <ToggleLeft size={28} className="text-[var(--color-text-tertiary)]" />
                    )}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleConnect(server.id)}
                    disabled={actionLoading === `connect-${server.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] text-xs text-[var(--color-text-secondary)] transition-colors disabled:opacity-40 font-medium"
                  >
                    {actionLoading === `connect-${server.id}` ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <PlugZap size={13} />
                    )}
                    {actionLoading === `connect-${server.id}` ? t('mcp.connecting') : t('mcp.connectDiscover')}
                  </button>
                  <button
                    onClick={() => selectServer(selectedServerId === server.id ? null : server.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] text-xs text-[var(--color-text-secondary)] transition-colors font-medium"
                  >
                    <Wrench size={13} />
                    {selectedServerId === server.id ? t('mcp.hideTools') : t('mcp.viewTools')}
                    {selectedServerId === server.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <button
                    onClick={() => handleDelete(server.id)}
                    disabled={actionLoading === `delete-${server.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--color-surface-error)] text-xs text-[var(--color-text-error)] transition-colors disabled:opacity-40 font-medium ml-auto"
                  >
                    <Trash2 size={13} />
                    {t('common.delete')}
                  </button>
                </div>

                {/* Connect result */}
                {connectResult && connectResult.serverId === server.id && (
                  <div className="mt-2 text-xs text-[var(--color-text-success)] bg-[var(--color-surface-success)] px-3 py-1.5 rounded-lg">
                    {t('mcp.discovered', { count: connectResult.count })}
                  </div>
                )}
              </div>

              {/* Tools list (expanded) */}
              {selectedServerId === server.id && (
                <div className="border-t border-[var(--color-border-light)] px-4 pb-4">
                  {tools.length === 0 ? (
                    <div className="text-center py-6 text-[var(--color-text-tertiary)] text-xs">
                      {t('mcp.noTools')}
                    </div>
                  ) : (
                    <div className="space-y-2 pt-3">
                      {tools.map(tool => (
                        <div
                          key={tool.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="flex items-center gap-2">
                              <Wrench size={12} className="text-[var(--color-text-tertiary)] flex-shrink-0" />
                              <span className="text-xs font-medium text-[var(--color-text-primary)]">{tool.name}</span>
                            </div>
                            {tool.description && (
                              <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 ml-5 truncate">
                                {tool.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleTool(tool.id, !tool.enabled)}
                            className="flex-shrink-0"
                            title={tool.enabled ? t('common.disable') : t('common.enable')}
                          >
                            {tool.enabled ? (
                              <ToggleRight size={24} className="text-[var(--color-accent-main)]" />
                            ) : (
                              <ToggleLeft size={24} className="text-[var(--color-text-tertiary)]" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
