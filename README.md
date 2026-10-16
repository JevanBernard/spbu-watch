# SPBU Watch SARBAGITA

Free, mobile-first web app showing crowdsourced fuel-station (SPBU) queue and stock status in Denpasar, Badung, Gianyar and Tabanan (Bali). See [SPEC.md](SPEC.md) for the full brief.

**Not an official Pertamina product.** Data comes from citizen reports and is indicative only.

## Run

```bash
pnpm install
cp .env.example .env.local   # fill in later phases
pnpm dev      # http://localhost:3000
pnpm test          # unit tests
pnpm lint
pnpm build && pnpm test:e2e   # Playwright smoke test (uses local Chrome, port 3100)
```

Requires Node LTS and pnpm.

## Station data

```bash
python scripts/fetch_spbu.py   # writes data/spbu_raw.json (Overpass API)
```

## Attribution

Map data © OpenStreetMap contributors (ODbL).

```bash
python scripts/build_stations.py   # data/stations.csv, stations.geojson, review_needed.csv
```

Boundaries are fetched once from Nominatim and cached in `data/regency_boundaries.json`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm seed` | Load `data/stations.csv` into Supabase |
| `pnpm seed:official` | Insert the Call Center 135 entry (only) |
| `pnpm fake-reports` / `--clear` | Dev-only fake reports to check UI states |
| `pnpm purge:reports` | Delete reports older than 30 days and chat messages older than 2 days (if pg_cron is not used) |

Database SQL lives in `supabase/migrations/` (run in order in the Supabase SQL Editor).
Deployment steps: [DEPLOY.md](DEPLOY.md). Privacy: `/privasi`.

Not an official Pertamina product. No Pertamina branding is used.
