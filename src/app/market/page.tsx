'use client';

import { Suspense, useMemo, ReactNode, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Deal } from '@/lib/types';
import { normalizeCapRate, normalizeMarketValue, normalizeRentToIncomeRatio } from '@/lib/normalization';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value)
  );
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'al',
  alaska: 'ak',
  arizona: 'az',
  arkansas: 'ar',
  california: 'ca',
  colorado: 'co',
  connecticut: 'ct',
  delaware: 'de',
  florida: 'fl',
  georgia: 'ga',
  hawaii: 'hi',
  idaho: 'id',
  illinois: 'il',
  indiana: 'in',
  iowa: 'ia',
  kansas: 'ks',
  kentucky: 'ky',
  louisiana: 'la',
  maine: 'me',
  maryland: 'md',
  massachusetts: 'ma',
  michigan: 'mi',
  minnesota: 'mn',
  mississippi: 'ms',
  missouri: 'mo',
  montana: 'mt',
  nebraska: 'ne',
  nevada: 'nv',
  'new hampshire': 'nh',
  'new jersey': 'nj',
  'new mexico': 'nm',
  'new york': 'ny',
  'north carolina': 'nc',
  'north dakota': 'nd',
  ohio: 'oh',
  oklahoma: 'ok',
  oregon: 'or',
  pennsylvania: 'pa',
  'rhode island': 'ri',
  'south carolina': 'sc',
  'south dakota': 'sd',
  tennessee: 'tn',
  texas: 'tx',
  utah: 'ut',
  vermont: 'vt',
  virginia: 'va',
  washington: 'wa',
  'west virginia': 'wv',
  wisconsin: 'wi',
  wyoming: 'wy',
  'district of columbia': 'dc',
};

const METRO_PHRASES = [
  'metropolitan statistical area',
  'metropolitan area',
  'metro area',
  'metro',
  'msa',
];

const INVALID_LOCATION_VALUES = new Set(['unknown', 'na', 'n/a', 'none', '-']);

function normalizeStateToken(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const tokens = cleaned.split(' ').map(token => STATE_ABBREVIATIONS[token] || token);
  return tokens.join(' ').trim();
}

function normalizeMsaKey(value: string): string {
  if (!value) return '';
  let cleaned = value.trim().toLowerCase();
  METRO_PHRASES.forEach(phrase => {
    cleaned = cleaned.replace(new RegExp(`\\b${phrase}\\b`, 'g'), '');
  });
  cleaned = cleaned.replace(/[^a-z0-9,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    const state = normalizeStateToken(parts[parts.length - 1]);
    const name = parts.slice(0, -1).join(' ').trim();
    return `${name} ${state}`.trim().replace(/\s+/g, ' ');
  }
  return cleaned.replace(/\s+/g, ' ');
}

function hasMetroPhrase(value: string): boolean {
  return /metropolitan statistical area|metropolitan area|metro area|metro|msa/i.test(value);
}

function hasStateAbbreviation(value: string): boolean {
  const parts = value.split(',');
  if (parts.length < 2) return false;
  const state = parts[parts.length - 1].trim();
  return /^[A-Za-z]{2}$/.test(state);
}

function choosePreferredMsaName(current: string, next: string): string {
  if (!current) return next;
  if (!next) return current;
  const currentMetro = hasMetroPhrase(current);
  const nextMetro = hasMetroPhrase(next);
  if (currentMetro !== nextMetro) return currentMetro ? next : current;
  const currentAbbrev = hasStateAbbreviation(current);
  const nextAbbrev = hasStateAbbreviation(next);
  if (currentAbbrev !== nextAbbrev) return currentAbbrev ? current : next;
  if (current.length !== next.length) return current.length <= next.length ? current : next;
  return current.localeCompare(next) <= 0 ? current : next;
}

function isValidLocationValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return false;
  return !INVALID_LOCATION_VALUES.has(cleaned);
}

