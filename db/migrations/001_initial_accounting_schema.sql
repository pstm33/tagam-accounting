create extension if not exists pgcrypto;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  default_currency char(3) not null default 'TMT',
  timezone text not null default 'Asia/Ashgabat',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  kind text not null default 'restaurant' check (kind in ('restaurant', 'warehouse', 'commissary', 'bar', 'kitchen', 'virtual_brand')),
  kmrs_merchant_id text,
  timezone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  phone text,
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'accountant', 'manager', 'chef', 'storekeeper', 'viewer')),
  location_id uuid references locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, role, location_id)
);

create table accounting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'locked')),
  closed_by_user_id uuid references app_users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (organization_id, location_id, period_start, period_end)
);

create table units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  measure_type text not null check (measure_type in ('weight', 'volume', 'count', 'length', 'energy', 'custom')),
  is_base boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid,
  from_unit_id uuid not null references units(id),
  to_unit_id uuid not null references units(id),
  factor numeric(20, 8) not null check (factor > 0),
  note text,
  created_at timestamptz not null default now(),
  unique (organization_id, product_id, from_unit_id, to_unit_id)
);

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  parent_id uuid references product_categories(id),
  name text not null,
  accounting_code text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id uuid references product_categories(id),
  base_unit_id uuid not null references units(id),
  name text not null,
  sku text,
  product_type text not null default 'raw' check (product_type in ('raw', 'prepared', 'menu_item', 'bar_item', 'packaging', 'supply', 'service')),
  inventory_policy text not null default 'tracked' check (inventory_policy in ('tracked', 'not_tracked', 'theoretical_only')),
  default_waste_percent numeric(9, 4) not null default 0 check (default_waste_percent >= 0),
  shelf_life_hours integer check (shelf_life_hours is null or shelf_life_hours >= 0),
  storage_temperature text,
  min_on_hand_quantity numeric(20, 6),
  par_quantity numeric(20, 6),
  reorder_quantity numeric(20, 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table unit_conversions
  add constraint unit_conversions_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;

create table processing_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('cleaning', 'trimming', 'defrosting', 'boiling', 'frying', 'baking', 'drying', 'absorption', 'portioning', 'custom')),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table product_yield_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  processing_method_id uuid not null references processing_methods(id),
  location_id uuid references locations(id) on delete cascade,
  input_quantity numeric(20, 6) not null default 1 check (input_quantity > 0),
  input_unit_id uuid not null references units(id),
  output_quantity numeric(20, 6) not null check (output_quantity >= 0),
  output_unit_id uuid not null references units(id),
  yield_percent numeric(9, 4) not null check (yield_percent > 0),
  source text not null default 'default' check (source in ('default', 'measured', 'supplier', 'manual')),
  note text,
  created_at timestamptz not null default now()
);

create table allergens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table product_allergens (
  product_id uuid not null references products(id) on delete cascade,
  allergen_id uuid not null references allergens(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'inherited', 'supplier')),
  primary key (product_id, allergen_id)
);

