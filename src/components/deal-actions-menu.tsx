'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { EvaluationStatus } from '@/lib/types';
import { useStore } from '@/lib/store';

const STATUS_LABELS: Record<EvaluationStatus, string> = {
  ACTIVE: 'Mark active',
  MISSING_INFO: 'Mark missing info',
  REJECTED: 'Mark rejected',
};

export function DealActionsMenu({
  dealId,
  status,
  className = '',
  onDelete,
}: {
  dealId: string;
  status: EvaluationStatus;
  className?: string;
  onDelete?: () => void;
}) {
  const { updateDealEvaluationStatus, removeDeal } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen]);

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(prev => !prev);
  };
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleStatusChange = async (
    event: MouseEvent<HTMLButtonElement>,
    nextStatus: EvaluationStatus
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (nextStatus === status) return;
    await updateDealEvaluationStatus(dealId, nextStatus);
    setIsOpen(false);
  };

  const handleDelete = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm('Delete this deal? This cannot be undone.')) return;
    await removeDeal(dealId);
    setIsOpen(false);
    onDelete?.();
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Deal actions"
        onClick={handleToggle}
        onMouseDown={handleMouseDown}
        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
      >
        <span className="text-xl leading-none font-semibold">...</span>
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-lg"
        >
          {(Object.keys(STATUS_LABELS) as EvaluationStatus[]).map(option => (
            <button
              key={option}
              type="button"
              role="menuitem"
              onClick={event => handleStatusChange(event, option)}
              onMouseDown={handleMouseDown}
              disabled={option === status}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
            >
              {STATUS_LABELS[option]}
            </button>
          ))}
          <div className="my-1 h-px bg-slate-800" />
          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            onMouseDown={handleMouseDown}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10"
          >
            Delete deal
          </button>
        </div>
      )}
    </div>
  );
}
