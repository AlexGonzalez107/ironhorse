import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { extractDealsFromRows } from '@/lib/tracker/parse';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { mapDealRow } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024;

function normalizeSheetName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Only .xlsx files are supported.' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds 10MB limit.' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames.find(
      name => normalizeSheetName(name) === 'all_deals'
    );

    if (!sheetName) {
      return NextResponse.json(
        { error: 'Sheet named All_deals was not found.' },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
    const { deals, skipped } = extractDealsFromRows(rows);

    const supabase = getSupabaseServerClient();
    const msaNames = Array.from(
      new Set(
        deals
          .map(deal => deal.msaName?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );

    let msaMap = new Map<string, string>();
    if (msaNames.length > 0) {
      const { data: msaRows, error: msaError } = await supabase
        .schema('market_intel')
        .from('msa')
        .upsert(msaNames.map(name => ({ name })), { onConflict: 'name' })
        .select('id,name');

      if (msaError) {
        return NextResponse.json({ error: msaError.message }, { status: 500 });
      }

      msaMap = new Map(msaRows.map(row => [row.name, row.id]));

      const zipRows: { msa_id: string; zip: string; source: string }[] = [];
      const zipSet = new Set<string>();
      deals.forEach(deal => {
        const msaName = deal.msaName?.trim();
        const msaId = msaName ? msaMap.get(msaName) : undefined;
        if (!msaId || !deal.zip) return;
        const key = `${msaId}:${deal.zip}`;
        if (zipSet.has(key)) return;
        zipSet.add(key);
        zipRows.push({ msa_id: msaId, zip: deal.zip, source: 'tracker' });
      });

      if (zipRows.length > 0) {
        const { error: zipError } = await supabase
          .schema('market_intel')
          .from('msa_zip')
          .upsert(zipRows, { onConflict: 'msa_id,zip' });

        if (zipError) {
          return NextResponse.json({ error: zipError.message }, { status: 500 });
        }
      }
    }

    const dbRows = deals.map(deal => ({
      name: deal.name,
      asset_type: deal.assetType,
      units: deal.units,
      ask_price: deal.askPrice,
      address: deal.address || null,
      city: deal.city,
      state: deal.state,
      market_id: null,
      msa_id: deal.msaName ? msaMap.get(deal.msaName.trim()) || null : null,
      msa_name: deal.msaName || null,
      zip: deal.zip || null,
      property_link: deal.propertyLink || null,
      property_status: deal.propertyStatus || null,
      file_type: deal.fileType || null,
      listing_broker: deal.listingBroker || null,
      brokerage_shop: deal.brokerageShop || null,
      noi: deal.noi,
      cap_rate: deal.capRate,
      days_on_market: deal.daysOnMarket,
      buy_box_check: deal.buyBoxCheck || null,
      evaluation_status: deal.evaluationStatus,
      missing_fields: deal.missingFields,
      rejection_reasons: deal.rejectionReasons,
      execution_stage: deal.executionStage,
      notes: deal.notes,
    }));

    const { data: insertedDeals, error: insertError } = await supabase
      .schema('deals')
      .from('deals')
      .insert(dbRows)
      .select('*');

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const mappedDeals = insertedDeals.map(mapDealRow);

    return NextResponse.json({ added: mappedDeals.length, skipped, deals: mappedDeals });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to parse tracker.' },
      { status: 500 }
    );
  }
}