create table dietary_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table product_dietary_tags (
  product_id uuid not null references products(id) on delete cascade,
  dietary_tag_id uuid not null references dietary_tags(id) on delete cascade,
  primary key (product_id, dietary_tag_id)
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  phone text,
  email text,
  address text,
  payment_terms text,
  reliability_score numeric(6, 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table vendor_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  product_id uuid references products(id),
  vendor_sku text,
  vendor_name text not null,
  purchase_unit_id uuid not null references units(id),
  inventory_unit_id uuid not null references units(id),
  purchase_to_inventory_factor numeric(20, 8) not null check (purchase_to_inventory_factor > 0),
  pack_description text,
  last_price numeric(20, 6),
  last_price_currency char(3),
  review_status text not null default 'needs_review' check (review_status in ('needs_review', 'mapped', 'ignored', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, supplier_id, vendor_sku)
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  supplier_id uuid not null references suppliers(id),
  document_number text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partially_received', 'received', 'cancelled', 'closed')),
  source text not null default 'manual' check (source in ('manual', 'recommended', 'imported')),
  expected_at timestamptz,
  notes text,
  created_by_user_id uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  vendor_item_id uuid references vendor_items(id),
  product_id uuid references products(id),
  ordered_quantity numeric(20, 6) not null check (ordered_quantity > 0),
  ordered_unit_id uuid not null references units(id),
  expected_unit_price numeric(20, 6),
  currency char(3),
  note text,
  created_at timestamptz not null default now()
);

create table receiving_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  supplier_id uuid references suppliers(id),
  purchase_order_id uuid references purchase_orders(id),
  document_number text,
  status text not null default 'draft' check (status in ('draft', 'posted', 'voided')),
  received_at timestamptz not null default now(),
  created_by_user_id uuid references app_users(id),
  created_at timestamptz not null default now()
);

create table receiving_lines (
  id uuid primary key default gen_random_uuid(),
  receiving_document_id uuid not null references receiving_documents(id) on delete cascade,
  purchase_order_line_id uuid references purchase_order_lines(id),
  vendor_item_id uuid references vendor_items(id),
  product_id uuid not null references products(id),
  received_quantity numeric(20, 6) not null check (received_quantity > 0),
  received_unit_id uuid not null references units(id),
  base_quantity numeric(20, 6) not null check (base_quantity > 0),
  base_unit_id uuid not null references units(id),
  unit_cost numeric(20, 6),
  currency char(3),
  lot_code text,
  expires_on date,
  created_at timestamptz not null default now()
);

create table invoice_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  supplier_id uuid references suppliers(id),
  receiving_document_id uuid references receiving_documents(id),
  invoice_number text,
  invoice_date date,
  due_date date,
  status text not null default 'needs_review' check (status in ('needs_review', 'approved', 'exported', 'paid', 'voided')),
  source text not null default 'manual' check (source in ('manual', 'ocr', 'edi', 'email', 'api')),
  subtotal numeric(20, 6),
  tax_total numeric(20, 6),
  total numeric(20, 6),
  currency char(3),
  file_url text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_document_id uuid not null references invoice_documents(id) on delete cascade,
  receiving_line_id uuid references receiving_lines(id),
  vendor_item_id uuid references vendor_items(id),
  product_id uuid references products(id),
  raw_name text,
  invoiced_quantity numeric(20, 6) not null check (invoiced_quantity > 0),
  invoiced_unit_id uuid not null references units(id),
  unit_price numeric(20, 6) not null check (unit_price >= 0),
  line_total numeric(20, 6) not null check (line_total >= 0),
  tax_total numeric(20, 6),
  review_status text not null default 'needs_review' check (review_status in ('needs_review', 'mapped', 'approved', 'ignored')),
  created_at timestamptz not null default now()
);

create table invoice_discrepancies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_line_id uuid not null references invoice_lines(id) on delete cascade,
  discrepancy_type text not null check (discrepancy_type in ('price', 'quantity', 'missing_receipt', 'missing_po', 'unknown_item', 'tax', 'other')),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  expected_value text,
  actual_value text,
  status text not null default 'open' check (status in ('open', 'accepted', 'resolved', 'ignored')),
  resolved_by_user_id uuid references app_users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid references suppliers(id),
  vendor_item_id uuid references vendor_items(id),
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  unit_price numeric(20, 6) not null check (unit_price >= 0),
  currency char(3) not null,
  observed_at timestamptz not null default now(),
  source_invoice_line_id uuid references invoice_lines(id),
  source_receiving_line_id uuid references receiving_lines(id)
);

create table order_guides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, location_id, supplier_id, name)
);

create table order_guide_lines (
  id uuid primary key default gen_random_uuid(),
  order_guide_id uuid not null references order_guides(id) on delete cascade,
  vendor_item_id uuid references vendor_items(id),
  product_id uuid not null references products(id),
  default_quantity numeric(20, 6),
  unit_id uuid references units(id),
  par_quantity numeric(20, 6),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (order_guide_id, product_id, vendor_item_id)
);

