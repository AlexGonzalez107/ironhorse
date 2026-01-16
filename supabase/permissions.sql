grant usage on schema market_intel to service_role;
grant usage on schema deals to service_role;

grant all privileges on all tables in schema market_intel to service_role;
grant all privileges on all tables in schema deals to service_role;

grant all privileges on all sequences in schema market_intel to service_role;
grant all privileges on all sequences in schema deals to service_role;

alter default privileges in schema market_intel grant all on tables to service_role;
alter default privileges in schema deals grant all on tables to service_role;

alter default privileges in schema market_intel grant all on sequences to service_role;
alter default privileges in schema deals grant all on sequences to service_role;
