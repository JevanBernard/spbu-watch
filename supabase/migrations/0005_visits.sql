-- Anonymous visitor counter (shown in the app as "N online / M pengunjung hari ini").
-- Only a salted, per-day hash is stored: it cannot be linked across days or back to a person.
-- Rows older than 7 days are deleted automatically. No policies: anon cannot read or write.
create table visits (
  day date not null,
  visitor text not null,
  last_seen timestamptz not null default now(),
  primary key (day, visitor)
);
alter table visits enable row level security;

create function record_visit(p_visitor text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Makassar')::date;
begin
  insert into visits (day, visitor, last_seen) values (today, p_visitor, now())
  on conflict (day, visitor) do update set last_seen = now();
  if random() < 0.01 then
    delete from visits where day < today - 7;
  end if;
end $$;

create function visit_stats() returns table (today bigint, online bigint)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where day = (now() at time zone 'Asia/Makassar')::date),
    count(*) filter (where last_seen > now() - interval '5 minutes')
  from visits
  where day >= (now() at time zone 'Asia/Makassar')::date - 1
$$;

revoke execute on function record_visit(text) from public, anon, authenticated;
revoke execute on function visit_stats() from public, anon, authenticated;
grant execute on function record_visit(text) to service_role;
grant execute on function visit_stats() to service_role;