create table stock_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  product_id uuid not null references products(id),
  source_receiving_line_id uuid references receiving_lines(id),
  lot_code text,
  expires_on date,
  base_unit_id uuid not null references units(id),
  initial_quantity numeric(20, 6) not null check (initial_quantity >= 0),
  current_quantity numeric(20, 6) not null check (current_quantity >= 0),
  unit_cost numeric(20, 6) not null default 0 check (unit_cost >= 0),
  currency char(3) not null,
  status text not null default 'active' check (status in ('active', 'depleted', 'expired', 'quarantined', 'voided')),
  created_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  product_id uuid not null references products(id),
  stock_lot_id uuid references stock_lots(id),
  movement_type text not null check (movement_type in (
    'purchase_receipt',
    'reservation',
    'reservation_release',
    'sale_writeoff',
    'manual_writeoff',
    'inventory_adjustment',
    'transfer_out',
    'transfer_in',
    'production_consume',
    'production_yield',
    'expiry_writeoff',
    'correction'
  )),
  quantity_delta numeric(20, 6) not null,
  unit_id uuid not null references units(id),
  unit_cost numeric(20, 6),
  currency char(3),
  reference_type text,
  reference_id uuid,
  reason text,
  occurred_at timestamptz not null default now(),
  created_by_user_id uuid references app_users(id),
  created_at timestamptz not null default now()
);

create table stock_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  product_id uuid not null references products(id),
  stock_lot_id uuid references stock_lots(id),
  quantity numeric(20, 6) not null check (quantity > 0),
  unit_id uuid not null references units(id),
  status text not null default 'active' check (status in ('active', 'released', 'committed', 'expired')),
  reference_type text not null,
  reference_id uuid not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table count_sheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (location_id, name)
);

create table count_sheet_lines (
  id uuid primary key default gen_random_uuid(),
  count_sheet_id uuid not null references count_sheets(id) on delete cascade,
  product_id uuid not null references products(id),
  count_unit_id uuid not null references units(id),
  sort_order integer not null default 0,
  par_quantity numeric(20, 6),
  created_at timestamptz not null default now(),
  unique (count_sheet_id, product_id, count_unit_id)
);

create table inventory_counts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  count_sheet_id uuid references count_sheets(id),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'posted', 'voided')),
  counted_at timestamptz not null default now(),
  submitted_by_user_id uuid references app_users(id),
  posted_by_user_id uuid references app_users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now()
);

create table inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  inventory_count_id uuid not null references inventory_counts(id) on delete cascade,
  product_id uuid not null references products(id),
  count_unit_id uuid not null references units(id),
  counted_quantity numeric(20, 6) not null check (counted_quantity >= 0),
  base_quantity numeric(20, 6) not null check (base_quantity >= 0),
  expected_base_quantity numeric(20, 6),
  variance_base_quantity numeric(20, 6),
  variance_value numeric(20, 6),
  note text,
  created_at timestamptz not null default now()
);

create table transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  from_location_id uuid not null references locations(id),
  to_location_id uuid not null references locations(id),
  status text not null default 'draft' check (status in ('draft', 'sent', 'received', 'cancelled')),
  requested_by_user_id uuid references app_users(id),
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create table transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references transfers(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(20, 6) not null check (quantity > 0),
  unit_id uuid not null references units(id),
  note text,
  created_at timestamptz not null default now()
);

