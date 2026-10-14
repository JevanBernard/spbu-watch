import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// These tests WRITE to the database that .env points at (reports are removed again afterwards).
// Run them on purpose:  E2E_WRITE=1 pnpm test:e2e e2e/write-flow.spec.ts
try {
  process.loadEnvFile(".env");
} catch {
  // variables may already be in the environment
}

const DEVICE = `e2e-${Math.random().toString(36).slice(2, 12)}`;
const PUBLIC_KEYS = ["createdAt", "fuel", "kind", "queueLevel", "stockStatus"];

test.describe("write flow", () => {
  test.skip(process.env.E2E_WRITE !== "1", "set E2E_WRITE=1 to run (writes to the database)");
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    await createClient(url, key, { auth: { persistSession: false } }).from("reports").delete().eq("device_id", DEVICE);
  });

  type St = { id: string; lat: number; lng: number; queue: { reportCount: number } };
  const body = (s: St, extra: object, over: object = {}) => ({
    stationId: s.id, deviceId: DEVICE, lat: s.lat, lng: s.lng, ...extra, ...over,
  });

  test("validation, geofence, cooldown, privacy of the response, and the hourly limit", async ({ request }) => {
    const { stations } = (await (await request.get("/api/stations")).json()) as { stations: St[] };
    const quiet = stations.filter((s) => s.queue.reportCount === 0);
    expect(quiet.length).toBeGreaterThan(25);
    const [a] = quiet;
    const queue = { kind: "queue", queueLevel: 2 };

    // invalid body -> 400
    expect((await request.post("/api/reports", { data: { nope: true } })).status()).toBe(400);
    // far away (about 41 km) -> 403
    const far = await request.post("/api/reports", { data: body(a, queue, { lat: a.lat + 0.4 }) });
    expect(far.status()).toBe(403);
    // at the station -> 201, the same report again -> 429 with Retry-After
    expect((await request.post("/api/reports", { data: body(a, queue) })).status()).toBe(201);
    const again = await request.post("/api/reports", { data: body(a, queue) });
    expect(again.status()).toBe(429);
    expect(again.headers()["retry-after"]).toBe("600");
    // a different kind of report from the same device is allowed
    const stock = { kind: "stock", fuel: "pertamax", stockStatus: "available" };
    expect((await request.post("/api/reports", { data: body(a, stock) })).status()).toBe(201);

    // the public detail response exposes reports, but never who sent them
    const detailRes = await request.get(`/api/stations/${a.id}`);
    const raw = await detailRes.text();
    const detail = JSON.parse(raw) as { recentReports: Record<string, unknown>[]; station: { queue: { reportCount: number } } };
    expect(detail.recentReports.length).toBeGreaterThanOrEqual(2);
    for (const r of detail.recentReports) expect(Object.keys(r).sort()).toEqual(PUBLIC_KEYS);
    for (const secret of [DEVICE, "device_id", "deviceId", "ip_hash", "ipHash"]) expect(raw).not.toContain(secret);
    expect(detail.station.queue.reportCount).toBeGreaterThanOrEqual(1);
    const listRaw = await (await request.get("/api/stations")).text();
    for (const secret of [DEVICE, "device_id", "ip_hash"]) expect(listRaw).not.toContain(secret);

    // hourly limit: this device already sent 2 reports; 18 more at other stations reach 20, the next is 429
    let sent = 2;
    for (const s of quiet.slice(1)) {
      const res = await request.post("/api/reports", { data: body(s, queue) });
      if (sent < 20) {
        expect(res.status()).toBe(201);
        sent += 1;
      } else {
        expect(res.status()).toBe(429);
        expect(String((await res.json()).error)).toMatch(/perangkat/);
        break;
      }
    }
    expect(sent).toBe(20);
  });
});
