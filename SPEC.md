# SPBU Watch SARBAGITA — Build Brief for Claude Code

## 0. How to work on this

- Read this whole file first. Work **one phase at a time** (Section 11). At the end of each phase: summarize what you built, show how to verify it (commands + what to look at), then **stop and wait for the user to confirm** before starting the next phase.
- Do not add features that are not listed. If something is ambiguous or a constraint in this file blocks you, ask instead of guessing.
- Code, comments, commit messages and README are in English. **All user-facing UI text is in Indonesian.**
- Several facts below (free-tier limits, tile provider terms, prices) change over time. Verify them at build time and tell the user if something no longer holds.

## 1. Goal

A free, mobile-first web app that lets people in the SARBAGITA area (Denpasar, Badung, Gianyar, Tabanan, Bali) see, **before driving to a fuel station (SPBU)**, how long the queue is and whether each fuel type is available. Data comes from crowdsourced reports with timestamps and automatic expiry, shown next to an "official information" panel.

It was triggered by the fuel queue crisis in Bali in October 2026, but must stay useful afterwards: peak hours, Pertamax availability, 24-hour stations, EV charging (SPKLU).

## 2. Hard constraints (requirements, not suggestions)

1. **No scraping of Google Maps or Popular Times.** It violates Google Maps Platform Terms, and the official Places API has no busyness/Popular Times field. Do not add libraries such as `populartimes`.
2. Google Places API is **optional** and only for matching stations to a `place_id` (place IDs may be stored indefinitely; other Google content must not be cached). The MVP can run without Google entirely.
3. OSM data is ODbL: show "© OpenStreetMap contributors" in the map UI and README.
4. **Not an official Pertamina product.** No Pertamina logo or branding. A visible disclaimer is required (Section 10).
5. Privacy: never store precise user coordinates, never store license plates or faces. Photos are out of scope for the MVP.
6. Must run at **zero cost** for the MVP on free tiers.
7. The anti-panic-buying rules in Section 8 are requirements. The governor of Bali publicly blamed panic buying as one cause of the queues, so a badly designed "stock out" display can make things worse.

## 3. Background (news up to 13 Oct 2026; context only, do not hardcode as fact in the UI)

- Queues started around 7 Oct and peaked 11–13 Oct 2026 in Denpasar, Badung, Tabanan and Gianyar (also Jembrana, Klungkung, Buleleng). Mostly Pertalite; Pertamax ran out where consumers switched.
- Reported causes: delayed supply from outside the island, a ship anchor problem that delayed unloading about 15 hours, higher Pertalite consumption, per-station quota limits, panic buying.
- Pertamina announced extra supply (26,200 KL in batches), 92 SPBU (Denpasar and Badung) open 24 hours, and a target of improvement from 14 Oct. Government statements earlier claimed "normal this afternoon" and were wrong, so treat all targets as unconfirmed.
- Approximate station counts: Denpasar ~49–54, Badung ~38, Gianyar ~27, Tabanan ~20, total ~139 (third-party or partial sources, an expectation to sanity-check against, **not a target to force**).
- No official real-time queue/stock dashboard from Pertamina or the Bali provincial government was found. MyPertamina has a station locator but no documented real-time stock API.

## 3b. Stack

- Next.js (App Router) + TypeScript, Tailwind CSS, pnpm, Node LTS. Deploy on Vercel or Cloudflare Pages (free tier).
- Supabase (Postgres + PostGIS) free tier. Server-side access only for writes.
- MapLibre GL JS. Tile/style URL comes from env var `NEXT_PUBLIC_MAP_STYLE_URL`. Do **not** use `tile.openstreetmap.org` in production (its usage policy forbids heavy use). Candidates: a free tier of a tile provider such as MapTiler, or self-hosted Protomaps PMTiles. Check current terms and ask the user which to use.
- zod for validation, vitest for tests, Playwright optional for a smoke test.

## 4. Repo layout

```
/
├── SPEC.md                    (this file)
├── README.md
├── data/
│   ├── spbu_raw.json          (input, produced by scripts/fetch_spbu.py)
│   ├── stations.csv           (output of Phase 1)
│   ├── stations.geojson       (output of Phase 1)
│   └── review_needed.csv      (stations needing manual review)
├── scripts/
│   ├── fetch_spbu.py          (already written; run locally, see 5)
│   └── build_stations.py      (Phase 1)
├── supabase/migrations/       (SQL from Section 6)
├── src/
│   ├── app/                   (pages + app/api route handlers)
│   ├── components/
│   └── lib/
│       ├── status.ts          (pure status algorithm, Section 7)
│       ├── config.ts          (all tunable constants)
│       └── ...
└── tests/
```

## 5. Data source and known blocker

- Station list comes from OpenStreetMap (`amenity=fuel`) via the Overpass API. `scripts/fetch_spbu.py` (already written, stdlib only, retries across mirrors, splits the area into 6 boxes) writes `spbu_raw.json` with a top-level `elements` array.
- Overpass may be blocked or overloaded in sandboxed environments. If you cannot reach it, **do not work around network restrictions**. Ask the user to run `python scripts/fetch_spbu.py` on their own machine and put `spbu_raw.json` into `data/`.
- The bounding box also catches stations outside the four regencies (Jembrana, Bangli, Klungkung, Buleleng); these must be filtered out in Phase 1.

