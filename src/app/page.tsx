'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Deal } from '@/lib/types';
import { normalizeCapRate, normalizeMarketValue } from '@/lib/normalization';

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

type MarketListItem = {
  name: string;
  zipCount: number;
};

type SeriesMap = Record<string, Record<string, number | null>>;
type MetricMeta = Record<string, { unit: string | null }>;
type MarketIntelResponse = {
  msa: { id: string; name: string } | null;
  series: SeriesMap;
  metrics: MetricMeta;
  snapshot?: Record<string, unknown>;
  list?: Record<string, unknown>;
};

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value)
  );
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function formatMetricValue(value: number | null | undefined, unit?: string | null): string {
  const normalized = normalizeMarketValue(value);
  if (normalized === null) return 'N/A';
  switch (unit) {
    case 'currency':
      return formatCurrency(normalized);
    case 'percent': {
      const sign = normalized > 0 ? '+' : '';
      return `${sign}${normalized.toFixed(2)}%`;
    }
    case 'count':
      return formatNumber(Math.round(normalized));
    case 'ratio':
      return normalized.toFixed(2);
    case 'index':
      return normalized.toFixed(1);
    default:
      return formatNumber(normalized);
  }
}

function getSeriesValue(series: SeriesMap, metricKey: string, period: number): number | null {
  return series[metricKey]?.[String(period)] ?? null;
}

function formatSeriesValue(
  series: SeriesMap,
  metrics: MetricMeta,
  metricKey: string,
  period: number
): string {
  return formatMetricValue(getSeriesValue(series, metricKey, period), metrics[metricKey]?.unit);
}

