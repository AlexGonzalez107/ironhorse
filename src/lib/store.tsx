'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Deal, ExecutionStage, EvaluationStatus } from './types';
import { DEALS, MARKETS } from './mock-data';

interface StoreState {
  deals: Deal[];
  updateDealExecutionStage: (dealId: string, stage: ExecutionStage) => void;
  updateDealNotes: (dealId: string, notes: string) => void;
  addDeals: (newDeals: Deal[]) => void;
  refreshDeals: () => Promise<void>;
  removeDeal: (dealId: string) => Promise<void>;
  clearDeals: () => Promise<void>;
  updateDealEvaluationStatus: (dealId: string, status: EvaluationStatus) => Promise<void>;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [deals, setDeals] = useState<Deal[]>(DEALS);

  const refreshDeals = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/deals', { cache: 'no-store', signal });
    let payload: { deals?: Deal[]; error?: string } | null = null;
    try {
      payload = (await response.json()) as { deals?: Deal[]; error?: string };
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to load deals.');
    }
    if (Array.isArray(payload?.deals)) {
      setDeals(payload.deals);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refreshDeals(controller.signal).catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, [refreshDeals]);

  const updateDealExecutionStage = (dealId: string, stage: ExecutionStage) => {
    setDeals(prev =>
      prev.map(deal =>
        deal.id === dealId
          ? { ...deal, executionStage: stage, updatedAt: new Date().toISOString().split('T')[0] }
          : deal
      )
    );
  };

  const updateDealNotes = (dealId: string, notes: string) => {
    setDeals(prev =>
      prev.map(deal =>
        deal.id === dealId
          ? { ...deal, notes, updatedAt: new Date().toISOString().split('T')[0] }
          : deal
      )
    );
  };

  const addDeals = (newDeals: Deal[]) => {
    if (newDeals.length === 0) return;
    setDeals(prev => [...newDeals, ...prev]);
  };

  const updateDealEvaluationStatus = async (dealId: string, status: EvaluationStatus) => {
    setDeals(prev =>
      prev.map(deal =>
        deal.id === dealId
          ? { ...deal, evaluationStatus: status, updatedAt: new Date().toISOString().split('T')[0] }
          : deal
      )
    );
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationStatus: status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Unable to update deal.');
      }
    } catch {
      await refreshDeals().catch(() => undefined);
    }
  };

  const removeDeal = async (dealId: string) => {
    setDeals(prev => prev.filter(deal => deal.id !== dealId));
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Unable to delete deal.');
      }
    } catch {
      await refreshDeals().catch(() => undefined);
    }
  };

  const clearDeals = async () => {
    setDeals([]);
    try {
      const response = await fetch('/api/deals', { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Unable to clear deals.');
      }
    } catch {
      await refreshDeals().catch(() => undefined);
    }
  };

  return (
    <StoreContext.Provider
      value={{
        deals,
        updateDealExecutionStage,
        updateDealNotes,
        addDeals,
        refreshDeals,
        removeDeal,
        clearDeals,
        updateDealEvaluationStatus,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}

// Re-export markets (static, no state needed)
export { MARKETS };