## 6. Database (Supabase / Postgres + PostGIS)

```sql
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
```

Row Level Security: enable on all three tables. `anon` may `select` from `stations` and from `official_updates where active`. **`reports`: no anon access at all.** All writes and report reads go through server-side route handlers using the service role key (never exposed to the client).

Retention: purge reports older than 30 days (daily scheduled job, e.g. GitHub Action or pg_cron).

## 7. Status algorithm (`src/lib/status.ts`, pure functions, fully unit tested)

All constants live in `src/lib/config.ts`:

```
QUEUE_TTL_MIN = 45
STOCK_TTL_MIN = 60
HALF_LIFE_MIN = 20
MIN_DEVICES_FOR_OUT = 3      // distinct devices needed before showing "habis"
DOMINANCE = 0.6              // share of weighted votes needed to call a status
GEOFENCE_M = 500
```

**Queue status per station**
- Use non-hidden `queue` reports newer than `QUEUE_TTL_MIN`. Keep only the latest report per `device_id`.
- Weight = `0.5 ^ (ageMin / HALF_LIFE_MIN)`. Weighted mean of `queue_level`: `< 0.5` → sepi, `< 1.5` → sedang, otherwise panjang.
- No fresh report → `unknown` (grey). Always return `reportCount` and `lastReportAt` so the UI can say "dilaporkan 12 menit lalu oleh 3 orang". With only 1 report mark confidence `low`.

**Stock status per station and fuel**
- Use non-hidden `stock` reports for that fuel newer than `STOCK_TTL_MIN`, latest per device, same time-decay weights.
- `out` is returned only if at least `MIN_DEVICES_FOR_OUT` distinct devices reported out **and** the out-weight share is at least `DOMINANCE`. Fewer or weaker → `unconfirmed` (neutral wording, not red).
- `available` if the available-weight share is at least `DOMINANCE`. Neither side dominant → `conflicting`. No reports → `unknown`.

## 8. Anti-abuse and anti-panic rules

- **Rate limits** (server side): per device, one report per (station, kind, fuel) per 10 minutes and max 20 per hour overall; per `ip_hash`, max 60 per hour. Return HTTP 429 with an Indonesian message.
- **Geofence**: the client sends its coordinates with each report. The server computes the distance to the station with PostGIS and **rejects reports farther than 500 m (raised from 300 m)**. Coordinates are used for that check only and are never stored.
- **Anti-panic design** (all required):
  - Red "HABIS" only after the multi-device rule in Section 7; otherwise use neutral "Belum terkonfirmasi".
  - No ranking or list of "stations that still have stock", and no "nearest station with stock" feature in the MVP. The station list is sorted by distance or name, never by availability.
  - Filters may use static facts (24-hour, fuel type sold, regency), not live stock state.
  - No push notifications about shortages.
  - Every status shows its age and number of reports; stale data turns grey.
  - The official information panel sits above the station list.
- Optional (Phase 6, behind an env flag): Cloudflare Turnstile on the report form.

## 9. API (Next.js route handlers)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/stations` | all active stations with computed status; `Cache-Control: s-maxage=30, stale-while-revalidate=60` |
| GET | `/api/stations/[id]` | station detail plus the last 2 hours of anonymized reports (never expose `device_id` or `ip_hash`) |
| POST | `/api/reports` | body `{stationId, kind, queueLevel?, fuel?, stockStatus?, deviceId, lat, lng}`; zod validation; returns 201, 400, 403 (outside geofence), 429 |
| GET | `/api/official` | active official updates, pinned first, newest first |
| POST/PATCH | `/api/admin/official` | create/edit official updates; header `x-admin-token` compared in constant time with `ADMIN_TOKEN` |
| POST | `/api/admin/reports/[id]/hide` | moderation; sets `hidden = true` |

Expiry is computed at read time. No cron is needed for status.

## 10. Frontend

- **Home**: full-screen map centered on Denpasar (about -8.65, 115.2166). Markers: green = sepi, amber = sedang, red = panjang, grey = no data or stale. Cluster markers below zoom 12. Show a small stock icon only when a status is confirmed.
- **Bottom sheet** (mobile) with nearby stations, sorted by distance if geolocation is allowed, otherwise by name; search by station name or area.
- **Station sheet**: name, brand, regency, address, "24 jam" badge; queue status with "dilaporkan X menit lalu oleh N orang"; one row per fuel type with stock status; buttons "Laporkan antrean" and "Laporkan stok"; a "Rute" link to `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG` (plain link, no Google API).
- **Report flow**: ask for geolocation (explain why in Indonesian; handle denial gracefully) → choose queue level with 3 large buttons, or fuel + ada/habis → submit → thank-you message with the 10-minute cooldown. Store a random `deviceId` UUID in `localStorage` (wrap in try/catch; app must work without it).
- **Official info panel** (collapsible card at the top): latest 3 updates with date and source link, plus Pertamina Call Center 135.
- **Persistent disclaimer** (Indonesian, near the top and in the footer): "Data berasal dari laporan warga dan bersifat indikatif. Bukan informasi resmi Pertamina. Cek kanal resmi untuk kepastian."
- Footer: OSM attribution, short privacy note (what is and is not stored), contact link.
- Data refresh: client refetches `/api/stations` every 60 seconds while the tab is visible. No Supabase realtime in the MVP.
- Accessibility: never rely on color alone (icon + text label), touch targets at least 44 px, readable in bright sunlight. PWA manifest and a basic offline shell.