create table writeoff_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'posted', 'rejected', 'voided')),
  reason text not null check (reason in ('spoilage', 'expired', 'staff_meal', 'compliment', 'test_cooking', 'breakage', 'overproduction', 'cancelled_after_cooking', 'other')),
  note text,
  photo_url text,
  created_by_user_id uuid references app_users(id),
  approved_by_user_id uuid references app_users(id),
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table writeoff_lines (
  id uuid primary key default gen_random_uuid(),
  writeoff_document_id uuid not null references writeoff_documents(id) on delete cascade,
  product_id uuid not null references products(id),
  stock_lot_id uuid references stock_lots(id),
  quantity numeric(20, 6) not null check (quantity > 0),
  unit_id uuid not null references units(id),
  estimated_unit_cost numeric(20, 6),
  currency char(3),
  stock_movement_id uuid references stock_movements(id),
  note text,
  created_at timestamptz not null default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  output_product_id uuid references products(id),
  name text not null,
  recipe_type text not null default 'menu_item' check (recipe_type in ('menu_item', 'sub_recipe', 'prep_item', 'bar_item', 'pour', 'modifier_delta')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  version_code text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  effective_from timestamptz,
  effective_to timestamptz,
  yield_quantity numeric(20, 6) not null check (yield_quantity > 0),
  yield_unit_id uuid not null references units(id),
  servings numeric(20, 6) not null default 1 check (servings > 0),
  target_food_cost_percent numeric(9, 4) check (target_food_cost_percent is null or target_food_cost_percent > 0),
  menu_price numeric(20, 6),
  tax_percent numeric(9, 4),
  currency char(3),
  prep_time_minutes integer check (prep_time_minutes is null or prep_time_minutes >= 0),
  shelf_life_hours integer check (shelf_life_hours is null or shelf_life_hours >= 0),
  storage_temperature text,
  instructions text,
  approved_by_user_id uuid references app_users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, version_code)
);

create table recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references recipe_versions(id) on delete cascade,
  ingredient_product_id uuid references products(id),
  child_recipe_version_id uuid references recipe_versions(id),
  quantity numeric(20, 6) not null check (quantity >= 0),
  unit_id uuid not null references units(id),
  quantity_mode text not null default 'stock_input' check (quantity_mode in ('stock_input', 'prepared_output')),
  extra_waste_percent numeric(9, 4) not null default 0 check (extra_waste_percent >= 0),
  is_optional boolean not null default false,
  sort_order integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  check (
    (ingredient_product_id is not null and child_recipe_version_id is null)
    or (ingredient_product_id is null and child_recipe_version_id is not null)
  )
);

create table recipe_line_processing (
  id uuid primary key default gen_random_uuid(),
  recipe_line_id uuid not null references recipe_lines(id) on delete cascade,
  processing_method_id uuid not null references processing_methods(id),
  sequence_number integer not null,
  yield_percent numeric(9, 4) not null check (yield_percent > 0),
  input_quantity numeric(20, 6),
  output_quantity numeric(20, 6),
  note text,
  created_at timestamptz not null default now(),
  unique (recipe_line_id, sequence_number)
);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references recipe_versions(id) on delete cascade,
  step_number integer not null,
  title text,
  body text not null,
  media_url text,
  station text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  created_at timestamptz not null default now(),
  unique (recipe_version_id, step_number)
);

create table recipe_nutrition_snapshots (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references recipe_versions(id) on delete cascade,
  serving_quantity numeric(20, 6),
  serving_unit_id uuid references units(id),
  calories numeric(20, 6),
  protein_g numeric(20, 6),
  fat_g numeric(20, 6),
  carbohydrate_g numeric(20, 6),
  sugar_g numeric(20, 6),
  fiber_g numeric(20, 6),
  sodium_mg numeric(20, 6),
  source text not null default 'manual' check (source in ('manual', 'calculated', 'external')),
  calculated_at timestamptz not null default now()
);

create table recipe_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references recipe_versions(id) on delete cascade,
  location_id uuid references locations(id),
  cost_method text not null default 'average' check (cost_method in ('average', 'fifo', 'last_purchase', 'manual')),
  total_cost numeric(20, 6) not null check (total_cost >= 0),
  cost_per_yield_unit numeric(20, 6) not null check (cost_per_yield_unit >= 0),
  food_cost_percent numeric(9, 4),
  recommended_menu_price numeric(20, 6),
  currency char(3) not null,
  calculated_at timestamptz not null default now()
);

