create extension if not exists postgis;

create table stations (
  id uuid primary key default gen_random_uuid(),
  osm_type text not null,
  osm_id bigint not null,
  pertamina_code text,                -- format 54.xxx.xx when known
  name text not null,
  brand text,
  operator text,
  regency text not null check (regency in ('Denpasar','Badung','Gianyar','Tabanan')),
  lat double precision not null,
  lng double precision not null,
  geom geography(Point,4326) not null,
  address text,
  opening_hours text,
  is_24h boolean not null default false,
  fuels jsonb not null default '[]',  -- fuel types sold, when known
  has_ev_charging boolean not null default false,
  google_place_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);
create index on stations using gist (geom);

-- geom is derived from lat/lng so seed scripts only need to send lat and lng.
create function stations_set_geom() returns trigger language plpgsql as $$
begin
  new.geom := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  return new;
end $$;
create trigger stations_set_geom before insert or update of lat, lng on stations
  for each row execute function stations_set_geom();

create table reports (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  kind text not null check (kind in ('queue','stock')),
  queue_level smallint check (queue_level between 0 and 2),   -- 0 sepi, 1 sedang, 2 panjang
  fuel text check (fuel in ('pertalite','pertamax','pertamax_turbo','solar','dexlite','pertamina_dex')),
  stock_status text check (stock_status in ('available','out')),
  device_id text not null,            -- random UUID from the client, not personal data
  ip_hash text not null,              -- salted hash, never the raw IP
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (kind = 'queue' and queue_level is not null and fuel is null and stock_status is null) or
    (kind = 'stock' and queue_level is null and fuel is not null and stock_status is not null)
  )
);
create index on reports (station_id, created_at desc);

create table official_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  source_name text not null,
  source_url text,
  published_at timestamptz not null,
  pinned boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Row Level Security. `reports` gets no policy at all: anon cannot touch it.
-- The service role key (server only) bypasses RLS.
alter table stations enable row level security;
alter table reports enable row level security;
alter table official_updates enable row level security;

create policy "anon read stations" on stations for select to anon using (true);
create policy "anon read active official updates" on official_updates
  for select to anon using (active);
