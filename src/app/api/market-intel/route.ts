import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fetchCensusSeries, resolveCbsaCode } from '@/lib/market-intel/census';
import { upsertSeriesValues } from '@/lib/market-intel/persist';

type SeriesMap = Record<string, Record<string, number | null>>;
type SnapshotMap = Record<string, { valueNumeric: number | null; valueText: string | null; unit: string | null }>;
type ListMap = Record<string, string[]>;
type MetricMeta = Record<string, { label: string; category: string; unit: string | null; kind: string }>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const msaName = searchParams.get('msa');
  const apiKey = process.env.CENSUS_API_KEY;
  const warning = apiKey ? null : 'CENSUS_API_KEY is not configured.';

  try {
    const supabase = getSupabaseServerClient();

    if (!msaName) {
      const { data: msas, error: msasError } = await supabase
        .schema('market_intel')
        .from('msa')
        .select('id,name');

      if (msasError) {
        return NextResponse.json({ error: msasError.message }, { status: 500 });
      }

      const { data: dealRows, error: dealError } = await supabase
        .schema('deals')
        .from('deals')
        .select('msa_id')
        .not('msa_id', 'is', null);

      if (dealError) {
        return NextResponse.json({ error: dealError.message }, { status: 500 });
      }

      const dealMsaIds = new Set(
        (dealRows || [])
          .map(row => row.msa_id)
          .filter((id): id is string => Boolean(id))
      );

      const staleMsaIds = msas
        .filter(msa => !dealMsaIds.has(msa.id))
        .map(msa => msa.id);

      if (staleMsaIds.length > 0) {
        const { error: purgeError } = await supabase
          .schema('market_intel')
          .from('msa')
          .delete()
          .in('id', staleMsaIds);

        if (purgeError) {
          return NextResponse.json({ error: purgeError.message }, { status: 500 });
        }
      }

      const activeMsas = msas.filter(msa => dealMsaIds.has(msa.id));

      const { data: zips, error: zipError } = await supabase
        .schema('market_intel')
        .from('msa_zip')
        .select('msa_id,zip');

      if (zipError) {
        return NextResponse.json({ error: zipError.message }, { status: 500 });
      }

      const zipCounts = new Map<string, number>();
      zips.forEach(zip => {
        zipCounts.set(zip.msa_id, (zipCounts.get(zip.msa_id) || 0) + 1);
      });

      const response = activeMsas.map(msa => ({
        name: msa.name,
        zipCount: zipCounts.get(msa.id) || 0,
      }));

      return NextResponse.json({ msas: response, warning });
    }

    let autoRefreshWarning: string | null = null;
    let { data: msa, error: msaError } = await supabase
      .schema('market_intel')
      .from('msa')
      .select('id,name,cbsa_code')
      .eq('name', msaName)
      .maybeSingle();

    if (msaError) {
      return NextResponse.json({ error: msaError.message }, { status: 500 });
    }

    if (!msa) {
      const { data: upsertedMsa, error: upsertError } = await supabase
        .schema('market_intel')
        .from('msa')
        .upsert({ name: msaName }, { onConflict: 'name' })
        .select('id,name,cbsa_code')
        .single();

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }

      msa = upsertedMsa;
    }

    if (apiKey) {
      const { count, error: countError } = await supabase
        .schema('market_intel')
        .from('metric_series')
        .select('metric_key', { count: 'exact', head: true })
        .eq('msa_id', msa.id);

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 });
      }

      if (!count || count === 0) {
        try {
          const latestYear = Number(process.env.CENSUS_ACS_LATEST_YEAR || '2022');
          let cbsaCode = msa.cbsa_code;

          if (!cbsaCode) {
            cbsaCode = await resolveCbsaCode(msa.name, apiKey, latestYear);
            if (!cbsaCode) {
              autoRefreshWarning = 'Unable to resolve CBSA code for the selected MSA.';
            } else {
              const { error: updateError } = await supabase
                .schema('market_intel')
                .from('msa')
                .update({ cbsa_code: cbsaCode })
                .eq('id', msa.id);

              if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 });
              }
            }
          }

          if (cbsaCode) {
            const census = await fetchCensusSeries(msa.name, cbsaCode, apiKey, latestYear);
            const observedAsOf = `${latestYear}-12-31`;
            await upsertSeriesValues(msa.id, census.series, 'census_acs5', observedAsOf);
          }
        } catch (error: any) {
          autoRefreshWarning = error?.message || 'Unable to refresh market intelligence.';
        }
      }
    }

    const [seriesRes, snapshotRes, listRes, metricRes, zipRes] = await Promise.all([
      supabase
        .schema('market_intel')
        .from('metric_series')
        .select('metric_key,period_years,value')
        .eq('msa_id', msa.id),
      supabase
        .schema('market_intel')
        .from('metric_snapshot')
        .select('metric_key,value_numeric,value_text,unit')
        .eq('msa_id', msa.id),
      supabase
        .schema('market_intel')
        .from('metric_list')
        .select('metric_key,items')
        .eq('msa_id', msa.id),
      supabase
        .schema('market_intel')
        .from('metric')
        .select('key,label,category,unit,kind'),
      supabase
        .schema('market_intel')
        .from('msa_zip')
        .select('zip')
        .eq('msa_id', msa.id),
    ]);

    if (seriesRes.error || snapshotRes.error || listRes.error || metricRes.error || zipRes.error) {
      const message =
        seriesRes.error?.message ||
        snapshotRes.error?.message ||
        listRes.error?.message ||
        metricRes.error?.message ||
        zipRes.error?.message ||
        'Failed to load market intel data.';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const series: SeriesMap = {};
    seriesRes.data.forEach(row => {
      const key = row.metric_key;
      const period = String(row.period_years);
      if (!series[key]) series[key] = {};
      series[key][period] = row.value;
    });

    const snapshot: SnapshotMap = {};
    snapshotRes.data.forEach(row => {
      snapshot[row.metric_key] = {
        valueNumeric: row.value_numeric,
        valueText: row.value_text,
        unit: row.unit,
      };
    });

    const list: ListMap = {};
    listRes.data.forEach(row => {
      list[row.metric_key] = Array.isArray(row.items) ? row.items : [];
    });

    const metrics: MetricMeta = {};
    metricRes.data.forEach(row => {
      metrics[row.key] = {
        label: row.label,
        category: row.category,
        unit: row.unit,
        kind: row.kind,
      };
    });

    const zips = zipRes.data.map(row => row.zip).filter(Boolean);

    return NextResponse.json({
      msa,
      series,
      snapshot,
      list,
      metrics,
      zips,
      warning: autoRefreshWarning || warning,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unexpected server error.' },
      { status: 500 }
    );
  }
}