create table recipe_cost_snapshot_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_cost_snapshot_id uuid not null references recipe_cost_snapshots(id) on delete cascade,
  recipe_line_id uuid not null references recipe_lines(id),
  stock_input_quantity numeric(20, 6) not null check (stock_input_quantity >= 0),
  prepared_output_quantity numeric(20, 6) not null check (prepared_output_quantity >= 0),
  effective_yield_percent numeric(9, 4) not null check (effective_yield_percent > 0),
  unit_cost numeric(20, 6) not null check (unit_cost >= 0),
  line_cost numeric(20, 6) not null check (line_cost >= 0),
  currency char(3) not null
);

create table production_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  recipe_version_id uuid references recipe_versions(id),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled', 'voided')),
  planned_quantity numeric(20, 6),
  planned_unit_id uuid references units(id),
  actual_output_quantity numeric(20, 6),
  actual_output_unit_id uuid references units(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table production_batch_inputs (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references production_batches(id) on delete cascade,
  product_id uuid not null references products(id),
  stock_lot_id uuid references stock_lots(id),
  planned_quantity numeric(20, 6),
  actual_quantity numeric(20, 6),
  unit_id uuid not null references units(id),
  stock_movement_id uuid references stock_movements(id),
  created_at timestamptz not null default now()
);

create table production_batch_outputs (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references production_batches(id) on delete cascade,
  product_id uuid not null references products(id),
  stock_lot_id uuid references stock_lots(id),
  quantity numeric(20, 6) not null check (quantity > 0),
  unit_id uuid not null references units(id),
  unit_cost numeric(20, 6),
  currency char(3),
  stock_movement_id uuid references stock_movements(id),
  created_at timestamptz not null default now()
);

create table kmrs_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  base_url text not null,
  kmrs_merchant_id text,
  restaurant_slug text,
  auth_mode text not null default 'token' check (auth_mode in ('token', 'basic', 'oauth', 'manual')),
  secret_ref text,
  status text not null default 'active' check (status in ('active', 'paused', 'error', 'archived')),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table kmrs_menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  kmrs_connection_id uuid references kmrs_connections(id) on delete cascade,
  kmrs_item_id text not null,
  kmrs_category_id text,
  name text not null,
  description text,
  price numeric(20, 6),
  currency char(3),
  is_available boolean,
  raw_payload jsonb,
  imported_at timestamptz not null default now(),
  unique (organization_id, kmrs_connection_id, kmrs_item_id)
);

create table kmrs_modifier_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kmrs_menu_item_id uuid references kmrs_menu_items(id) on delete cascade,
  kmrs_modifier_id text not null,
  name text not null,
  price_delta numeric(20, 6),
  currency char(3),
  raw_payload jsonb,
  imported_at timestamptz not null default now(),
  unique (organization_id, kmrs_menu_item_id, kmrs_modifier_id)
);

create table kmrs_menu_recipe_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kmrs_menu_item_id uuid references kmrs_menu_items(id) on delete cascade,
  kmrs_modifier_item_id uuid references kmrs_modifier_items(id) on delete cascade,
  recipe_id uuid not null references recipes(id),
  active_recipe_version_id uuid references recipe_versions(id),
  link_type text not null default 'base_item' check (link_type in ('base_item', 'modifier_delta', 'replacement', 'optional_addon')),
  status text not null default 'active' check (status in ('active', 'needs_review', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kmrs_menu_item_id is not null and kmrs_modifier_item_id is null)
    or (kmrs_menu_item_id is null and kmrs_modifier_item_id is not null)
  )
);

create table kmrs_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id),
  kmrs_connection_id uuid references kmrs_connections(id),
  kmrs_order_id text not null,
  kmrs_order_uuid text,
  status text not null,
  payment_status text,
  delivery_status text,
  ordered_at timestamptz,
  raw_payload jsonb,
  imported_at timestamptz not null default now(),
  unique (organization_id, kmrs_connection_id, kmrs_order_id)
);

