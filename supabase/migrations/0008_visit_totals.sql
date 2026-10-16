-- "Total pengunjung selama ini": one number per day, kept for good.
-- The visits table only keeps 7 days and its hashes change every day on purpose, so an all-time total cannot be
-- worked out from it later. visit_daily counts, per day, how many different visitors were seen that day. It holds no
-- hash, no IP and no device id: only a date and a count. A person who comes back on another day is counted again
-- (we do not follow visitors across days), so the total is "visitor-days", and the app says so.
create table visit_daily (
  day date primary key,
  visitors bigint not null default 0
);
alter table visit_daily enable row level security; -- no policies: anon cannot read or write

-- Start from what is still in visits (at most the last 7 days). Earlier days were already deleted and are not counted.
insert into visit_daily (day, visitors)
select day, count(*) from visits group by day
on conflict (day) do update set visitors = excluded.visitors;

-- Same function as in 0005, plus: the first time a visitor is seen on a day, that day's count goes up by one.
-- (xmax = 0 is true only for a row that was inserted, not for one that was updated by the conflict clause.)
create or replace function record_visit(p_visitor text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Makassar')::date;
  is_new boolean;
begin
  insert into visits (day, visitor, last_seen) values (today, p_visitor, now())
  on conflict (day, visitor) do update set last_seen = now()
  returning (xmax = 0) into is_new;
  if is_new then
    insert into visit_daily (day, visitors) values (today, 1)
    on conflict (day) do update set visitors = visit_daily.visitors + 1;
  end if;
  if random() < 0.01 then
    delete from visits where day < today - 7;
  end if;
end $$;

-- Total and the first day that is counted.
create function visit_totals() returns table (total bigint, since date)
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(visitors), 0)::bigint, min(day) from visit_daily
$$;

revoke execute on function visit_totals() from public, anon, authenticated;
grant execute on function visit_totals() to service_role;
