import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function upsertSeriesValues(
  msaId: string,
  series: Record<string, Record<number, number | null>>,
  source: string,
  observedAsOf: string
) {
  const supabase = getSupabaseServerClient();
  const rows = Object.entries(series).flatMap(([metricKey, values]) =>
    Object.entries(values).map(([period, value]) => ({
      msa_id: msaId,
      metric_key: metricKey,
      period_years: Number(period),
      value,
      source,
      observed_as_of: observedAsOf,
    }))
  );

  if (rows.length === 0) return;

  const { error } = await supabase
    .schema('market_intel')
    .from('metric_series')
    .upsert(rows, { onConflict: 'msa_id,metric_key,period_years' });

  if (error) {
    throw new Error(error.message);
  }
}
