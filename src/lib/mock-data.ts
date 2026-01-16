import { Deal, Market, EvaluationStatus, ExecutionStage, AssetType } from './types';

// Mock Markets
export const MARKETS: Market[] = [
  {
    id: 'mkt-nashville',
    name: 'Nashville-Davidson-Murfreesboro',
    region: 'Southeast',
    summary: 'Strong growth market driven by healthcare, music industry, and tech expansion. Population growing 2%+ annually.',
    keyStats: {
      population: 1989519,
      populationGrowth: 2.1,
      medianIncome: 72500,
      unemploymentRate: 3.2,
      medianRent: 1650,
      rentGrowth: 4.5,
      capRate: 5.2,
      topEmployers: ['Vanderbilt University', 'HCA Healthcare', 'Nissan North America'],
    },
    lastUpdated: '2025-12-01',
  },
  {
    id: 'mkt-raleigh',
    name: 'Raleigh-Durham-Cary',
    region: 'Southeast',
    summary: 'Research Triangle with strong tech and biotech presence. High education levels and job growth.',
    keyStats: {
      population: 1413982,
      populationGrowth: 2.8,
      medianIncome: 85200,
      unemploymentRate: 2.9,
      medianRent: 1725,
      rentGrowth: 5.2,
      capRate: 4.8,
      topEmployers: ['Duke University', 'IBM', 'Cisco', 'Red Hat'],
    },
    lastUpdated: '2025-12-01',
  },
  {
    id: 'mkt-louisville',
    name: 'Louisville-Jefferson County',
    region: 'Midwest',
    summary: 'Logistics hub anchored by UPS Worldport. Healthcare and manufacturing diversification.',
    keyStats: {
      population: 1285439,
      populationGrowth: 0.8,
      medianIncome: 62400,
      unemploymentRate: 3.8,
      medianRent: 1275,
      rentGrowth: 3.1,
      capRate: 5.8,
      topEmployers: ['UPS Worldport', 'Humana', 'Norton Healthcare'],
    },
    lastUpdated: '2025-11-15',
  },
  {
    id: 'mkt-memphis',
    name: 'Memphis',
    region: 'Southeast',
    summary: 'Major logistics center with FedEx HQ. Higher unemployment but strong distribution sector.',
    keyStats: {
      population: 1337779,
      populationGrowth: 0.3,
      medianIncome: 52800,
      unemploymentRate: 5.1,
      medianRent: 1150,
      rentGrowth: 2.1,
      capRate: 6.5,
      topEmployers: ['FedEx', 'Methodist Le Bonheur Healthcare', 'AutoZone'],
    },
    lastUpdated: '2025-11-20',
  },
  {
    id: 'mkt-baton-rouge',
    name: 'Baton Rouge',
    region: 'Gulf',
    summary: 'State capital with LSU anchor. Petrochemical industry presence.',
    keyStats: {
      population: 870569,
      populationGrowth: 0.5,
      medianIncome: 58900,
      unemploymentRate: 4.2,
      medianRent: 1125,
      rentGrowth: 2.5,
      capRate: 6.2,
      topEmployers: ['Louisiana State University', 'Our Lady of the Lake', 'ExxonMobil'],
    },
    lastUpdated: '2025-11-10',
  },
];

// Mock Deals - start empty for uploads
export const DEALS: Deal[] = [];

// Helper functions
export function getDealById(id: string): Deal | undefined {
  return DEALS.find(d => d.id === id);
}

export function getMarketById(id: string): Market | undefined {
  return MARKETS.find(m => m.id === id);
}

export function getDealsByEvaluationStatus(status: EvaluationStatus): Deal[] {
  return DEALS.filter(d => d.evaluationStatus === status);
}

export function getActiveDeals(): Deal[] {
  return DEALS.filter(d => d.evaluationStatus === 'ACTIVE');
}

export function getActiveDealsByExecutionStage(stage: ExecutionStage): Deal[] {
  return DEALS.filter(d => d.evaluationStatus === 'ACTIVE' && d.executionStage === stage);
}

export function getDealsByMarket(marketId: string): Deal[] {
  return DEALS.filter(d => d.marketId === marketId);
}
