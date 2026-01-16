import { Deal } from '@/lib/types';

export function mapDealRow(row: Record<string, any>): Deal {
  const createdAt = typeof row.created_at === 'string'
    ? row.created_at.split('T')[0]
    : '';
  const updatedAt = typeof row.updated_at === 'string'
    ? row.updated_at.split('T')[0]
    : '';
  const id = row.id !== null && row.id !== undefined ? String(row.id) : '';

  return {
    id,
    name: row.name,
    assetType: row.asset_type,
    units: row.units ?? 0,
    askPrice: row.ask_price ?? null,
    address: row.address ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    marketId: row.market_id ?? '',
    msaName: row.msa_name ?? '',
    zip: row.zip ?? '',
    propertyLink: row.property_link ?? '',
    propertyStatus: row.property_status ?? '',
    fileType: row.file_type ?? '',
    listingBroker: row.listing_broker ?? '',
    brokerageShop: row.brokerage_shop ?? '',
    noi: row.noi ?? null,
    capRate: row.cap_rate ?? null,
    daysOnMarket: row.days_on_market ?? null,
    buyBoxCheck: row.buy_box_check ?? '',
    evaluationStatus: row.evaluation_status,
    missingFields: row.missing_fields ?? [],
    rejectionReasons: row.rejection_reasons ?? [],
    executionStage: row.execution_stage,
    notes: row.notes ?? '',
    createdAt,
    updatedAt,
  };
}
