-- Third kind of report: "SPBU buka" / "SPBU tutup" (visitors within the geofence, and the admin).
-- Run this BEFORE deploying the version of the app that has the report button: the app also reads the new column.
--
-- reports.kind used to allow only 'queue' and 'stock', and a table-level check tied each kind to its columns.
-- Both are replaced. Column checks on queue_level, fuel and stock_status are left as they are.
alter table reports add column if not exists open_status text check (open_status in ('open', 'closed'));

-- Drop the old kind check and the old shape check, whatever name they were given (found by their contents:
-- both mention the kinds 'queue' and 'stock'; the column checks on fuel and stock_status do not mention 'queue').
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.reports'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%''queue''%'
      and pg_get_constraintdef(oid) like '%''stock''%'
  loop
    execute format('alter table public.reports drop constraint %I', c.conname);
  end loop;
end $$;

alter table reports add constraint reports_kind_check check (kind in ('queue', 'stock', 'open'));
alter table reports add constraint reports_shape_check check (
  (kind = 'queue' and queue_level is not null and fuel is null and stock_status is null and open_status is null) or
  (kind = 'stock' and queue_level is null and fuel is not null and stock_status is not null and open_status is null) or
  (kind = 'open'  and queue_level is null and fuel is null and stock_status is null and open_status is not null)
);
