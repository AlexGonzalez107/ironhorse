import { Deal, AssetType } from '@/lib/types';
import { MARKETS } from '@/lib/mock-data';
import { normalizeCapRate } from '@/lib/normalization';

const REQUIRED_FIELDS = [
  { key: 'address', label: 'address' },
  { key: 'city', label: 'city' },
  { key: 'state', label: 'state' },
  { key: 'units', label: 'units' },
  { key: 'noi', label: 'NOI' },
  { key: 'capRate', label: 'cap rate' },
] as const;

const ASSET_TYPE_MAP: Record<string, AssetType> = {
  MULTIFAMILY: 'MULTIFAMILY',
  MULTI_FAMILY: 'MULTIFAMILY',
  APARTMENT: 'MULTIFAMILY',
  APARTMENTS: 'MULTIFAMILY',
  RETAIL: 'RETAIL',
  OFFICE: 'OFFICE',
  INDUSTRIAL: 'INDUSTRIAL',
  MIXED_USE: 'MIXED_USE',
  MIXEDUSE: 'MIXED_USE',
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
}

function normalizeAssetType(value: string): AssetType | null {
  const key = value.toUpperCase().replace(/[^A-Z]/g, '_').replace(/_+/g, '_');
  return ASSET_TYPE_MAP[key] || null;
}

function normalizeZip(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return raw;
  if (digits.length < 5) return digits.padStart(5, '0');
  return digits;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function pickMarketId(rawMarket: string): string {
  if (!rawMarket) return MARKETS[0]?.id || '';
  const direct = MARKETS.find(m => m.id.toLowerCase() === rawMarket.toLowerCase());
  if (direct) return direct.id;
  const byName = MARKETS.find(m => m.name.toLowerCase() === rawMarket.toLowerCase());
  return byName?.id || MARKETS[0]?.id || '';
}

function normalizeRowKeys(row: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    mapped[normalizeHeader(key)] = value;
  });
  return mapped;
}

export function extractDealsFromRows(
  rows: Record<string, unknown>[]
): { deals: Deal[]; skipped: number } {
  let skipped = 0;
  const today = new Date().toISOString().split('T')[0];

  const deals = rows.flatMap((raw, index) => {
    const row = normalizeRowKeys(raw);

    const name = asString(
      row['name'] ||
        row['deal name'] ||
        row['dealname'] ||
        row['property name'] ||
        row['propertyname']
    );
    const address = asString(
      row['address'] ||
        row['property address'] ||
        row['street address'] ||
        row['street'] ||
        row['location']
    );
    const city = asString(row['city']);
    const state = asString(row['state'] || row['st'] || row['province']);
    const msaName = asString(row['msa name'] || row['msa']);
    const marketRaw = asString(
      row['market'] ||
        row['market id'] ||
        row['marketid'] ||
        msaName
    );
    const marketId = pickMarketId(marketRaw);
    const assetTypeRaw = asString(row['type'] || row['asset type'] || row['assettype']);
    const assetType = normalizeAssetType(assetTypeRaw) || 'MULTIFAMILY';
    const zip = normalizeZip(row['zip'] || row['zip code'] || row['zipcode'] || row['postal']);

    const units = Math.max(
      0,
      Math.round(
        asNumber(row['units'] || row['unit count'] || row['unitcount'])
      )
    );
    const askPriceValue = asNumber(
      row['ask price'] ||
        row['askprice'] ||
        row['asking price'] ||
        row['price']
    );
    const askPrice = askPriceValue > 0 ? askPriceValue : null;
    const noiValue = asNumber(row['noi'] || row['net operating income']);
    const noi = noiValue > 0 ? noiValue : null;
    const capRateValue = asNumber(
      row['cap rate'] ||
        row['caprate'] ||
        row['rate']
    );
    const capRate = normalizeCapRate(capRateValue);
    const daysOnMarketValue = asNumber(row['days on market'] || row['dom']);
    const daysOnMarket = daysOnMarketValue > 0 ? Math.round(daysOnMarketValue) : null;
    const propertyStatus = asString(row['property status'] || row['status']);
    const propertyLink = asString(row['property link'] || row['link'] || row['url']);
    const fileType = asString(row['file type'] || row['filetype'] || row['tracker type']);
    const listingBroker = asString(row['listing broker'] || row['listingbroker'] || row['broker']);
    const brokerageShop = asString(row['brokerage shop'] || row['brokerage'] || row['brokerage firm']);
    const buyBoxCheck = asString(row['buy box check'] || row['buybox check'] || row['buybox']);
    const notes = asString(row['notes'] || row['comments']);

    const missingFields = REQUIRED_FIELDS
      .filter(field => {
        if (field.key === 'address') return !address;
        if (field.key === 'city') return !city;
        if (field.key === 'state') return !state;
        if (field.key === 'units') return units <= 0;
        if (field.key === 'noi') return noi === null;
        if (field.key === 'capRate') return capRate === null;
        return false;
      })
      .map(field => field.label);

    if (!name && !address && !city && !state && !marketRaw) {
      skipped += 1;
      return [];
    }

    const evaluationStatus = missingFields.length > 0 ? 'MISSING_INFO' : 'ACTIVE';

    const deal: Deal = {
      id: `deal-${Date.now()}-${index}`,
      name: name || `Untitled Deal ${index + 1}`,
      assetType,
      units,
      askPrice,
      address,
      city: city || 'Unknown',
      state: state || 'NA',
      marketId,
      msaName,
      zip,
      propertyLink,
      propertyStatus,
      fileType,
      listingBroker,
      brokerageShop,
      noi,
      capRate,
      daysOnMarket,
      buyBoxCheck,
      evaluationStatus,
      missingFields,
      rejectionReasons: [],
      executionStage: 'UNPROCESSED',
      notes,
      createdAt: today,
      updatedAt: today,
    };

    return [deal];
  });

  return { deals, skipped };
}
