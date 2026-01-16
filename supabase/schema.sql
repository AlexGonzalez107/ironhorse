create extension if not exists "pgcrypto";

create schema if not exists deals;
create schema if not exists market_intel;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'asset_type' and typnamespace = 'deals'::regnamespace) then
    create type deals.asset_type as enum ('MULTIFAMILY', 'RETAIL', 'OFFICE', 'INDUSTRIAL', 'MIXED_USE');
  end if;
  if not exists (select 1 from pg_type where typname = 'evaluation_status' and typnamespace = 'deals'::regnamespace) then
    create type deals.evaluation_status as enum ('REJECTED', 'MISSING_INFO', 'ACTIVE');
  end if;
  if not exists (select 1 from pg_type where typname = 'execution_stage' and typnamespace = 'deals'::regnamespace) then
    create type deals.execution_stage as enum ('UNPROCESSED', 'OUTREACH', 'NEGOTIATION', 'COMPLETED');
  end if;
  if not exists (select 1 from pg_type where typname = 'metric_kind' and typnamespace = 'market_intel'::regnamespace) then
    create type market_intel.metric_kind as enum ('series', 'snapshot', 'list');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists deals.markets (
  id text primary key,
  name text not null,
  region text,
  summary text,
  key_stats jsonb,
  last_updated date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists market_intel.msa (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  cbsa_code text,
  state_codes text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists market_intel.msa_zip (
  msa_id uuid references market_intel.msa(id) on delete cascade,
  zip text not null,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (msa_id, zip)
);

create table if not exists deals.deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_type deals.asset_type not null,
  units integer not null default 0,
  ask_price numeric,
  address text,
  city text,
  state text,
  market_id text references deals.markets(id) on delete set null,
  msa_id uuid references market_intel.msa(id) on delete set null,
  msa_name text,
  zip text,
  property_link text,
  property_status text,
  file_type text,
  listing_broker text,
  brokerage_shop text,
  noi numeric,
  cap_rate numeric,
  days_on_market integer,
  buy_box_check text,
  evaluation_status deals.evaluation_status not null default 'ACTIVE',
  missing_fields text[] not null default '{}',
  rejection_reasons text[] not null default '{}',
  execution_stage deals.execution_stage not null default 'UNPROCESSED',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists deals.deals
  add column if not exists address text,
  add column if not exists file_type text,
  add column if not exists listing_broker text,
  add column if not exists brokerage_shop text;

create index if not exists deals_deals_msa_name_idx on deals.deals (msa_name);
create index if not exists deals_deals_zip_idx on deals.deals (zip);
create index if not exists deals_deals_market_id_idx on deals.deals (market_id);
create index if not exists deals_deals_evaluation_status_idx on deals.deals (evaluation_status);

create table if not exists market_intel.metric (
  key text primary key,
  label text not null,
  category text not null,
  unit text,
  description text,
  kind market_intel.metric_kind not null
);

create table if not exists market_intel.metric_series (
  id uuid primary key default gen_random_uuid(),
  msa_id uuid references market_intel.msa(id) on delete cascade,
  metric_key text references market_intel.metric(key) on delete cascade,
  period_years integer not null check (period_years in (1, 3, 5, 10)),
  value numeric,
  source text,
  observed_as_of date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (msa_id, metric_key, period_years)
);

create table if not exists market_intel.metric_snapshot (
  id uuid primary key default gen_random_uuid(),
  msa_id uuid references market_intel.msa(id) on delete cascade,
  metric_key text references market_intel.metric(key) on delete cascade,
  value_numeric numeric,
  value_text text,
  unit text,
  source text,
  observed_as_of date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (msa_id, metric_key)
);

create table if not exists market_intel.metric_list (
  id uuid primary key default gen_random_uuid(),
  msa_id uuid references market_intel.msa(id) on delete cascade,
  metric_key text references market_intel.metric(key) on delete cascade,
  items jsonb not null default '[]',
  source text,
  observed_as_of date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (msa_id, metric_key)
);

create index if not exists market_intel_metric_series_msa_idx on market_intel.metric_series (msa_id);
create index if not exists market_intel_metric_snapshot_msa_idx on market_intel.metric_snapshot (msa_id);
create index if not exists market_intel_metric_list_msa_idx on market_intel.metric_list (msa_id);
create index if not exists market_intel_msa_zip_zip_idx on market_intel.msa_zip (zip);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_deals_markets') then
    create trigger set_updated_at_deals_markets
      before update on deals.markets
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_deals_deals') then
    create trigger set_updated_at_deals_deals
      before update on deals.deals
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_market_intel_msa') then
    create trigger set_updated_at_market_intel_msa
      before update on market_intel.msa
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_market_intel_msa_zip') then
    create trigger set_updated_at_market_intel_msa_zip
      before update on market_intel.msa_zip
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_market_intel_metric_series') then
    create trigger set_updated_at_market_intel_metric_series
      before update on market_intel.metric_series
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_market_intel_metric_snapshot') then
    create trigger set_updated_at_market_intel_metric_snapshot
      before update on market_intel.metric_snapshot
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_market_intel_metric_list') then
    create trigger set_updated_at_market_intel_metric_list
      before update on market_intel.metric_list
      for each row execute function public.set_updated_at();
  end if;
end $$;

insert into market_intel.metric (key, label, category, unit, description, kind) values
  ('population', 'Population', 'demographics', 'count', null, 'series'),
  ('population_growth', 'Population growth', 'demographics', 'percent', null, 'series'),
  ('median_household_income', 'Median household income', 'demographics', 'currency', null, 'series'),
  ('median_household_income_growth', 'Median household income growth', 'demographics', 'percent', null, 'series'),
  ('home_ownership_rate', 'Home ownership rate', 'demographics', 'percent', null, 'series'),
  ('median_home_price', 'Median home price', 'demographics', 'currency', null, 'series'),
  ('median_home_price_growth', 'Median home price growth', 'demographics', 'percent', null, 'series'),
  ('renter_households', 'Renter households', 'demographics', 'count', null, 'series'),
  ('renter_households_growth', 'Renter households growth', 'demographics', 'percent', null, 'series'),
  ('avg_annual_job_growth', 'Avg. annual job growth', 'demographics', 'percent', null, 'series'),
  ('household_formation_growth', 'Household formation growth', 'demographics', 'percent', null, 'series'),
  ('unemployment_rate', 'Unemployment rate', 'demographics', 'percent', null, 'series'),
  ('rent_to_income_ratio', 'Rent-to-income ratio', 'demographics', 'ratio', null, 'series'),
  ('top_employment_concentrations', 'Top employment concentrations', 'employment', 'text', null, 'list'),
  ('top_employers', 'Top employers', 'employment', 'text', null, 'list'),
  ('major_hiring_announcements', 'Major hiring announcements', 'employment', 'text', null, 'list'),
  ('linkedin_postings_ratio', 'LinkedIn postings ratio', 'employment', 'ratio', null, 'snapshot'),
  ('linkedin_postings_trend_6m', 'LinkedIn postings trend (6 months)', 'employment', 'percent', null, 'snapshot'),
  ('mf_stock_units', 'Multifamily stock', 'multifamily', 'count', null, 'snapshot'),
  ('mf_avg_annual_deliveries_5y', 'Avg. annual deliveries (5 years)', 'multifamily', 'count', null, 'snapshot'),
  ('mf_under_construction_permits', 'Under construction / permits', 'multifamily', 'count', null, 'snapshot'),
  ('mf_pipeline_ratio', 'Pipeline ratio', 'multifamily', 'percent', null, 'snapshot'),
  ('mf_avg_occupancy', 'Avg. occupancy', 'multifamily', 'percent', null, 'series'),
  ('mf_avg_rent', 'Average rental rate', 'multifamily', 'currency', null, 'snapshot'),
  ('mf_rent_growth', 'Rent growth', 'multifamily', 'percent', null, 'series'),
  ('mf_class_bc_share', 'Class B/C share of stock', 'multifamily', 'percent', null, 'snapshot'),
  ('sales_volume', 'Avg. annual sales volume', 'sale', 'currency', null, 'series'),
  ('avg_cap_rate', 'Avg. cap rate', 'sale', 'percent', null, 'series'),
  ('avg_price_per_unit', 'Avg. price per unit', 'sale', 'currency', null, 'series'),
  ('replacement_cost', 'Replacement cost', 'sale', 'currency', null, 'snapshot'),
  ('top_owners', 'Top owners', 'other', 'text', null, 'list'),
  ('affordability_index', 'Affordability index', 'other', 'index', null, 'snapshot'),
  ('tenant_protections', 'Tenant protections', 'other', 'text', null, 'snapshot'),
  ('ai_disruption_composite', 'AI disruption composite', 'other', 'text', null, 'snapshot'),
  ('home_to_rent_price_gap', 'Home-to-rent price gap', 'other', 'ratio', null, 'snapshot'),
  ('property_tax_reassessment_trigger', 'Property tax reassessment trigger', 'other', 'text', null, 'snapshot'),
  ('eviction_efficiency_score', 'Eviction efficiency score', 'other', 'count', null, 'snapshot'),
  ('insurance_premium_velocity_3y', 'Insurance premium velocity (3 years)', 'other', 'percent', null, 'snapshot'),
  ('climate_degradation_score', 'Climate degradation score', 'other', 'index', null, 'snapshot')
on conflict (key) do nothing;