function resolveDealMsaKey(deal: Deal): string {
  if (isValidLocationValue(deal.msaName)) {
    return normalizeMsaKey(deal.msaName as string);
  }
  if (isValidLocationValue(deal.city) && isValidLocationValue(deal.state)) {
    return normalizeMsaKey(`${deal.city}, ${deal.state}`);
  }
  return '';
}

type MsaGroup = {
  name: string;
  deals: Deal[];
  zips: string[];
  zipCount?: number;
};

type BaseMsa = {
  key: string;
  name: string;
  zipCount?: number;
};

type SeriesMap = Record<string, Record<string, number | null>>;
type SnapshotMap = Record<string, { valueNumeric: number | null; valueText: string | null; unit: string | null }>;
type ListMap = Record<string, string[]>;
type MetricMeta = Record<string, { label: string; category: string; unit: string | null; kind: string }>;

type MarketIntelResponse = {
  msa: { id: string; name: string } | null;
  series: SeriesMap;
  snapshot: SnapshotMap;
  list: ListMap;
  metrics: MetricMeta;
  zips?: string[];
  warning?: string | null;
};

export default function MarketPage() {
  return (
    <Suspense fallback={<MarketPageLoading />}>
      <MarketPageContent />
    </Suspense>
  );
}

function MarketPageLoading() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Market Intelligence</h1>
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center text-slate-500">
        Loading...
      </div>
    </div>
  );
}

