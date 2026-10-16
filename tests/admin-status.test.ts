import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ADMIN_DEVICE_ID } from "@/lib/config";
import { loadStationsWithStatus, type ReportRow } from "@/lib/stations";

// A tiny in-memory stand-in for the Supabase query builder: just the calls the status loader makes.
type Row = Record<string, unknown>;
function fakeSupabase(tables: Record<string, Row[]>): SupabaseClient {
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    const orders: [string, boolean][] = [];
    let window: [number, number] | null = null;
    const b = {
      select: () => b,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), b),
      order: (c: string, o?: { ascending?: boolean }) => (orders.push([c, o?.ascending !== false]), b),
      range: (a: number, z: number) => ((window = [a, z]), b),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        let rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
        for (const [c, asc] of [...orders].reverse()) {
          rows = [...rows].sort((x, y) => (String(x[c]) < String(y[c]) ? -1 : 1) * (asc ? 1 : -1));
        }
        if (window) rows = rows.slice(window[0], window[1] + 1);
        return Promise.resolve({ data: rows, error: null }).then(res, rej);
      },
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

const NOW = new Date("2026-10-14T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const STATION = {
  id: "s1", name: "SPBU Pertamina 54.801.01", brand: "Pertamina", operator: "Pertamina", regency: "Denpasar",
  lat: -8.6, lng: 115.2, address: null, opening_hours: null, is_24h: false, fuels: [], has_ev_charging: false,
  pertamina_code: "54.801.01", active: true,
};
let nextId = 1;
const report = (device: string, minAgo: number, level: number): ReportRow => ({
  id: `r${nextId++}`, station_id: "s1", kind: "queue", queue_level: level, fuel: null, stock_status: null,
  device_id: device, hidden: false, created_at: ago(minAgo),
});

async function queueOf(reports: ReportRow[]) {
  const db = fakeSupabase({ stations: [STATION], reports: reports as unknown as Row[] });
  const [s] = await loadStationsWithStatus(db, db, NOW);
  return s.queue;
}

describe("an admin queue report shows up in the status at once", () => {
  it("on a station with no other reports", async () => {
    expect((await queueOf([report(ADMIN_DEVICE_ID, 0, 1)])).status).toBe("sedang");
  });

  it("replaces an older admin report from days ago (one tap is enough)", async () => {
    const old = report(ADMIN_DEVICE_ID, 36 * 60, 2);
    expect((await queueOf([old, report(ADMIN_DEVICE_ID, 0, 0)])).status).toBe("sepi");
  });

  it("a second tap does not change anything: both come from the same device", async () => {
    const first = report(ADMIN_DEVICE_ID, 0.2, 0);
    const second = report(ADMIN_DEVICE_ID, 0, 0);
    expect((await queueOf([first])).status).toBe("sepi");
    expect((await queueOf([first, second])).status).toBe("sepi");
  });

  it("a fresh admin report overrules several visitors: the pin follows the first tap", async () => {
    const visitors = [report("v1", 10, 2), report("v2", 8, 2), report("v3", 5, 2)];
    expect((await queueOf(visitors)).status).toBe("panjang");
    const q = await queueOf([...visitors, report(ADMIN_DEVICE_ID, 0, 0)]);
    expect(q.status).toBe("sepi");
    expect(q.fromAdmin).toBe(true);
  });

  it("an admin report from two days ago only leaves its time behind, not a coloured status", async () => {
    const q = await queueOf([report(ADMIN_DEVICE_ID, 2 * 24 * 60, 2)]);
    expect(q.status).toBe("unknown");
    expect(q.stale).toBe(true);
    expect(q.lastReportAt).not.toBeNull();
  });
});