export default function Dashboard() {
  const { deals } = useStore();
  const [marketList, setMarketList] = useState<MarketListItem[]>([]);
  const [selectedMsaName, setSelectedMsaName] = useState<string | null>(null);
  const [marketIntel, setMarketIntel] = useState<MarketIntelResponse | null>(null);
  const [isMarketLoading, setIsMarketLoading] = useState(false);
  const [isIntelLoading, setIsIntelLoading] = useState(false);
  const [marketListError, setMarketListError] = useState<string | null>(null);
  const [intelError, setIntelError] = useState<string | null>(null);

  // Calculate summaries
  const evaluationSummary = {
    rejected: deals.filter(d => d.evaluationStatus === 'REJECTED').length,
    missingInfo: deals.filter(d => d.evaluationStatus === 'MISSING_INFO').length,
    active: deals.filter(d => d.evaluationStatus === 'ACTIVE').length,
  };

  const activeDeals = deals.filter(d => d.evaluationStatus === 'ACTIVE');
  const executionSummary = {
    unprocessed: activeDeals.filter(d => d.executionStage === 'UNPROCESSED').length,
    outreach: activeDeals.filter(d => d.executionStage === 'OUTREACH').length,
    negotiation: activeDeals.filter(d => d.executionStage === 'NEGOTIATION').length,
    completed: activeDeals.filter(d => d.executionStage === 'COMPLETED').length,
  };

  const evaluationMax = Math.max(
    1,
    evaluationSummary.active,
    evaluationSummary.missingInfo,
    evaluationSummary.rejected
  );
  const executionMax = Math.max(
    1,
    executionSummary.unprocessed,
    executionSummary.outreach,
    executionSummary.negotiation,
    executionSummary.completed
  );

  // Calculate pipeline value for active deals and all evaluated deals
  const pipelineValue = activeDeals.reduce((sum, d) => sum + (d.askPrice || 0), 0);
  const totalPipelineValue = deals.reduce((sum, d) => sum + (d.askPrice || 0), 0);

  useEffect(() => {
    let isActive = true;

    setIsMarketLoading(true);
    setMarketListError(null);

    fetch('/api/market-intel')
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load markets.');
        return response.json();
      })
      .then(data => {
        if (!isActive) return;
        if (Array.isArray(data.msas)) {
          const list = data.msas.map((msa: { name: string; zipCount?: number }) => ({
            name: msa.name,
            zipCount: msa.zipCount || 0,
          }));
          setMarketList(list);
          setSelectedMsaName(prev => (prev && list.some(m => m.name === prev) ? prev : list[0]?.name || null));
        }
      })
      .catch(() => {
        if (!isActive) return;
        setMarketList([]);
        setMarketListError('Unable to load markets.');
      })
      .finally(() => {
        if (!isActive) return;
        setIsMarketLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    if (!selectedMsaName) {
      setMarketIntel(null);
      setIntelError(null);
      return () => {
        isActive = false;
      };
    }

    setIsIntelLoading(true);
    setIntelError(null);

    fetch(`/api/market-intel?msa=${encodeURIComponent(selectedMsaName)}`)
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load market intelligence.');
        }
        return payload as MarketIntelResponse;
      })
      .then(data => {
        if (!isActive) return;
        setMarketIntel(data);
      })
      .catch(error => {
        if (!isActive) return;
        setMarketIntel(null);
        setIntelError(error?.message || 'Unable to load market intelligence.');
      })
      .finally(() => {
        if (!isActive) return;
        setIsIntelLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [selectedMsaName]);

  const selectedMarketDeals = deals.filter(d => d.msaName === selectedMsaName);
  const selectedMarketActiveDeals = selectedMarketDeals.filter(d => d.evaluationStatus === 'ACTIVE');
  const avgCapRate = average(selectedMarketDeals.map(deal => normalizeCapRate(deal.capRate)));
  const hasIntelData = Object.keys(marketIntel?.series || {}).length > 0;
  const marketStatusLabel = isIntelLoading
    ? 'Loading cache...'
    : intelError
      ? 'Cache error'
      : hasIntelData
        ? 'Cached'
        : 'Data pending';
  const series = marketIntel?.series ?? {};
  const metrics = marketIntel?.metrics ?? {};
  const populationValue = formatSeriesValue(series, metrics, 'population', 1);
  const growthValue = formatSeriesValue(series, metrics, 'population_growth', 1);
  const capRateSeriesValue = formatSeriesValue(series, metrics, 'avg_cap_rate', 1);
  const capRateValue = capRateSeriesValue !== 'N/A'
    ? capRateSeriesValue
    : avgCapRate
      ? `${avgCapRate.toFixed(2)}%`
      : 'N/A';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-100 tracking-tight mb-2">Dashboard</h1>
        <p className="text-slate-400">Real-time deal pipeline and market analysis</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Deals',
            value: evaluationSummary.active.toString(),
            color: 'text-emerald-400',
            iconBg: 'from-emerald-500/20 to-emerald-600/20',
          },
          {
            label: 'In Negotiation',
            value: executionSummary.negotiation.toString(),
            color: 'text-purple-400',
            iconBg: 'from-purple-500/20 to-purple-600/20',
          },
          {
            label: 'Active Deal Value',
            value: formatCurrency(pipelineValue),
            color: 'text-blue-400',
            iconBg: 'from-blue-500/20 to-blue-600/20',
          },
          {
            label: 'Total Pipeline Deal Value',
            value: formatCurrency(totalPipelineValue),
            color: 'text-teal-400',
            iconBg: 'from-teal-500/20 to-teal-600/20',
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-2">{metric.label}</p>
                <p className={`text-3xl font-bold ${metric.color}`}>{metric.value}</p>
              </div>
              <div className={`p-3 rounded-lg bg-gradient-to-br ${metric.iconBg}`}>
                <div className={`w-5 h-5 rounded ${metric.color} bg-current opacity-50`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Markets + Market Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Markets Sidebar */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg overflow-hidden lg:col-span-1">
          <div className="border-b border-slate-700/50 px-5 py-4">
            <h2 className="font-semibold text-slate-200">Markets</h2>
            <p className="text-sm text-slate-500">Active opportunities</p>
          </div>
          <div className="p-3 space-y-1">
            {marketList.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                {isMarketLoading
                  ? 'Loading markets...'
                  : marketListError || 'No markets found in Market Intelligence yet.'}
              </div>
            ) : (
              marketList.map(market => {
                const marketDeals = deals.filter(d => d.msaName === market.name);
                const activeCount = marketDeals.filter(d => d.evaluationStatus === 'ACTIVE').length;
                const isSelected = selectedMsaName === market.name;
                return (
                  <button
                    key={market.name}
                    onClick={() => setSelectedMsaName(market.name)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-blue-500/15 border border-blue-500/30'
                        : 'hover:bg-slate-700/30 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm text-slate-100">{market.name}</p>
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                        {activeCount}/{marketDeals.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{market.zipCount} ZIPs</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Market Details & Pipelines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Selected Market Details */}
          {selectedMsaName && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="border-b border-slate-700/50 px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">{selectedMsaName}</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Market intelligence cache and active deal coverage
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-700/40 text-slate-200">
                    {marketStatusLabel}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Population', value: populationValue },
                    { label: 'Growth', value: growthValue },
                    { label: 'Cap Rate', value: capRateValue },
                    { label: 'Deals', value: `${selectedMarketActiveDeals.length}/${selectedMarketDeals.length}` },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-4 rounded-lg bg-slate-700/30 border border-slate-600/30 hover:bg-slate-700/50 transition-colors"
                    >
                      <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                      <p className="font-semibold text-slate-100">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Evaluation Pipeline Summary */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-200">Evaluation Pipeline</h2>
                <p className="text-sm text-slate-500">{deals.length} total deals</p>
              </div>
              <Link
                href="/evaluation"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: 'Active', count: evaluationSummary.active, color: 'from-emerald-400 to-emerald-500', textColor: 'text-emerald-400' },
                  { label: 'Missing Info', count: evaluationSummary.missingInfo, color: 'from-amber-400 to-amber-500', textColor: 'text-amber-400' },
                  { label: 'Rejected', count: evaluationSummary.rejected, color: 'from-red-400 to-red-500', textColor: 'text-red-400' },
                ].map((item) => (
                  <div key={item.label} className="space-y-3">
                    <div className="h-24 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 flex items-end">
                      <div
                        className={`w-full rounded-md bg-gradient-to-t ${item.color}`}
                        style={{ height: `${(item.count / evaluationMax) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                      <span>{item.label}</span>
                      <span className={item.textColor}>{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Execution Pipeline Summary */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-200">Execution Pipeline</h2>
                <p className="text-sm text-slate-500">{activeDeals.length} active deals</p>
              </div>
              <Link
                href="/execution"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'Unprocessed', count: executionSummary.unprocessed, color: 'from-slate-400 to-slate-500', textColor: 'text-slate-300' },
                  { label: 'Outreach', count: executionSummary.outreach, color: 'from-blue-400 to-blue-500', textColor: 'text-blue-400' },
                  { label: 'Negotiation', count: executionSummary.negotiation, color: 'from-purple-400 to-purple-500', textColor: 'text-purple-400' },
                  { label: 'Completed', count: executionSummary.completed, color: 'from-emerald-400 to-emerald-500', textColor: 'text-emerald-400' },
                ].map((item) => (
                  <div key={item.label} className="space-y-3">
                    <div className="h-24 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 flex items-end">
                      <div
                        className={`w-full rounded-md bg-gradient-to-t ${item.color}`}
                        style={{ height: `${(item.count / executionMax) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                      <span>{item.label}</span>
                      <span className={item.textColor}>{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="border-b border-slate-700/50 px-6 py-4">
          <h2 className="font-semibold text-slate-200">Recent Activity</h2>
          <p className="text-sm text-slate-500">Latest deal updates</p>
        </div>
        <div className="divide-y divide-slate-700/50">
          {[...deals]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5)
            .map(deal => (
              <RecentDealRow key={deal.id} deal={deal} />
            ))}
        </div>
      </div>
    </div>
  );
}

function RecentDealRow({ deal }: { deal: Deal }) {
  const marketLabel = deal.msaName || 'MSA Unassigned';
  const statusStyles = {
    REJECTED: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
    MISSING_INFO: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Missing Info' },
    ACTIVE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Active' },
  };
  const status = statusStyles[deal.evaluationStatus];

  return (
    <Link
      href={`/deal/${deal.id}`}
      className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-all group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <p className="font-medium text-slate-100 group-hover:text-blue-400 transition-colors truncate">
            {deal.name}
          </p>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        </div>
        <div className="flex gap-4 text-sm text-slate-400">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {deal.city}, {deal.state}
          </span>
          {deal.units > 0 && <span>{deal.units} units</span>}
          <span className="text-slate-500">{marketLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 ml-4">
        <div className="text-right">
          <p className="font-semibold text-slate-100 tabular-nums">{formatCurrency(deal.askPrice)}</p>
          <p className="text-xs text-slate-500">Updated {deal.updatedAt}</p>
        </div>
        <svg
          className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
