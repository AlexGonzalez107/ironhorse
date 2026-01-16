'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore, MARKETS } from '@/lib/store';
import { DealActionsMenu } from '@/components/deal-actions-menu';
import { ExecutionStage } from '@/lib/types';
import { normalizeCapRate } from '@/lib/normalization';

function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatText(value?: string | null): string {
  if (!value) return 'N/A';
  const trimmed = value.trim();
  return trimmed ? trimmed : 'N/A';
}

function formatAssetType(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

const EXECUTION_STAGES: { key: ExecutionStage; label: string }[] = [
  { key: 'UNPROCESSED', label: 'Unprocessed' },
  { key: 'OUTREACH', label: 'Outreach' },
  { key: 'NEGOTIATION', label: 'Negotiation' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function DealPage() {
  const params = useParams();
  const router = useRouter();
  const { deals, updateDealExecutionStage, updateDealNotes } = useStore();

  const deal = deals.find(d => d.id === params.id);
  const market = deal ? MARKETS.find(m => m.id === deal.marketId) : null;
  const msaName = deal?.msaName || market?.name || '';
  const msaLink = msaName ? `/market?msa=${encodeURIComponent(msaName)}` : '/market';
  const locationLabel = deal
    ? [deal.address, deal.city, deal.state, deal.zip].filter(Boolean).join(', ')
    : '';

  if (!deal) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-10 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Deal Not Found</h1>
            <p className="text-slate-400 mb-6">The deal you are looking for does not exist.</p>
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const normalizedCapRate = normalizeCapRate(deal.capRate);
  const askPriceLabel = deal.askPrice !== null ? formatCurrency(deal.askPrice) : 'N/A';
  const pricePerUnitLabel = deal.askPrice !== null && deal.units > 0
    ? formatCurrency(deal.askPrice / deal.units)
    : 'N/A';
  const capRateLabel = normalizedCapRate !== null ? `${normalizedCapRate}%` : 'N/A';
  const unitLabel = deal.units > 0 ? `${formatNumber(deal.units)} units` : 'Units N/A';
  const isExecutionEditable = deal.evaluationStatus === 'ACTIVE';

  const keyMetrics = [
    {
      label: 'Ask Price',
      value: askPriceLabel,
      accent: 'text-slate-100',
      icon: '$',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-300',
    },
    {
      label: 'Price per Unit',
      value: pricePerUnitLabel,
      accent: 'text-slate-100',
      icon: 'PU',
      iconBg: 'bg-slate-500/10',
      iconColor: 'text-slate-300',
    },
    {
      label: 'Cap Rate',
      value: capRateLabel,
      accent: 'text-emerald-400',
      icon: '%',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-300',
    },
  ];

  const propertyDetails: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Property Name', value: deal.name },
    { label: 'File Type', value: formatText(deal.fileType) },
    { label: 'Type', value: formatAssetType(deal.assetType) },
    { label: 'Units', value: deal.units > 0 ? formatNumber(deal.units) : 'N/A' },
    { label: 'Address', value: formatText(deal.address) },
    { label: 'City', value: formatText(deal.city) },
    { label: 'State', value: formatText(deal.state) },
    { label: 'ZIP', value: formatText(deal.zip) },
  ];

  const sourceDetails: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Address', value: locationLabel || 'N/A' },
    { label: 'Status', value: formatText(deal.propertyStatus) },
    { label: 'Buy Box Check', value: formatText(deal.buyBoxCheck) },
    { label: 'Listing Broker', value: formatText(deal.listingBroker) },
    { label: 'Brokerage Shop', value: formatText(deal.brokerageShop) },
    {
      label: 'Property Link',
      value: deal.propertyLink ? (
        <a
          href={deal.propertyLink}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:text-blue-300"
        >
          Open link
        </a>
      ) : (
        'N/A'
      ),
    },
    {
      label: 'Market (MSA)',
      value: msaName ? (
        <Link href={msaLink} className="text-blue-400 hover:text-blue-300">
          {msaName}
        </Link>
      ) : (
        'N/A'
      ),
    },
  ];

  const handleStageChange = (stage: ExecutionStage) => {
    updateDealExecutionStage(deal.id, stage);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateDealNotes(deal.id, e.target.value);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-200">Dashboard</Link>
          <span>/</span>
          <Link href="/evaluation" className="hover:text-slate-200">Evaluation</Link>
          <span>/</span>
          <span className="text-slate-200">{deal.name}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-100">{deal.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400/80" />
                <span>{deal.city}, {deal.state}</span>
              </span>
              <span className="text-slate-600">-</span>
              <span>{formatAssetType(deal.assetType)}</span>
              <span className="text-slate-600">-</span>
              <span>{unitLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <EvaluationBadge status={deal.evaluationStatus} />
            <DealActionsMenu
              dealId={deal.id}
              status={deal.evaluationStatus}
              onDelete={() => router.push('/evaluation')}
            />
          </div>
        </div>

        {/* Key Financial Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {keyMetrics.map(metric => (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                    {metric.label}
                  </p>
                  <p className={`text-3xl font-bold ${metric.accent}`}>{metric.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${metric.iconBg} flex items-center justify-center`}>
                  <span className={`text-sm font-semibold ${metric.iconColor}`}>{metric.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Property and Underwriting Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="h-full rounded-2xl border border-slate-800/70 bg-slate-900/50 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-100">Property Details</h2>
                <span className="text-xs text-slate-500">Tracker fields</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {propertyDetails.map(field => (
                  <div key={field.label} className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {field.label}
                    </p>
                    <p className="text-sm font-semibold text-slate-100 break-words">
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="h-full rounded-2xl border border-slate-800/70 bg-slate-900/50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-100 mb-6">Underwriting</h2>
              <div className="space-y-5">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">NOI</p>
                  <p className="text-2xl font-bold text-slate-100">
                    {deal.noi !== null ? formatCurrency(deal.noi) : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cap Rate</p>
                  <p className="text-2xl font-bold text-emerald-400">{capRateLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Days on Market</p>
                  <p className="text-sm font-semibold text-slate-300">
                    {deal.daysOnMarket ?? 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Execution and Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="h-full rounded-2xl border border-slate-800/70 bg-slate-900/50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">Execution Stage</h2>
              {!isExecutionEditable && (
                <p className="text-xs text-slate-500 mb-4">
                  Execution stage updates are available for active deals only.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {EXECUTION_STAGES.map(stage => (
                  <button
                    key={stage.key}
                    onClick={() => handleStageChange(stage.key)}
                    disabled={!isExecutionEditable}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      deal.executionStage === stage.key
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                        : 'border border-slate-700/60 text-slate-300 hover:bg-slate-800/60'
                    } ${
                      isExecutionEditable
                        ? ''
                        : 'opacity-60 cursor-not-allowed hover:bg-transparent'
                    }`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="h-full rounded-2xl border border-slate-800/70 bg-slate-900/50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-100 mb-5">Timeline</h2>
              <div className="space-y-4 text-sm">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Created</p>
                  <p className="text-slate-100 font-semibold">{deal.createdAt}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Updated</p>
                  <p className="text-slate-100 font-semibold">{deal.updatedAt}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Source and Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-100 mb-6">Source Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sourceDetails.map(detail => (
                  <div key={detail.label} className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {detail.label}
                    </p>
                    <div className="text-sm font-medium text-slate-200 break-words">
                      {detail.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">Actions</h2>
              <div className="space-y-3">
                {isExecutionEditable && (
                  <button
                    onClick={() => router.push('/execution')}
                    className="w-full flex items-center justify-between rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500/90"
                  >
                    View in Execution Pipeline
                    <svg
                      className="h-4 w-4 text-white/80"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M7 4l6 6-6 6" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => router.push('/evaluation')}
                  className="w-full flex items-center justify-between rounded-lg border border-slate-700/70 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800/60"
                >
                  View All Deals
                  <svg
                    className="h-4 w-4 text-slate-400"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 4l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rejection Reasons */}
        {deal.evaluationStatus === 'REJECTED' && deal.rejectionReasons.length > 0 && (
          <div className="rounded-2xl border border-red-900/60 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-red-300 mb-4">Rejection Reasons</h2>
            <ul className="space-y-2 text-sm text-slate-200">
              {deal.rejectionReasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">-</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing Fields */}
        {deal.evaluationStatus === 'MISSING_INFO' && deal.missingFields.length > 0 && (
          <div className="rounded-2xl border border-amber-900/60 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-amber-300 mb-4">Missing Information</h2>
            <ul className="space-y-2 text-sm text-slate-200">
              {deal.missingFields.map((field, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">-</span>
                  <span>{field}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Notes</h2>
          <textarea
            value={deal.notes}
            onChange={handleNotesChange}
            placeholder="Add notes about this deal..."
            className="w-full min-h-[140px] rounded-lg bg-slate-900/60 border border-slate-700/60 p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>
    </div>
  );
}

function EvaluationBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    REJECTED: 'bg-red-500/15 text-red-300 border border-red-500/30',
    MISSING_INFO: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    ACTIVE: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  };
  const labels: Record<string, string> = {
    REJECTED: 'Rejected',
    MISSING_INFO: 'Missing Info',
    ACTIVE: 'Active',
  };
  return (
    <span className={`px-4 py-2 rounded-full text-sm font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
