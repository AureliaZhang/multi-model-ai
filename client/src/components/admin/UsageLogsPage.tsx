import { useEffect, useState } from 'react';
import { usageApi } from '../../services/api';
import type { UsageLogItem, UsageSummary, ModelPricingEntry } from '../../types';
import { useTranslation } from '../../i18n';
import { TopRightToggles } from '../layout/TopRightToggles';
import { ArrowLeft, RefreshCw, ChevronDown, ChevronRight, Coins, Check } from 'lucide-react';

/** Compact money formatting; null = model/user not priced yet. */
function fmtCost(c: number | null | undefined, incomplete = false): string {
  if (c == null) return '—';
  const n = c >= 100 ? c.toFixed(1) : c >= 0.01 || c === 0 ? c.toFixed(2) : c.toFixed(4);
  return incomplete ? `≥${n}` : n;
}

interface Props {
  onBack: () => void;
}

export function UsageLogsPage({ onBack }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<UsageLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  // Model unit pricing editor (v0.7.54)
  const [pricing, setPricing] = useState<ModelPricingEntry[]>([]);
  const [showPricing, setShowPricing] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, { p: string; c: string }>>({});
  const [savedModel, setSavedModel] = useState<string | null>(null);
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
      // Aggregated dashboard (respects kind/username; not status/paging).
      const sumRes = await usageApi.getSummary({
        kind: kind || undefined,
        username: username || undefined,
      });
      if (sumRes.success && sumRes.data) setSummary(sumRes.data);
    } finally {
      setLoading(false);
    }
  };

  const loadPricing = async () => {
    const res = await usageApi.getPricing();
    if (res.success && res.data) {
      setPricing(res.data);
      setPriceDrafts(Object.fromEntries(res.data.map((m) => [
        m.modelNormalized,
        { p: m.promptPricePerM != null ? String(m.promptPricePerM) : '', c: m.completionPricePerM != null ? String(m.completionPricePerM) : '' },
      ])));
    }
  };

  const savePricing = async (model: string) => {
    const d = priceDrafts[model];
    if (!d) return;
    const res = await usageApi.setPricing(model, {
      promptPricePerM: Math.max(0, Number(d.p) || 0),
      completionPricePerM: Math.max(0, Number(d.c) || 0),
    });
    if (res.success) {
      setSavedModel(model);
      setTimeout(() => setSavedModel((prev) => (prev === model ? null : prev)), 1500);
      // Refresh the summary so the new prices show up in the cost columns.
      const sumRes = await usageApi.getSummary({ kind: kind || undefined, username: username || undefined });
      if (sumRes.success && sumRes.data) setSummary(sumRes.data);
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
          aria-label={t('common.back')}
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
        <TopRightToggles variant="inline" />
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

      {/* Aggregated dashboard: per-user + per-model token usage (§10.8 Phase 3) */}
      <div className="border-b border-[var(--color-border-light)]">
        <button
          type="button"
          onClick={() => setShowSummary((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--overlay-3)]"
        >
          {showSummary ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {t('usage.summaryTitle')}
          {summary && (
            <span className="ml-2 text-[10px] text-[var(--color-text-tertiary)] font-normal">
              {t('usage.summaryMeta', { users: summary.totals.users, tokens: summary.totals.tokens.toLocaleString() })}
              {summary.totals.cost != null && (
                <span className="ml-2" title={summary.totals.costIncomplete ? t('usage.costIncompleteHint') : ''}>
                  · {t('usage.cost')}: {fmtCost(summary.totals.cost, summary.totals.costIncomplete)}
                </span>
              )}
            </span>
          )}
        </button>
        {showSummary && summary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 pb-4">
            {/* By user */}
            <div>
              <div className="text-[11px] font-medium text-[var(--color-text-tertiary)] mb-1">{t('usage.byUser')}</div>
              <div className="overflow-x-auto max-h-52 overflow-y-auto rounded-lg border border-[var(--color-border-light)]">
                <table className="w-full text-left text-[11px] border-collapse min-w-[320px]">
                  <thead className="text-[var(--color-text-tertiary)] sticky top-0 bg-[var(--color-main-surface-primary)]">
                    <tr>
                      <th className="py-1.5 px-2 font-medium">{t('usage.user')}</th>
                      <th className="py-1.5 px-2 font-medium text-right">{t('usage.requests')}</th>
                      <th className="py-1.5 px-2 font-medium text-right">{t('usage.tokens')}</th>
                      <th className="py-1.5 px-2 font-medium text-right">{t('usage.cost')}</th>
                      <th className="py-1.5 px-2 font-medium text-right">{t('usage.errors')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byUser.map((u) => (
                      <tr key={u.userId || 'none'} className="border-t border-[var(--color-border-light)]/50">
                        <td className="py-1.5 px-2 text-[var(--color-text-primary)]">{u.username || '—'}</td>
                        <td className="py-1.5 px-2 text-right text-[var(--color-text-secondary)]">{u.requests}</td>
                        <td className="py-1.5 px-2 text-right text-[var(--color-text-secondary)]">{u.tokens.toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right text-[var(--color-text-secondary)]" title={u.costIncomplete ? t('usage.costIncompleteHint') : ''}>{fmtCost(u.cost, u.costIncomplete)}</td>
                        <td className="py-1.5 px-2 text-right text-[var(--color-text-error)]">{u.errors || ''}</td>
                      </tr>
                    ))}
                    {summary.byUser.length === 0 && (
                      <tr><td colSpan={5} className="py-4 text-center text-[var(--color-text-tertiary)]">{t('usage.empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* By model */}
            <div>
              <div className="text-[11px] font-medium text-[var(--color-text-tertiary)] mb-1">{t('usage.byModel')}</div>
              <div className="overflow-x-auto max-h-52 overflow-y-auto rounded-lg border border-[var(--color-border-light)]">
                <table className="w-full text-left text-[11px] border-collapse min-w-[320px]">
                  <thead className="text-[var(--color-text-tertiary)] sticky top-0 bg-[var(--color-main-surface-primary)]">
                    <tr>
                      <th className="py-1.5 px-2 font-medium">{t('usage.model')}</th>
                      <th className="py-1.5 px-2 font-medium text-right">{t('usage.requests')}</th>
                      <th className="py-1.5 px-2 font-medium text-right">{t('usage.tokens')}</th>
                      <th className="py-1.5 px-2 font-medium text-right">{t('usage.cost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byModel.map((m) => (
                      <tr key={m.modelNormalized || 'none'} className="border-t border-[var(--color-border-light)]/50">
                        <td className="py-1.5 px-2 text-[var(--color-text-primary)] max-w-[180px] truncate" title={m.modelNormalized || ''}>{m.modelNormalized || '—'}</td>
                        <td className="py-1.5 px-2 text-right text-[var(--color-text-secondary)]">{m.requests}</td>
                        <td className="py-1.5 px-2 text-right text-[var(--color-text-secondary)]">{m.tokens.toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right text-[var(--color-text-secondary)]">{fmtCost(m.cost)}</td>
                      </tr>
                    ))}
                    {summary.byModel.length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-center text-[var(--color-text-tertiary)]">{t('usage.empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Model unit pricing editor (v0.7.54) */}
      <div className="border-b border-[var(--color-border-light)]">
        <button
          type="button"
          onClick={() => { setShowPricing((v) => { if (!v) void loadPricing(); return !v; }); }}
          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--overlay-3)]"
        >
          {showPricing ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Coins size={13} className="text-[var(--color-accent-main)]" />
          {t('usage.pricingTitle')}
        </button>
        {showPricing && (
          <div className="px-4 pb-4">
            <p className="text-[11px] text-[var(--color-text-tertiary)] mb-2">{t('usage.pricingDesc')}</p>
            {pricing.length === 0 ? (
              <div className="text-[11px] text-[var(--color-text-tertiary)] py-2">{t('usage.empty')}</div>
            ) : (
              <div className="space-y-1.5 max-w-xl">
                {pricing.map((m) => (
                  <div key={m.modelNormalized} className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="w-44 truncate text-[var(--color-text-primary)]" title={m.modelNormalized}>{m.modelNormalized}</span>
                    <input
                      type="number" min={0} step="0.01"
                      value={priceDrafts[m.modelNormalized]?.p ?? ''}
                      onChange={(e) => setPriceDrafts((d) => ({ ...d, [m.modelNormalized]: { p: e.target.value, c: d[m.modelNormalized]?.c ?? '' } }))}
                      placeholder={t('usage.promptPrice')}
                      title={t('usage.promptPrice')}
                      className="w-24 px-2 py-1 rounded-md bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-right"
                    />
                    <input
                      type="number" min={0} step="0.01"
                      value={priceDrafts[m.modelNormalized]?.c ?? ''}
                      onChange={(e) => setPriceDrafts((d) => ({ ...d, [m.modelNormalized]: { p: d[m.modelNormalized]?.p ?? '', c: e.target.value } }))}
                      placeholder={t('usage.completionPrice')}
                      title={t('usage.completionPrice')}
                      className="w-24 px-2 py-1 rounded-md bg-[var(--overlay-4)] border border-[var(--color-border-light)] text-right"
                    />
                    <button
                      type="button"
                      onClick={() => void savePricing(m.modelNormalized)}
                      className="px-2.5 py-1 rounded-md bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white"
                    >
                      {savedModel === m.modelNormalized ? <Check size={12} /> : t('common.save')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
