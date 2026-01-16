import { normalizeRentToIncomeRatio } from '@/lib/normalization';

type CensusValueMap = Record<string, number | null>;

const ACS_TABLE_FIELDS = {
  population: 'B01003_001E',
  median_household_income: 'B19013_001E',
  median_home_price: 'B25077_001E',
  renter_households: 'B25003_003E',
  households: 'B11001_001E',
  employed: 'B23025_004E',
};

const ACS_PROFILE_FIELDS = {
  home_ownership_rate: 'DP04_0046PE',
  unemployment_rate: 'DP03_0009PE',
  rent_to_income_ratio: 'DP04_0134PE',
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/metropolitan statistical area|micropolitan statistical area|metro area|msa/gi, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumeric(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= -1000000) return null;
  return parsed;
}

async function fetchCensusData(
  year: number,
  dataset: string,
  fields: Record<string, string>,
  cbsaCode: string,
  apiKey: string
): Promise<CensusValueMap> {
  const fieldList = Object.values(fields).join(',');
  const url = `https://api.census.gov/data/${year}/${dataset}?get=NAME,${fieldList}&for=metropolitan%20statistical%20area/micropolitan%20statistical%20area:${cbsaCode}&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Census API error (${dataset} ${year}).`);
  }

  const json = (await response.json()) as string[][];
  if (!Array.isArray(json) || json.length < 2) {
    throw new Error(`Census API returned no data for ${year}.`);
  }

  const headers = json[0];
  const row = json[1];
  const results: CensusValueMap = {};

  Object.entries(fields).forEach(([key, field]) => {
    const idx = headers.indexOf(field);
    results[key] = idx >= 0 ? parseNumeric(row[idx]) : null;
  });

  return results;
}

async function fetchAcsYear(
  year: number,
  cbsaCode: string,
  apiKey: string
): Promise<CensusValueMap> {
  const [tableData, profileData] = await Promise.all([
    fetchCensusData(year, 'acs/acs5', ACS_TABLE_FIELDS, cbsaCode, apiKey),
    fetchCensusData(year, 'acs/acs5/profile', ACS_PROFILE_FIELDS, cbsaCode, apiKey),
  ]);

  return { ...tableData, ...profileData };
}

function computeGrowth(current: number | null, past: number | null): number | null {
  if (current === null || past === null || past === 0) return null;
  return ((current - past) / past) * 100;
}

export async function resolveCbsaCode(msaName: string, apiKey: string, year: number): Promise<string | null> {
  const url = `https://api.census.gov/data/${year}/acs/acs5?get=NAME&for=metropolitan%20statistical%20area/micropolitan%20statistical%20area:*&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Unable to resolve MSA code from Census.');
  }

  const json = (await response.json()) as string[][];
  if (!Array.isArray(json) || json.length < 2) return null;

  const target = normalizeName(msaName);
  let bestMatchCode: string | null = null;
  let bestScore = -1;

  for (const row of json.slice(1)) {
    const name = row[0];
    const code = row[row.length - 1];
    if (!name || !code) continue;
    const normalized = normalizeName(name);

    if (normalized === target) {
      return code;
    }

    if (normalized.includes(target) || target.includes(normalized)) {
      const score = Math.min(normalized.length, target.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatchCode = code;
      }
    }
  }

  return bestMatchCode;
}

export async function fetchCensusSeries(
  msaName: string,
  cbsaCode: string,
  apiKey: string,
  latestYear: number
) {
  const periods = [1, 3, 5, 10];
  const years = new Set<number>([latestYear, latestYear - 1, latestYear - 3, latestYear - 5, latestYear - 10]);
  const yearValues = new Map<number, CensusValueMap>();

  await Promise.all(
    Array.from(years).map(async year => {
      if (year < 2010) return;
      const data = await fetchAcsYear(year, cbsaCode, apiKey);
      yearValues.set(year, data);
    })
  );

  const getValue = (year: number, key: string): number | null =>
    yearValues.get(year)?.[key] ?? null;

  const latest = yearValues.get(latestYear);
  if (!latest) {
    throw new Error(`No Census data for ${latestYear}.`);
  }

  const series: Record<string, Record<number, number | null>> = {
    population: {},
    population_growth: {},
    median_household_income: {},
    median_household_income_growth: {},
    home_ownership_rate: {},
    median_home_price: {},
    median_home_price_growth: {},
    renter_households: {},
    renter_households_growth: {},
    avg_annual_job_growth: {},
    household_formation_growth: {},
    unemployment_rate: {},
    rent_to_income_ratio: {},
  };

  periods.forEach(period => {
    const levelYear = period === 1 ? latestYear : latestYear - period;
    series.population[period] = getValue(levelYear, 'population');
    series.median_household_income[period] = getValue(levelYear, 'median_household_income');
    series.home_ownership_rate[period] = getValue(levelYear, 'home_ownership_rate');
    series.median_home_price[period] = getValue(levelYear, 'median_home_price');
    series.renter_households[period] = getValue(levelYear, 'renter_households');
    series.unemployment_rate[period] = getValue(levelYear, 'unemployment_rate');
    series.rent_to_income_ratio[period] = normalizeRentToIncomeRatio(
      getValue(levelYear, 'rent_to_income_ratio')
    );

    series.population_growth[period] = computeGrowth(
      getValue(latestYear, 'population'),
      getValue(latestYear - period, 'population')
    );
    series.median_household_income_growth[period] = computeGrowth(
      getValue(latestYear, 'median_household_income'),
      getValue(latestYear - period, 'median_household_income')
    );
    series.median_home_price_growth[period] = computeGrowth(
      getValue(latestYear, 'median_home_price'),
      getValue(latestYear - period, 'median_home_price')
    );
    series.renter_households_growth[period] = computeGrowth(
      getValue(latestYear, 'renter_households'),
      getValue(latestYear - period, 'renter_households')
    );
    series.household_formation_growth[period] = computeGrowth(
      getValue(latestYear, 'households'),
      getValue(latestYear - period, 'households')
    );
    series.avg_annual_job_growth[period] = computeGrowth(
      getValue(latestYear, 'employed'),
      getValue(latestYear - period, 'employed')
    );
  });

  return {
    msaName,
    cbsaCode,
    latestYear,
    series,
  };
}
