insert into units (organization_id, code, name, measure_type, is_base)
select id, 'dish', 'блюдо', 'count', false
from organizations
on conflict (organization_id, code)
do update set
  name = excluded.name,
  measure_type = excluded.measure_type,
  is_base = excluded.is_base;

update recipe_versions rv
set
  yield_unit_id = dish.id,
  updated_at = now()
from recipes r
join units dish on dish.organization_id = r.organization_id and dish.code = 'dish'
join units pcs on pcs.organization_id = r.organization_id and pcs.code = 'pcs'
where r.id = rv.recipe_id
  and r.recipe_type = 'menu_item'
  and rv.yield_unit_id = pcs.id
  and rv.yield_quantity = 1;
