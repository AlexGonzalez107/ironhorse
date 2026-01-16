import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fetchCensusSeries, resolveCbsaCode } from '@/lib/market-intel/census';
import { upsertSeriesValues } from '@/lib/market-intel/persist';

export async function POST(request: Request) {
  try {
    const { msa } = (await request.json()) as { msa?: string };

    if (!msa) {
      return NextResponse.json({ error: 'MSA name is required.' }, { status: 400 });
    }

    const apiKey = process.env.CENSUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CENSUS_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const latestYear = Number(process.env.CENSUS_ACS_LATEST_YEAR || '2022');
    const supabase = getSupabaseServerClient();

    const { data: msaRow, error: msaError } = await supabase
      .schema('market_intel')
      .from('msa')
      .upsert({ name: msa }, { onConflict: 'name' })
      .select('id,name,cbsa_code')
      .single();

    if (msaError) {
      return NextResponse.json({ error: msaError.message }, { status: 500 });
    }

    let cbsaCode = msaRow.cbsa_code;
    if (!cbsaCode) {
      cbsaCode = await resolveCbsaCode(msa, apiKey, latestYear);
      if (!cbsaCode) {
        return NextResponse.json(
          { error: 'Unable to resolve CBSA code for the selected MSA.' },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase
        .schema('market_intel')
        .from('msa')
        .update({ cbsa_code: cbsaCode })
        .eq('id', msaRow.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const census = await fetchCensusSeries(msa, cbsaCode, apiKey, latestYear);
    const observedAsOf = `${latestYear}-12-31`;

    await upsertSeriesValues(msaRow.id, census.series, 'census_acs5', observedAsOf);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unable to refresh market intelligence.' },
      { status: 500 }
    );
  }
}
