// Evaluation Pipeline Status (automated screening)
export type EvaluationStatus = 'REJECTED' | 'MISSING_INFO' | 'ACTIVE';

// Execution Pipeline Stage (manual kanban for ACTIVE deals only)
export type ExecutionStage = 'UNPROCESSED' | 'OUTREACH' | 'NEGOTIATION' | 'COMPLETED';

// Asset types
export type AssetType = 'MULTIFAMILY' | 'RETAIL' | 'OFFICE' | 'INDUSTRIAL' | 'MIXED_USE';

// Deal - core entity
export interface Deal {
  id: string;
  name: string;
  fileType?: string;
  assetType: AssetType;
  units: number;
  askPrice: number | null;
  address?: string;
  city: string;
  state: string;
  marketId: string;
  msaName?: string;
  zip?: string;
  propertyLink?: string;
  propertyStatus?: string;
  listingBroker?: string;
  brokerageShop?: string;
  noi?: number | null;
  capRate?: number | null;
  daysOnMarket?: number | null;
  buyBoxCheck?: string;

  // Evaluation (automated)
  evaluationStatus: EvaluationStatus;
  missingFields: string[];
  rejectionReasons: string[];

  // Execution (manual, only for ACTIVE deals)
  executionStage: ExecutionStage;

  // Metadata
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Market - MSA-level data
export interface Market {
  id: string;
  name: string;
  region: string;
  summary: string;
  keyStats: MarketStats;
  lastUpdated: string;
}

export interface MarketStats {
  population: number;
  populationGrowth: number;
  medianIncome: number;
  unemploymentRate: number;
  medianRent: number;
  rentGrowth: number;
  capRate: number;
  topEmployers: string[];
}

// Dashboard summary types
export interface EvaluationSummary {
  rejected: number;
  missingInfo: number;
  active: number;
  total: number;
}

export interface ExecutionSummary {
  unprocessed: number;
  outreach: number;
  negotiation: number;
  completed: number;
}

export interface IntelSummary {
  totalDeals: number;
  totalMarkets: number;
  evaluationSummary: EvaluationSummary;
  executionSummary: ExecutionSummary;
  recentDeals: Deal[];
  topMarkets: Market[];
}