function MarketPageContent() {
  const searchParams = useSearchParams();
  const selectedMsaParam = searchParams.get('msa');
  const { deals } = useStore();
  const [cachedMsas, setCachedMsas] = useState<MsaGroup[]>([]);
  const [isCacheLoading, setIsCacheLoading] = useState(false);
  const [marketIntel, setMarketIntel] = useState<MarketIntelResponse | null>(null);
  const [isIntelLoading, setIsIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [intelWarning, setIntelWarning] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let isActive = true;

    setIsCacheLoading(true);
    fetch('/api/market-intel')
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load cached MSAs.');
        return response.json();
      })
      .then(data => {
        if (!isActive) return;
        if (Array.isArray(data.msas)) {
          setIntelWarning(typeof data.warning === 'string' ? data.warning : null);
          setCachedMsas(
            data.msas.map((msa: { name: string; zipCount?: number }) => ({
              name: msa.name,
              deals: [],
              zips: [],
              zipCount: msa.zipCount || 0,
            }))
          );
        }
      })
      .catch(() => {
        if (!isActive) return;
        setCachedMsas([]);
        setIntelWarning(null);
      })
      .finally(() => {
        if (!isActive) return;
        setIsCacheLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const baseMsas = useMemo<BaseMsa[]>(() => {
    const msaMap = new Map<string, { name: string; zipCount?: number }>();
    const addMsa = (name: string, zipCount?: number) => {
      const key = normalizeMsaKey(name);
      if (!key) return;
      const existing = msaMap.get(key);
      if (!existing) {
        msaMap.set(key, { name, zipCount });
        return;
      }
      const mergedZipCount = Math.max(existing.zipCount || 0, zipCount || 0) || existing.zipCount || zipCount;
      msaMap.set(key, {
        name: choosePreferredMsaName(existing.name, name),
        zipCount: mergedZipCount || undefined,
      });
    };

    if (cachedMsas.length > 0) {
      cachedMsas.forEach(msa => addMsa(msa.name, msa.zipCount));
    } else {
      deals.forEach(deal => {
        if (isValidLocationValue(deal.msaName)) {
          addMsa(deal.msaName as string);
          return;
        }
        if (isValidLocationValue(deal.city) && isValidLocationValue(deal.state)) {
          addMsa(`${deal.city}, ${deal.state}`);
        }
      });
    }

    return Array.from(msaMap.entries()).map(([key, value]) => ({
      key,
      name: value.name,
      zipCount: value.zipCount,
    }));
  }, [cachedMsas, deals]);

  const dealsByMsaKey = useMemo(() => {
    const map = new Map<string, Deal[]>();
    deals.forEach(deal => {
      const key = resolveDealMsaKey(deal);
      if (!key) return;
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(deal);
      } else {
        map.set(key, [deal]);
      }
    });
    return map;
  }, [deals]);

  const displayMsas = useMemo<MsaGroup[]>(() => {
    return baseMsas
      .map(msa => {
        const matchedDeals = dealsByMsaKey.get(msa.key) || [];
        const zips = Array.from(
          new Set(matchedDeals.map(deal => deal.zip).filter((zip): zip is string => Boolean(zip)))
        ).sort();
        return {
          name: msa.name,
          deals: matchedDeals,
          zips,
          zipCount: msa.zipCount,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [baseMsas, dealsByMsaKey]);

  const filteredMsas = useMemo(
    () => displayMsas.filter(msa => msa.deals.length > 0),
    [displayMsas]
  );

  const selectedMsaKey = selectedMsaParam ? normalizeMsaKey(selectedMsaParam) : '';
  const selectedMsa =
    filteredMsas.find(msa => normalizeMsaKey(msa.name) === selectedMsaKey) ||
    filteredMsas[0] ||
    null;

  useEffect(() => {
    let isActive = true;

    if (!selectedMsa) {
      setMarketIntel(null);
      setIntelError(null);
      return () => {
        isActive = false;
      };
    }

    setIsIntelLoading(true);
    setIntelError(null);

    fetch(`/api/market-intel?msa=${encodeURIComponent(selectedMsa.name)}`)
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
        setIntelWarning(typeof data.warning === 'string' ? data.warning : null);
      })
      .catch(error => {
        if (!isActive) return;
        setMarketIntel(null);
        setIntelError(error?.message || 'Unable to load market intelligence.');
        setIntelWarning(null);
      })
      .finally(() => {
        if (!isActive) return;
        setIsIntelLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [selectedMsa?.name, refreshTick]);

  const handleRefresh = async () => {
    if (!selectedMsa) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch('/api/market-intel/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msa: selectedMsa.name }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to refresh market intelligence.');
      }
      setRefreshTick(prev => prev + 1);
    } catch (error: any) {
      setRefreshError(error?.message || 'Unable to refresh market intelligence.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Market Intelligence</h1>
          <p className="text-sm text-slate-400">MSA-level insights from your uploaded tracker</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* MSA List */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden lg:col-span-1">
          <div className="p-3 border-b border-slate-700 bg-slate-700/50">
            <h2 className="font-medium text-slate-200">MSAs ({filteredMsas.length})</h2>
          </div>
          <div className="divide-y divide-slate-700 max-h-[640px] overflow-y-auto">
            {filteredMsas.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                {isCacheLoading ? 'Loading cached MSAs...' : 'Upload a tracker to populate MSAs.'}
              </div>
            ) : (
              filteredMsas.map(msa => {
                const isSelected = selectedMsa?.name === msa.name;
                const zipCount = msa.zips.length > 0 ? msa.zips.length : msa.zipCount || 0;
                return (
                  <Link
                    key={msa.name}
                    href={`/market?msa=${encodeURIComponent(msa.name)}`}
                    className={`block p-3 transition-colors ${
                      isSelected ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm text-slate-100">{msa.name}</div>
                        <div className="text-xs text-slate-500">{zipCount} ZIPs</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-400">
                          {msa.deals.length}
                        </div>
                        <div className="text-xs text-slate-500">deals</div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Market Detail */}
        <div className="lg:col-span-3 space-y-4">
          {selectedMsa ? (
            <MarketDetail
              msa={selectedMsa}
              intel={marketIntel}
              isIntelLoading={isIntelLoading}
              intelError={intelError}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              refreshError={refreshError}
            />
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center text-slate-500">
              Select an MSA to view details
            </div>
          )}
        </div>
      </div>
      {(intelError || intelWarning) && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 max-w-sm rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 shadow-lg"
        >
          <div className="font-semibold">Market intel warning</div>
          <div className="text-xs text-amber-100/80">{intelError || intelWarning}</div>
        </div>
      )}
    </div>
  );
}

type MetricRow = { label: string; metricKey: string };

function MarketDetail({
  msa,
  intel,
  isIntelLoading,
  intelError,
  onRefresh,
  isRefreshing,
  refreshError,
}: {
  msa: MsaGroup;
  intel: MarketIntelResponse | null;
  isIntelLoading: boolean;
  intelError: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  refreshError: string | null;
}) {
  const activeDeals = msa.deals.filter(d => d.evaluationStatus === 'ACTIVE').length;
  const avgAskPrice = average(msa.deals.map(d => d.askPrice));
  const avgCapRate = average(msa.deals.map(d => normalizeCapRate(d.capRate)));
  const avgNoi = average(msa.deals.map(d => d.noi ?? null));
  const avgDom = average(msa.deals.map(d => d.daysOnMarket ?? null));

  const series = intel?.series ?? {};
  const snapshot = intel?.snapshot ?? {};
  const list = intel?.list ?? {};
  const metrics = intel?.metrics ?? {};

  const mergedZips = Array.from(new Set([...msa.zips, ...(intel?.zips ?? [])])).sort();
  const zipPreview = mergedZips.slice(0, 20);
  const extraZipCount = Math.max(0, mergedZips.length - zipPreview.length);
  const hasIntelData =
    Object.keys(series).length > 0 ||
    Object.keys(snapshot).length > 0 ||
    Object.keys(list).length > 0;

  const statusLabel = isIntelLoading
    ? 'Loading cache...'
    : intelError
      ? 'Cache error'
      : hasIntelData
        ? 'Cached'
        : 'Data pending';

  const demographicRows: MetricRow[] = [
    { label: 'Population', metricKey: 'population' },
    { label: 'Population growth', metricKey: 'population_growth' },
    { label: 'Median household income', metricKey: 'median_household_income' },
    { label: 'Median household income growth', metricKey: 'median_household_income_growth' },
    { label: 'Home ownership rate', metricKey: 'home_ownership_rate' },
    { label: 'Median home price', metricKey: 'median_home_price' },
    { label: 'Median home price growth', metricKey: 'median_home_price_growth' },
    { label: 'Renter households', metricKey: 'renter_households' },
    { label: 'Renter households growth', metricKey: 'renter_households_growth' },
    { label: 'Avg. annual job growth', metricKey: 'avg_annual_job_growth' },
    { label: 'Household formation growth', metricKey: 'household_formation_growth' },
    { label: 'Unemployment rate', metricKey: 'unemployment_rate' },
    { label: 'Rent-to-income ratio', metricKey: 'rent_to_income_ratio' },
  ];

  const occupancyRows: MetricRow[] = [
    { label: 'Avg. occupancy', metricKey: 'mf_avg_occupancy' },
    { label: 'Rent growth', metricKey: 'mf_rent_growth' },
  ];

  const saleRows: MetricRow[] = [
    { label: 'Avg. annual sales volume', metricKey: 'sales_volume' },
    { label: 'Avg. cap rate', metricKey: 'avg_cap_rate' },
    { label: 'Avg. price per unit', metricKey: 'avg_price_per_unit' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{msa.name}</h2>
            <p className="text-sm text-slate-400 mt-1">
              {msa.deals.length} deals tracked across {mergedZips.length} ZIPs
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-slate-500">
            <span>{statusLabel}</span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700/40 disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh public data'}
            </button>
            {refreshError && (
              <span className="text-xs text-red-400">{refreshError}</span>
            )}
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="Total Deals" value={formatNumber(msa.deals.length)} />
        <StatCard label="Active Deals" value={formatNumber(activeDeals)} />
        <StatCard label="Avg. Ask Price" value={avgAskPrice ? formatCurrency(avgAskPrice) : 'N/A'} />
        <StatCard label="Avg. NOI" value={avgNoi ? formatCurrency(avgNoi) : 'N/A'} />
        <StatCard label="Avg. Cap Rate" value={avgCapRate ? `${avgCapRate.toFixed(2)}%` : 'N/A'} />
        <StatCard label="Avg. DOM" value={avgDom ? formatNumber(Math.round(avgDom)) : 'N/A'} />
      </div>

      {/* ZIP Coverage */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="font-medium text-slate-200 mb-2">ZIP Coverage</h3>
        {mergedZips.length === 0 ? (
          <div className="text-sm text-slate-500">No ZIPs found in this MSA.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {zipPreview.map(zip => (
              <span
                key={zip}
                className="px-2 py-1 rounded-full bg-slate-700 text-xs text-slate-300"
              >
                {zip}
              </span>
            ))}
            {extraZipCount > 0 && (
              <span className="px-2 py-1 rounded-full bg-slate-700 text-xs text-slate-400">
                +{extraZipCount} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Market Screener */}
      <div className="space-y-4">
        <SectionCard title="Demographics (1, 3, 5, 10 year stats)" status={statusLabel}>
          <MetricTable rows={demographicRows} series={series} metrics={metrics} />
        </SectionCard>

        <SectionCard title="Employment" status={statusLabel}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ListCard
              label="Top employment concentrations"
              items={resolveList(list.top_employment_concentrations)}
            />
            <ListCard
              label="Largest employers"
              items={resolveList(list.top_employers)}
            />
            <ListCard
              label="Major hiring announcements"
              items={resolveList(list.major_hiring_announcements)}
            />
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/60 p-4">
              <div className="text-xs text-slate-500 mb-2">LinkedIn job postings</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Postings to employment ratio</span>
                  <span className="text-slate-500">
                    {formatSnapshotValue(snapshot, metrics, 'linkedin_postings_ratio')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Net postings trend (6 months)</span>
                  <span className="text-slate-500">
                    {formatSnapshotValue(snapshot, metrics, 'linkedin_postings_trend_6m')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Multifamily" status={statusLabel}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/60 p-4 space-y-2">
              <div className="text-xs text-slate-500">Current stock and pipeline</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DataPair
                  label="Stock (units)"
                  value={formatSnapshotValue(snapshot, metrics, 'mf_stock_units')}
                />
                <DataPair
                  label="Avg. annual deliveries (5y)"
                  value={formatSnapshotValue(snapshot, metrics, 'mf_avg_annual_deliveries_5y')}
                />
                <DataPair
                  label="Under construction / permits"
                  value={formatSnapshotValue(snapshot, metrics, 'mf_under_construction_permits')}
                />
                <DataPair
                  label="Pipeline ratio"
                  value={formatSnapshotValue(snapshot, metrics, 'mf_pipeline_ratio')}
                />
                <DataPair
                  label="Average rental rate"
                  value={formatSnapshotValue(snapshot, metrics, 'mf_avg_rent')}
                />
                <DataPair
                  label="Class B/C share"
                  value={formatSnapshotValue(snapshot, metrics, 'mf_class_bc_share')}
                />
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/60 p-4">
              <div className="text-xs text-slate-500 mb-2">Occupancy and rent growth</div>
              <MetricTable rows={occupancyRows} series={series} metrics={metrics} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Sale / Valuation" status={statusLabel}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MetricTable rows={saleRows} series={series} metrics={metrics} />
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/60 p-4 space-y-2">
              <div className="text-xs text-slate-500">Replacement cost</div>
              <div className="text-lg font-semibold text-slate-200">
                {formatSnapshotValue(snapshot, metrics, 'replacement_cost')}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Other Information" status={statusLabel}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ListCard label="Top 10 owners" items={resolveList(list.top_owners)} />
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/60 p-4 space-y-2">
              <DataPair
                label="Affordability index"
                value={formatSnapshotValue(snapshot, metrics, 'affordability_index')}
              />
              <DataPair
                label="Tenant protections"
                value={formatSnapshotValue(snapshot, metrics, 'tenant_protections')}
              />
              <DataPair
                label="AI disruption composite"
                value={formatSnapshotValue(snapshot, metrics, 'ai_disruption_composite')}
              />
              <DataPair
                label="Home-to-rent price gap"
                value={formatSnapshotValue(snapshot, metrics, 'home_to_rent_price_gap')}
              />
              <DataPair
                label="Property tax reassessment trigger"
                value={formatSnapshotValue(snapshot, metrics, 'property_tax_reassessment_trigger')}
              />
              <DataPair
                label="Eviction efficiency score"
                value={formatSnapshotValue(snapshot, metrics, 'eviction_efficiency_score')}
              />
              <DataPair
                label="Insurance premium velocity (3y)"
                value={formatSnapshotValue(snapshot, metrics, 'insurance_premium_velocity_3y')}
              />
              <DataPair
                label="Climate degradation score"
                value={formatSnapshotValue(snapshot, metrics, 'climate_degradation_score')}
              />
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function formatMetricValue(
  value: number | null | undefined,
  unit?: string | null,
  metricKey?: string
): string {
  let normalized = normalizeMarketValue(value);
  if (normalized === null) return 'N/A';
  if (metricKey === 'rent_to_income_ratio') {
    normalized = normalizeRentToIncomeRatio(normalized);
    if (normalized === null) return 'N/A';
    unit = 'percent';
  }
  switch (unit) {
    case 'currency':
      return formatCurrency(normalized);
    case 'percent':
      return `${normalized.toFixed(2)}%`;
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

function formatSnapshotValue(
  snapshot: SnapshotMap,
  metrics: MetricMeta,
  metricKey: string
): string {
  const entry = snapshot[metricKey];
  if (!entry) return 'N/A';
  if (entry.valueText) return entry.valueText;
  return formatMetricValue(entry.valueNumeric, entry.unit ?? metrics[metricKey]?.unit, metricKey);
}

function resolveList(items: string[] | undefined): string[] {
  if (!items || items.length === 0) return ['Data pending'];
  return items;
}

function MetricTable({
  rows,
  series,
  metrics,
}: {
  rows: MetricRow[];
  series: SeriesMap;
  metrics: MetricMeta;
}) {
  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700/60 p-4 overflow-x-auto">
      <table className="min-w-full text-sm text-slate-300">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-2 text-left font-medium">Metric</th>
            <th className="py-2 text-right font-medium">1y</th>
            <th className="py-2 text-right font-medium">3y</th>
            <th className="py-2 text-right font-medium">5y</th>
            <th className="py-2 text-right font-medium">10y</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map(row => {
            const unit = metrics[row.metricKey]?.unit;
            return (
              <tr key={row.metricKey}>
                <td className="py-2">{row.label}</td>
                <td className="py-2 text-right text-slate-500">
                  {formatMetricValue(getSeriesValue(series, row.metricKey, 1), unit, row.metricKey)}
                </td>
                <td className="py-2 text-right text-slate-500">
                  {formatMetricValue(getSeriesValue(series, row.metricKey, 3), unit, row.metricKey)}
                </td>
                <td className="py-2 text-right text-slate-500">
                  {formatMetricValue(getSeriesValue(series, row.metricKey, 5), unit, row.metricKey)}
                </td>
                <td className="py-2 text-right text-slate-500">
                  {formatMetricValue(getSeriesValue(series, row.metricKey, 10), unit, row.metricKey)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SectionCard({
  title,
  children,
  status,
}: {
  title: string;
  children: ReactNode;
  status: string;
}) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-200">{title}</h3>
        <span className="text-xs text-slate-500">{status}</span>
      </div>
      {children}
    </div>
  );
}

function ListCard({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700/60 p-4">
      <div className="text-xs text-slate-500 mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <span key={item} className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function DataPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-slate-300">
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-slate-200">{value}</div>
    </div>
  );
}