create table kmrs_order_lines (
  id uuid primary key default gen_random_uuid(),
  kmrs_order_id uuid not null references kmrs_orders(id) on delete cascade,
  parent_line_id uuid references kmrs_order_lines(id) on delete cascade,
  kmrs_item_id text,
  kmrs_modifier_id text,
  name text not null,
  quantity numeric(20, 6) not null check (quantity > 0),
  sale_price numeric(20, 6),
  currency char(3),
  mapped_recipe_version_id uuid references recipe_versions(id),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table order_writeoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  kmrs_order_id uuid references kmrs_orders(id),
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'released', 'cancelled_after_cooking', 'failed')),
  reservation_at timestamptz,
  committed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_writeoff_lines (
  id uuid primary key default gen_random_uuid(),
  order_writeoff_id uuid not null references order_writeoffs(id) on delete cascade,
  kmrs_order_line_id uuid references kmrs_order_lines(id),
  recipe_version_id uuid references recipe_versions(id),
  product_id uuid not null references products(id),
  stock_lot_id uuid references stock_lots(id),
  quantity numeric(20, 6) not null check (quantity > 0),
  unit_id uuid not null references units(id),
  unit_cost numeric(20, 6),
  currency char(3),
  stock_movement_id uuid references stock_movements(id),
  created_at timestamptz not null default now()
);

create table theoretical_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  product_id uuid not null references products(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  expected_quantity numeric(20, 6) not null check (expected_quantity >= 0),
  unit_id uuid not null references units(id),
  expected_cost numeric(20, 6),
  currency char(3),
  source text not null default 'kmrs_orders',
  calculated_at timestamptz not null default now()
);

create table actual_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  product_id uuid not null references products(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  actual_quantity numeric(20, 6) not null check (actual_quantity >= 0),
  unit_id uuid not null references units(id),
  actual_cost numeric(20, 6),
  currency char(3),
  source text not null default 'inventory_and_purchases',
  calculated_at timestamptz not null default now()
);

create table usage_variance_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  product_id uuid not null references products(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  theoretical_quantity numeric(20, 6) not null,
  actual_quantity numeric(20, 6) not null,
  variance_quantity numeric(20, 6) not null,
  unit_id uuid not null references units(id),
  variance_value numeric(20, 6),
  currency char(3),
  calculated_at timestamptz not null default now()
);

create table menu_engineering_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id),
  kmrs_menu_item_id uuid references kmrs_menu_items(id),
  recipe_version_id uuid references recipe_versions(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  units_sold numeric(20, 6) not null default 0,
  sales_total numeric(20, 6) not null default 0,
  theoretical_cost_total numeric(20, 6) not null default 0,
  gross_margin_total numeric(20, 6) not null default 0,
  food_cost_percent numeric(9, 4),
  popularity_rank integer,
  profitability_rank integer,
  quadrant text check (quadrant in ('star', 'plowhorse', 'puzzle', 'dog')),
  currency char(3) not null,
  calculated_at timestamptz not null default now()
);