## 11. Phases (stop for confirmation after each)

**Phase 0 — Scaffold.** Next.js + TS + Tailwind + pnpm, ESLint/Prettier, vitest, `.env.example`, README with run instructions, folder layout from Section 4. *Done when:* `pnpm dev`, `pnpm test`, `pnpm lint` all pass on an empty app.

**Phase 1 — Station data.** `scripts/build_stations.py` reads `data/spbu_raw.json` and writes `stations.csv`, `stations.geojson`, `review_needed.csv`:
1. Dedupe by `(type, id)`; merge node/way duplicates of the same station (same brand within about 40 m).
2. Assign each station to Denpasar/Badung/Gianyar/Tabanan by point-in-polygon using boundary polygons fetched **once** from Nominatim (`polygon_geojson=1`, respect its 1 request/second policy and send a User-Agent), falling back to `addr:*` tags. Drop stations outside the four regencies; put unassignable ones in `review_needed.csv`.
3. Normalize brand/operator (Pertamina vs Shell, BP, Vivo, etc.), extract `opening_hours` and `is_24h`, fuel tags, and the Pertamina code (54.xxx.xx) when present.
4. Print counts per regency and compare with the expectations in Section 3. Report differences honestly; do not invent or pad stations.
*Done when:* CSV and GeoJSON validate, counts are printed, and the user has reviewed the count comparison and the review file.

**Phase 2 — Database and read API.** Migrations from Section 6, a seed script that loads `stations.csv`, RLS policies, `/api/stations`, `/api/stations/[id]`, `/api/official`, and `status.ts` with table-driven unit tests (expiry boundaries, conflicting votes, the 3-device rule, latest-per-device, decay). *Done when:* tests pass and `/api/stations` returns every station with `unknown` status.

**Phase 3 — Map UI (read-only).** Map, markers, clustering, bottom sheet, station sheet, search, official panel, disclaimer, OSM attribution. Use seeded fake reports in a dev-only script to check colors and states. *Done when:* usable on a 375 px wide screen and all statuses render correctly.

**Phase 4 — Reporting.** `POST /api/reports`, geofence, rate limits, report flow UI, `deviceId` handling. *Done when:* tests cover validation, geofence rejection, 429 behavior, and a report changes the map status after the next refresh.

**Phase 5 — Official info and admin.** Admin endpoints guarded by `ADMIN_TOKEN`, a minimal admin page to add/edit official updates and hide reports. Do not pre-fill any schedule or claim without a source; only the Call Center 135 entry may be seeded. *Done when:* an admin can publish an update with source link and date that shows on the home page.

**Phase 6 — Hardening and deploy.** Optional Turnstile, 30-day purge job, security headers, error monitoring (free tier), Playwright smoke test, a deploy checklist for Vercel/Cloudflare + Supabase, a privacy page. *Done when:* the app is deployed on a free-tier URL and the checklist is complete.

**Phase 7 — Later (separate decision).** Peak-hour statistics from the app's own reports, SPKLU layer (OSM `amenity=charging_station` and the Places `evChargeOptions` field), a "crisis mode" toggle, partnership with Disnaker ESDM Bali / Diskominfo / Hiswana Migas for official supply data, and a small evaluation of BestTime or TomTom signals on 20–30 stations before committing to any paid data.

## 12. Environment variables (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only, never in client code
NEXT_PUBLIC_MAP_STYLE_URL=
ADMIN_TOKEN=                        # long random string
IP_HASH_SALT=                       # long random string
NEXT_PUBLIC_TURNSTILE_SITE_KEY=     # optional
TURNSTILE_SECRET_KEY=               # optional
```

## 13. Out of scope for the MVP

Google Maps scraping, photo uploads, user accounts or login, push notifications (a per-station live chat was added later by decision, see supabase/migrations/0006_chat.sql; it never affects statuses), automatic scraping of social media, CCTV video analytics, paid data APIs (BestTime, SerpApi, TomTom, HERE), payments, and any claim that data is official.

## 14. Definition of done for the MVP

- All stations from Phase 1 appear on the map with correct regency and status states.
- A user can submit a queue or stock report within the geofence; abuse limits and the 3-device "habis" rule work as specified.
- Official panel, disclaimer, OSM attribution and privacy page are visible.
- Unit tests pass for the status algorithm, geofence and rate limits.
- Deployed on free tiers with no secrets in the client bundle or the repo.
