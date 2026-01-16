'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { DealActionsMenu } from '@/components/deal-actions-menu';
import { Deal, EvaluationStatus } from '@/lib/types';
import { normalizeCapRate } from '@/lib/normalization';

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const STATUS_CONFIG: Record<EvaluationStatus, {
  label: string;
  color: string;
  bgColor: string;
  iconBg: string;
}> = {
  REJECTED: {
    label: 'Rejected',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    iconBg: 'from-red-500/20 to-red-600/20',
  },
  MISSING_INFO: {
    label: 'Missing Info',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    iconBg: 'from-amber-500/20 to-amber-600/20',
  },
  ACTIVE: {
    label: 'Active',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    iconBg: 'from-emerald-500/20 to-emerald-600/20',
  },
};

export default function EvaluationPage() {
  const { deals, clearDeals } = useStore();
  const [filter, setFilter] = useState<EvaluationStatus | 'ALL'>('ALL');

  const filteredDeals = filter === 'ALL'
    ? deals
    : deals.filter(d => d.evaluationStatus === filter);

  const counts = {
    ALL: deals.length,
    REJECTED: deals.filter(d => d.evaluationStatus === 'REJECTED').length,
    MISSING_INFO: deals.filter(d => d.evaluationStatus === 'MISSING_INFO').length,
    ACTIVE: deals.filter(d => d.evaluationStatus === 'ACTIVE').length,
  };
  const handleClearAll = async () => {
    if (!window.confirm('Clear all deals? This cannot be undone.')) return;
    await clearDeals();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-100 tracking-tight mb-2">Evaluation Pipeline</h1>
          <p className="text-slate-400">Review and assess the pre-screening process</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-200 border border-blue-500/40 hover:bg-blue-500/30 transition-colors text-sm font-semibold"
          >
            Upload tracker
          </Link>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={deals.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-200 border border-red-500/40 hover:bg-red-500/20 transition-colors text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { status: 'ACTIVE' as const, label: 'Active Deals', count: counts.ACTIVE },
          { status: 'MISSING_INFO' as const, label: 'Awaiting Info', count: counts.MISSING_INFO },
          { status: 'REJECTED' as const, label: 'Rejected', count: counts.REJECTED },
        ].map((metric) => {
          const config = STATUS_CONFIG[metric.status];
          return (
            <button
              key={metric.status}
              onClick={() => setFilter(filter === metric.status ? 'ALL' : metric.status)}
              className={`bg-slate-800/50 backdrop-blur border rounded-lg p-5 text-left transition-all ${
                filter === metric.status
                  ? 'border-blue-500/50 bg-slate-800'
                  : 'border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-2">{metric.label}</p>
                  <p className={`text-3xl font-bold ${config.color}`}>{metric.count}</p>
                </div>
                <div className={`p-3 rounded-lg bg-gradient-to-br ${config.iconBg}`}>
                  <div className={`w-5 h-5 rounded-full ${config.bgColor}`} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-800/80 p-1 rounded-lg">
          {(['ALL', 'ACTIVE', 'MISSING_INFO', 'REJECTED'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                filter === status
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              {status === 'ALL' ? 'All Deals' : STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-500">
          {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Deal Cards */}
      <div className="bg-slate-800/50 backdrop-blur rounded-lg border border-slate-700/50 overflow-hidden">
        <div className="border-b border-slate-700/50 px-6 py-4">
          <h2 className="font-semibold text-slate-200">
            {filter === 'ALL' ? 'All Deals' : STATUS_CONFIG[filter].label} Under Review
          </h2>
        </div>

        <div className="divide-y divide-slate-700/50">
          {filteredDeals.map(deal => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>

        {filteredDeals.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <p className="text-lg">No deals found</p>
            <p className="text-sm mt-1">Upload a deal to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const normalizedCapRate = normalizeCapRate(deal.capRate);
  const config = STATUS_CONFIG[deal.evaluationStatus];
  const handleListingClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (deal.propertyLink) {
      window.open(deal.propertyLink, '_blank', 'noopener,noreferrer');
    }
  };
  const handleListingKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (deal.propertyLink) {
        window.open(deal.propertyLink, '_blank', 'noopener,noreferrer');
      }
    }
  };
  return (
    <Link
      href={`/deal/${deal.id}`}
      className="flex items-center justify-between p-5 hover:bg-slate-700/30 transition-all cursor-pointer group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <p className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors truncate">
            {deal.name}
          </p>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.color}`}>
            {config.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {deal.city}, {deal.state}
          </span>
          {deal.units > 0 && (
            <span>{deal.units} units</span>
          )}
          <span className="text-slate-500">{deal.assetType.toLowerCase().replace('_', ' ')}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>NOI {deal.noi ? formatCurrency(deal.noi) : 'N/A'}</span>
          <span>Cap {normalizedCapRate ? `${normalizedCapRate}%` : 'N/A'}</span>
          <span>DOM {deal.daysOnMarket ?? 'N/A'}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {deal.propertyStatus && (
            <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-slate-300">
              {deal.propertyStatus}
            </span>
          )}
          {deal.buyBoxCheck && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-300">
              Excel Buybox Check: {deal.buyBoxCheck}
            </span>
          )}
          {deal.propertyLink && (
            <span
              role="link"
              tabIndex={0}
              onClick={handleListingClick}
              onKeyDown={handleListingKeyDown}
              className="rounded-full bg-slate-900/60 px-2 py-0.5 text-slate-300 hover:text-blue-300"
            >
              Listing link
            </span>
          )}
        </div>

        {/* Status-specific details */}
        {deal.evaluationStatus === 'MISSING_INFO' && deal.missingFields.length > 0 && (
          <p className="text-xs text-amber-400/80 mt-2">
            Missing: {deal.missingFields.join(', ')}
          </p>
        )}
        {deal.evaluationStatus === 'REJECTED' && deal.rejectionReasons.length > 0 && (
          <p className="text-xs text-red-400/80 mt-2 truncate">
            {deal.rejectionReasons[0]}
            {deal.rejectionReasons.length > 1 && ` (+${deal.rejectionReasons.length - 1} more)`}
          </p>
        )}
        {deal.evaluationStatus === 'ACTIVE' && (
          <p className="text-xs text-emerald-400/80 mt-2">
            Stage: {deal.executionStage.toLowerCase().replace('_', ' ')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 ml-4">
        <div className="text-right">
          <p className="text-xl font-bold text-slate-100 tabular-nums">{formatCurrency(deal.askPrice)}</p>
        </div>
        <DealActionsMenu dealId={deal.id} status={deal.evaluationStatus} />
      </div>
    </Link>
  );
}