create table price_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id),
  kmrs_menu_item_id uuid references kmrs_menu_items(id),
  recipe_version_id uuid references recipe_versions(id),
  current_price numeric(20, 6),
  recommended_price numeric(20, 6) not null check (recommended_price >= 0),
  target_food_cost_percent numeric(9, 4),
  current_food_cost_percent numeric(9, 4),
  reason text,
  currency char(3) not null,
  status text not null default 'open' check (status in ('open', 'approved', 'rejected', 'published', 'expired')),
  approved_by_user_id uuid references app_users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table kmrs_publish_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kmrs_connection_id uuid references kmrs_connections(id),
  request_type text not null check (request_type in ('price_update', 'description_update', 'composition_update', 'allergen_update', 'portion_update', 'stop_list_update')),
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'published', 'failed', 'cancelled')),
  approved_by_user_id uuid references app_users(id),
  approved_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table kmrs_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kmrs_connection_id uuid references kmrs_connections(id),
  sync_type text not null check (sync_type in ('menu_import', 'order_import', 'status_import', 'publish_export', 'full')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  imported_count integer not null default 0,
  exported_count integer not null default 0,
  error_message text,
  metadata jsonb
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  user_id uuid references app_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_locations_org on locations(organization_id);
create index idx_accounting_periods_org_status on accounting_periods(organization_id, status);
create index idx_products_org_category on products(organization_id, category_id);
create index idx_vendor_items_product on vendor_items(product_id);
create index idx_invoice_documents_org_status on invoice_documents(organization_id, status);
create index idx_invoice_lines_product on invoice_lines(product_id);
create index idx_supplier_price_history_product_observed on supplier_price_history(product_id, observed_at desc);
create index idx_order_guides_supplier on order_guides(supplier_id);
create index idx_stock_lots_location_product on stock_lots(location_id, product_id);
create index idx_stock_movements_location_product_time on stock_movements(location_id, product_id, occurred_at desc);
create index idx_stock_reservations_reference on stock_reservations(reference_type, reference_id);
create index idx_writeoff_documents_status on writeoff_documents(location_id, status);
create index idx_recipe_versions_recipe_status on recipe_versions(recipe_id, status);
create index idx_recipe_lines_version on recipe_lines(recipe_version_id);
create index idx_production_batches_location_status on production_batches(location_id, status);
create index idx_kmrs_menu_items_connection_item on kmrs_menu_items(kmrs_connection_id, kmrs_item_id);
create index idx_kmrs_connections_restaurant_scope on kmrs_connections(organization_id, location_id, base_url, restaurant_slug);
create index idx_kmrs_orders_connection_order on kmrs_orders(kmrs_connection_id, kmrs_order_id);
create index idx_order_writeoffs_kmrs_order on order_writeoffs(kmrs_order_id);
create index idx_theoretical_usage_period on theoretical_usage_snapshots(location_id, period_start, period_end);
create index idx_actual_usage_period on actual_usage_snapshots(location_id, period_start, period_end);
create index idx_menu_engineering_period on menu_engineering_snapshots(location_id, period_start, period_end);
create index idx_kmrs_publish_queue_status on kmrs_publish_queue(status, created_at);
create index idx_audit_log_entity on audit_log(entity_type, entity_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at before update on organizations
for each row execute function set_updated_at();

create trigger trg_locations_updated_at before update on locations
for each row execute function set_updated_at();

create trigger trg_app_users_updated_at before update on app_users
for each row execute function set_updated_at();

create trigger trg_accounting_periods_updated_at before update on accounting_periods
for each row execute function set_updated_at();

create trigger trg_products_updated_at before update on products
for each row execute function set_updated_at();

create trigger trg_suppliers_updated_at before update on suppliers
for each row execute function set_updated_at();

create trigger trg_vendor_items_updated_at before update on vendor_items
for each row execute function set_updated_at();

create trigger trg_order_guides_updated_at before update on order_guides
for each row execute function set_updated_at();

create trigger trg_purchase_orders_updated_at before update on purchase_orders
for each row execute function set_updated_at();

create trigger trg_invoice_documents_updated_at before update on invoice_documents
for each row execute function set_updated_at();

create trigger trg_stock_reservations_updated_at before update on stock_reservations
for each row execute function set_updated_at();

create trigger trg_writeoff_documents_updated_at before update on writeoff_documents
for each row execute function set_updated_at();

create trigger trg_recipes_updated_at before update on recipes
for each row execute function set_updated_at();

create trigger trg_recipe_versions_updated_at before update on recipe_versions
for each row execute function set_updated_at();

create trigger trg_production_batches_updated_at before update on production_batches
for each row execute function set_updated_at();

create trigger trg_kmrs_connections_updated_at before update on kmrs_connections
for each row execute function set_updated_at();

create trigger trg_kmrs_menu_recipe_links_updated_at before update on kmrs_menu_recipe_links
for each row execute function set_updated_at();

create trigger trg_order_writeoffs_updated_at before update on order_writeoffs
for each row execute function set_updated_at();

create trigger trg_kmrs_publish_queue_updated_at before update on kmrs_publish_queue
for each row execute function set_updated_at();
