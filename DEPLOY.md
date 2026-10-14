# Deploy checklist (free tiers)

Target: Vercel (Hobby) + Supabase (Free) + MapTiler (Free). Verify current free-tier limits on each
provider's pricing page before launch; they change.

> Vercel's Hobby plan is for **non-commercial** use. MapTiler's free plan is too. If the app ever earns
> money or takes sponsorship, re-check both.

## 1. Supabase

- [ ] Project created (region Singapore). Paid plan **not** enabled.
- [ ] Run `supabase/migrations/0001` to `0004` in the SQL Editor, in order (paste the file contents).
  - 0004 uses `pg_cron`; if it errors, enable **Database → Extensions → pg_cron** and run it again,
    or schedule `pnpm purge:reports` daily instead (GitHub Actions with the two Supabase secrets).
- [ ] `pnpm seed` (stations) and `pnpm seed:official` (Call Center 135 only) run once against the project.
- [ ] RLS is on for all three tables. `reports` has no policy (check **Authentication → Policies**).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only set as a server env var on the host, never in the repo or client.

## 2. MapTiler

- [ ] API key created, **Allowed HTTP origins** set to the production domain (and `http://localhost:3000`,
  `http://localhost:3100` for local runs). Do not leave the key unrestricted.
- [ ] Attribution text (© MapTiler, © OpenStreetMap contributors) is visible. MapTiler asks for its logo
  on the map; confirm the current wording of their terms before public launch.

## 3. Vercel

- [ ] Code pushed to a GitHub repository (private is fine). **Never commit `.env`** (it is in `.gitignore`).
- [ ] Project imported on Vercel (framework: Next.js, package manager: pnpm).
- [ ] Environment variables set (Production):

  | Variable | Notes |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | public |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public (anon key only) |
  | `SUPABASE_SERVICE_ROLE_KEY` | secret, server only |
  | `NEXT_PUBLIC_MAP_STYLE_URL` | MapTiler style URL with the restricted key |
  | `ADMIN_TOKEN` | long random string, different from any other password |
  | `IP_HASH_SALT` | long random string. Changing it later resets per-IP limits |
  | `NEXT_PUBLIC_CONTACT_URL` | `mailto:` or `https://` link (needed for the privacy page) |
  | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional, set both or neither |

  `NEXT_PUBLIC_*` values are baked in at build time: redeploy after changing them.
- [ ] First deploy succeeded. Production URL added to the MapTiler key's allowed origins.

## 4. Verify the live site

- [ ] Home page loads, map and markers show, disclaimer visible at the top and in the footer.
- [ ] `/api/stations` returns all stations; statuses `unknown` until real reports arrive.
- [ ] Submit one real report from a phone at a station (needs HTTPS for geolocation); status changes after refresh.
- [ ] A report from far away is rejected (403), and a second identical report within 10 min gets 429.
- [ ] `/admin`: wrong token is rejected, right token lets you publish an update with a source link; it shows on the home page.
- [ ] `/privasi` loads and shows a working contact link.
- [ ] "Add to home screen" works and offline shows the offline page.
- [ ] `pnpm test:e2e` passes against the production build (`pnpm build` first).
- [ ] No test or fake data left: run `pnpm fake-reports --clear` against the production database.
- [ ] Response headers contain a CSP (check in browser dev tools → Network).

## 5. Optional hardening

- [ ] Cloudflare Turnstile: create a widget for the production domain, set both keys, redeploy.
- [ ] Error monitoring: `src/instrumentation.ts` logs every server error as one JSON line to the host's
  runtime logs. For alerts and client-side errors add Sentry (free tier) and its DSN.
- [ ] Uptime check on `/api/official` with a free monitor.
