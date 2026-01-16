'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { DealActionsMenu } from '@/components/deal-actions-menu';
import { Deal, ExecutionStage } from '@/lib/types';
import { normalizeCapRate } from '@/lib/normalization';

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const STAGES: { key: ExecutionStage; label: string; color: string }[] = [
  { key: 'UNPROCESSED', label: 'Unprocessed', color: 'border-slate-600' },
  { key: 'OUTREACH', label: 'Outreach', color: 'border-blue-600' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'border-purple-600' },
  { key: 'COMPLETED', label: 'Completed', color: 'border-emerald-600' },
];

export default function ExecutionPage() {
  const { deals, updateDealExecutionStage, clearDeals } = useStore();
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  // Only show ACTIVE deals in execution pipeline
  const activeDeals = deals.filter(d => d.evaluationStatus === 'ACTIVE');

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (stage: ExecutionStage) => {
    if (draggedDeal && draggedDeal.executionStage !== stage) {
      updateDealExecutionStage(draggedDeal.id, stage);
    }
    setDraggedDeal(null);
  };
  const handleClearAll = async () => {
    if (!window.confirm('Clear all deals? This cannot be undone.')) return;
    await clearDeals();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Execution Pipeline</h1>
          <div className="text-sm text-slate-400">
            {activeDeals.length} active deal{activeDeals.length !== 1 ? 's' : ''}
          </div>
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

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {STAGES.map(stage => {
          const stageDeals = activeDeals.filter(d => d.executionStage === stage.key);
          return (
            <div
              key={stage.key}
              className={`bg-slate-800/70 rounded-xl border border-slate-700/60 border-t-2 ${stage.color} min-h-[620px] shadow-lg shadow-black/20`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.key)}
            >
              {/* Column Header */}
              <div className="px-4 py-4 border-b border-slate-700/70 bg-slate-900/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{stage.label}</h3>
                  <span className="text-sm font-semibold text-slate-400">{stageDeals.length}</span>
                </div>
              </div>

              {/* Cards */}
              <div className="p-4 space-y-3">
                {stageDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onDragStart={() => handleDragStart(deal)}
                    isDragging={draggedDeal?.id === deal.id}
                  />
                ))}
                {stageDeals.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-sm rounded-lg border border-dashed border-slate-700/60 bg-slate-900/20">
                    Drop deals here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  onDragStart,
  isDragging,
}: {
  deal: Deal;
  onDragStart: () => void;
  isDragging: boolean;
}) {
  const normalizedCapRate = normalizeCapRate(deal.capRate);
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
    <div
      draggable
      onDragStart={onDragStart}
      className={`relative bg-slate-800/70 rounded-lg p-4 border border-slate-700/60 shadow-sm shadow-black/20 cursor-grab active:cursor-grabbing transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95' : 'hover:bg-slate-800 hover:-translate-y-0.5'
      }`}
    >
      <div className="absolute right-2 top-2 z-10">
        <DealActionsMenu dealId={deal.id} status={deal.evaluationStatus} />
      </div>
      <Link href={`/deal/${deal.id}`} className="block">
        <div className="font-medium text-base text-blue-400 hover:text-blue-300">
          {deal.name}
        </div>
        <div className="text-sm text-slate-400 mt-1">
          {deal.city}, {deal.state}
        </div>
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-slate-500">{deal.units} units</span>
          <span className="font-semibold text-slate-200">{formatCurrency(deal.askPrice)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
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
        {deal.notes && (
          <div className="mt-3 text-sm text-slate-500 truncate">
            {deal.notes}
          </div>
        )}
      </Link>
    </div>
  );
}
