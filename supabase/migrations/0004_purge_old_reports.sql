-- Retention: reports older than 30 days are deleted every day (SPEC section 6).
-- pg_cron is available on Supabase (Database > Extensions > pg_cron). If this migration fails on
-- "create extension", enable pg_cron in the dashboard first, or use `pnpm purge:reports` from a
-- scheduled GitHub Action instead.
create or replace function purge_old_reports() returns bigint
language plpgsql security definer set search_path = public
as $$
declare n bigint;
begin
  delete from reports where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function purge_old_reports() from public, anon, authenticated;
grant execute on function purge_old_reports() to service_role;

create extension if not exists pg_cron;
select cron.schedule('purge-old-reports', '17 19 * * *', $$ select purge_old_reports(); $$); -- 03:17 WITA daily
