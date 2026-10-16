-- Live chat per station (visitors near the station only; anyone can read).
-- No policies: anon cannot read or write. All access goes through server route handlers with the service role,
-- which also check the 500 m geofence, rate limits and content rules before inserting.
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  device_id text not null,            -- random UUID from the client, not personal data
  ip_hash text not null,              -- salted hash, never the raw IP
  nickname text not null,             -- "Pengendara 4F2A": derived per station, cannot be linked across stations
  body text not null check (char_length(body) between 1 and 200),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on chat_messages (station_id, created_at desc);
create index on chat_messages (device_id, created_at desc);
create index on chat_messages (ip_hash, created_at desc);
alter table chat_messages enable row level security;

-- "Laporkan pesan": one flag per device per message. Three different devices hide a message automatically.
create table chat_flags (
  message_id uuid not null references chat_messages(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, device_id)
);
alter table chat_flags enable row level security;

-- Retention: messages are only shown for 6 hours; they are deleted after 2 days.
-- Same note as 0004: if "create extension" fails, enable pg_cron in the dashboard first, or run
-- `pnpm purge:reports` (it also removes old chat messages) from a scheduled job instead.
create or replace function purge_old_chat() returns bigint
language plpgsql security definer set search_path = public
as $$
declare n bigint;
begin
  delete from chat_messages where created_at < now() - interval '2 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function purge_old_chat() from public, anon, authenticated;
grant execute on function purge_old_chat() to service_role;

create extension if not exists pg_cron;
select cron.schedule('purge-old-chat', '23 19 * * *', $$ select purge_old_chat(); $$); -- 03:23 WITA daily
