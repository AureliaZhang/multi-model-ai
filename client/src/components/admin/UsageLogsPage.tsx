import { useEffect, useState } from 'react';
import { usageApi } from '../../services/api';
import type { UsageLogItem } from '../../types';
import { useTranslation } from '../../i18n';
import { ArrowLeft, RefreshCw } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export function UsageLogsPage({ onBack }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<UsageLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [username, setUsername] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = async (nextOffset = 0) => {
    setLoading(true);
    try {
      const res = await usageApi.list({
        limit,
        offset: nextOffset,
        status: status || undefined,
        kind: kind || undefined,
        username: username || undefined,
      });
      if (res.success && res.data) {
        setItems(res.data.items);
        setTotal(res.data.total);
        setErrors(res.data.summary.errors);
        setTotalTokens(res.data.summary.totalTokens);
        setOffset(nextOffset);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusColor = (s: string) => {
    if (s === 'ok') return 'text-[var(--color-text-success)]';
    if (s === 'http_error' || s === 'error') return 'text-[var(--color-text-error)]';
    return 'text-[var(--color-text-tertiary)]';
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-main-surface-primary)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)]">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-[var(--overlay-5)] text-[var(--color-text-secondary)]"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{t('usage.title')}</h1>
          <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">{t('usage.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => load(offset)}
          className="p-2 rounded-lg hover:bg-[var(--overlay-5)] text-[var(--color-text-secondary)]"
          title={t('common.loading')}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4 flex flex-wrap gap-2 border-b border-[var(--color-border-light)]">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-xs"
        >
          <option value="">{t('usage.allStatus')}</option>
          <option value="ok">ok</option>
          <option value="error">error</option>
          <option value="http_error">http_error / 5xx</option>
          <option value="timeout">timeout</option>
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-xs"
        >
          <option value="">{t('usage.allKind')}</option>
          <option value="chat">chat</option>
          <option value="image">image</option>
          <option value="tts">tts</option>
        </select>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('usage.username')}
          className="px-2 py-1.5 rounded-lg bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-xs"
        />
        <button
          type="button"
          onClick={() => load(0)}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-accent-main)] text-white text-xs"
        >
          {t('usage.filter')}
        </button>
        <div className="ml-auto text-[11px] text-[var(--color-text-tertiary)] flex items-center gap-3">
          <span>{t('usage.total')}: {total}</span>
          <span className="text-[var(--color-text-error)]">{t('usage.errors')}: {errors}</span>
          <span>{t('usage.tokens')}: {totalTokens}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <table className="w-full text-left text-[12px] border-collapse min-w-[900px]">
          <thead className="text-[var(--color-text-tertiary)] sticky top-0 bg-[var(--color-main-surface-primary)]">
            <tr>
              <th className="py-2 px-2 font-medium">{t('usage.time')}</th>
              <th className="py-2 px-2 font-medium">{t('usage.user')}</th>
              <th className="py-2 px-2 font-medium">{t('usage.kind')}</th>
              <th className="py-2 px-2 font-medium">{t('usage.model')}</th>
              <th className="py-2 px-2 font-medium">{t('usage.tokens')}</th>
              <th className="py-2 px-2 font-medium">{t('usage.status')}</th>
              <th className="py-2 px-2 font-medium">{t('usage.latency')}</th>
              <th className="py-2 px-2 font-medium">{t('usage.error')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t border-[var(--color-border-light)]/50 hover:bg-[var(--overlay-3)]">
                <td className="py-2 px-2 whitespace-nowrap text-[var(--color-text-secondary)]">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="py-2 px-2">
                  <div className="text-[var(--color-text-primary)]">{row.username || '—'}</div>
                  <div className="text-[10px] text-[var(--color-text-tertiary)]">{row.role || ''}</div>
                </td>
                <td className="py-2 px-2 text-[var(--color-text-secondary)]">{row.kind}</td>
                <td className="py-2 px-2 max-w-[180px]">
                  <div className="truncate text-[var(--color-text-primary)]" title={row.modelNormalized || ''}>
                    {row.modelNormalized || '—'}
                  </div>
                  <div className="truncate text-[10px] text-[var(--color-text-tertiary)]" title={row.modelUsed || ''}>
                    {row.modelUsed || row.stationName || ''}
                  </div>
                </td>
                <td className="py-2 px-2 text-[var(--color-text-secondary)] whitespace-nowrap">
                  {row.totalTokens != null
                    ? row.totalTokens
                    : row.promptTokens != null || row.completionTokens != null
                      ? `${row.promptTokens ?? 0}+${row.completionTokens ?? 0}`
                      : '—'}
                </td>
                <td className={`py-2 px-2 font-medium ${statusColor(row.status)}`}>
                  {row.status}
                  {row.httpStatus ? ` ${row.httpStatus}` : ''}
                </td>
                <td className="py-2 px-2 text-[var(--color-text-tertiary)]">
                  {row.latencyMs != null ? `${row.latencyMs}ms` : '—'}
                </td>
                <td className="py-2 px-2 max-w-[220px] text-[var(--color-text-error)] truncate" title={row.errorMessage || ''}>
                  {row.errorMessage || ''}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[var(--color-text-tertiary)]">
                  {t('usage.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border-light)] text-xs text-[var(--color-text-tertiary)]">
        <button
          type="button"
          disabled={offset <= 0 || loading}
          onClick={() => load(Math.max(0, offset - limit))}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border-light)] disabled:opacity-40"
        >
          {t('usage.prev')}
        </button>
        <span>
          {offset + 1}-{Math.min(offset + limit, total)} / {total}
        </span>
        <button
          type="button"
          disabled={offset + limit >= total || loading}
          onClick={() => load(offset + limit)}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border-light)] disabled:opacity-40"
        >
          {t('usage.next')}
        </button>
      </div>
    </div>
  );
}
