-- Estado de seguimiento inicial por unidad (tras cargar seed/units.sql).
insert into unit_engagements (unit_id, stage)
select id, 'no_contactada'
from organizational_units
where is_rat_unit and not deferred
on conflict (unit_id) do nothing;
