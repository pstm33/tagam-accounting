alter table kmrs_connections
  add column if not exists restaurant_slug text;

create index if not exists idx_kmrs_connections_restaurant_scope
  on kmrs_connections(organization_id, location_id, base_url, restaurant_slug);
