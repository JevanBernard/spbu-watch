import { describe, expect, it, vi } from "vitest";
import {
  clientIp,
  hashIp,
  processReport,
  reportSchema,
  type NewReportRow,
  type ReportDeps,
} from "@/lib/reports";

const STATION = "3f2b8f0e-5c1a-4c1e-9d55-0b6f6a1e2c11";
const NOW = new Date("2026-10-14T12:00:00Z");

const queueBody = {
  stationId: STATION,
  kind: "queue",
  queueLevel: 2,
  deviceId: "device-abc-123",
  lat: -8.65,
  lng: 115.2166,
};
const stockBody = {
  stationId: STATION,
  kind: "stock",
  fuel: "pertalite",
  stockStatus: "out",
  deviceId: "device-abc-123",
  lat: -8.65,
  lng: 115.2166,
};

function makeDeps(over: Partial<ReportDeps> = {}) {
  const inserted: NewReportRow[] = [];
  const deps: ReportDeps = {
    distanceM: vi.fn(async () => 50),
    countDeviceSame: vi.fn(async () => 0),
    countDevice: vi.fn(async () => 0),
    countIp: vi.fn(async () => 0),
    insert: vi.fn(async (row) => {
      inserted.push(row);
    }),
    now: () => NOW,
    ...over,
  };
  return { deps, inserted };
}

describe("reportSchema validation", () => {
  const invalid: [string, unknown][] = [
    ["not an object", "hello"],
    ["bad station id", { ...queueBody, stationId: "nope" }],
    ["queue level too high", { ...queueBody, queueLevel: 3 }],
    ["queue level not integer", { ...queueBody, queueLevel: 1.5 }],
    ["queue without level", { ...queueBody, queueLevel: undefined }],
    ["queue with fuel", { ...queueBody, fuel: "pertalite" }],
    ["stock without fuel", { ...stockBody, fuel: undefined }],
    ["stock without status", { ...stockBody, stockStatus: undefined }],
    ["stock with queue level", { ...stockBody, queueLevel: 1 }],
    ["unknown fuel", { ...stockBody, fuel: "premium" }],
    ["unknown stock status", { ...stockBody, stockStatus: "maybe" }],
    ["short device id", { ...queueBody, deviceId: "abc" }],
    ["device id with bad chars", { ...queueBody, deviceId: "device id; drop table" }],
    ["lat out of range", { ...queueBody, lat: 91 }],
    ["lng as string", { ...queueBody, lng: "115.2" }],
    ["extra field", { ...queueBody, hidden: true }],
  ];
  it.each(invalid)("rejects %s", (_name, body) => {
    expect(reportSchema.safeParse(body).success).toBe(false);
  });

  it("accepts valid queue and stock reports", () => {
    expect(reportSchema.safeParse(queueBody).success).toBe(true);
    expect(reportSchema.safeParse(stockBody).success).toBe(true);
  });
});

describe("processReport", () => {
  it("returns 400 for invalid data without touching the database", async () => {
    const { deps } = makeDeps();
    const res = await processReport({ ...queueBody, queueLevel: 9 }, "ip", deps);
    expect(res.status).toBe(400);
    expect(deps.distanceM).not.toHaveBeenCalled();
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown station", async () => {
    const { deps } = makeDeps({ distanceM: async () => null });
    expect((await processReport(queueBody, "ip", deps)).status).toBe(404);
  });

  it("stores a valid queue report with the right columns", async () => {
    const { deps, inserted } = makeDeps();
    const res = await processReport(queueBody, "iphash", deps);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true, cooldownMinutes: 10 });
    expect(inserted).toEqual([
      {
        station_id: STATION,
        kind: "queue",
        queue_level: 2,
        fuel: null,
        stock_status: null,
        device_id: "device-abc-123",
        ip_hash: "iphash",
      },
    ]);
  });

  it("stores a valid stock report", async () => {
    const { deps, inserted } = makeDeps();
    expect((await processReport(stockBody, "iphash", deps)).status).toBe(201);
    expect(inserted[0]).toMatchObject({
      kind: "stock",
      queue_level: null,
      fuel: "pertalite",
      stock_status: "out",
    });
  });

  it("never stores coordinates", async () => {
    const { deps, inserted } = makeDeps();
    await processReport(queueBody, "iphash", deps);
    expect(Object.keys(inserted[0])).not.toContain("lat");
    expect(Object.keys(inserted[0])).not.toContain("lng");
    expect(JSON.stringify(inserted[0])).not.toContain("115.2166");
  });

  describe("geofence", () => {
    it.each([
      [0, 201],
      [299, 201],
      [300, 201],
      [300.5, 403],
      [5000, 403],
    ])("distance %s m -> %s", async (distance, status) => {
      const { deps, inserted } = makeDeps({ distanceM: async () => distance });
      const res = await processReport(queueBody, "ip", deps);
      expect(res.status).toBe(status);
      expect(inserted.length).toBe(status === 201 ? 1 : 0);
    });

    it("explains the rejection in Indonesian", async () => {
      const { deps } = makeDeps({ distanceM: async () => 1200 });
      const res = await processReport(queueBody, "ip", deps);
      expect(res.body.error).toMatch(/300 meter/);
    });
  });

  describe("rate limits (429)", () => {
    it("blocks a repeat for the same station/kind/fuel within 10 minutes", async () => {
      const countDeviceSame = vi.fn(async () => 1);
      const { deps, inserted } = makeDeps({ countDeviceSame });
      const res = await processReport(queueBody, "ip", deps);
      expect(res.status).toBe(429);
      expect(res.headers?.["Retry-After"]).toBe("600");
      expect(String(res.body.error)).toMatch(/10 menit/);
      expect(inserted).toHaveLength(0);
      // The lookup window is exactly 10 minutes.
      expect(countDeviceSame).toHaveBeenCalledWith(
        expect.objectContaining({ stationId: STATION }),
        new Date(NOW.getTime() - 10 * 60_000).toISOString(),
      );
    });

    it("device limit: 19 in the last hour is fine, 20 is blocked", async () => {
      const ok = makeDeps({ countDevice: async () => 19 });
      expect((await processReport(queueBody, "ip", ok.deps)).status).toBe(201);
      const blocked = makeDeps({ countDevice: async () => 20 });
      const res = await processReport(queueBody, "ip", blocked.deps);
      expect(res.status).toBe(429);
      expect(blocked.inserted).toHaveLength(0);
    });

    it("ip limit: 59 is fine, 60 is blocked", async () => {
      const ok = makeDeps({ countIp: async () => 59 });
      expect((await processReport(queueBody, "ip", ok.deps)).status).toBe(201);
      const blocked = makeDeps({ countIp: async () => 60 });
      const res = await processReport(queueBody, "ip", blocked.deps);
      expect(res.status).toBe(429);
      expect(res.headers?.["Retry-After"]).toBe("3600");
    });

    it("queries the hourly counters with a 60 minute window and the given ip hash", async () => {
      const countIp = vi.fn(async () => 0);
      const countDevice = vi.fn(async () => 0);
      const { deps } = makeDeps({ countIp, countDevice });
      await processReport(queueBody, "the-hash", deps);
      const since = new Date(NOW.getTime() - 60 * 60_000).toISOString();
      expect(countIp).toHaveBeenCalledWith("the-hash", since);
      expect(countDevice).toHaveBeenCalledWith("device-abc-123", since);
    });
  });
});

describe("ip helpers", () => {
  it("hashIp is salted, stable and does not contain the ip", () => {
    const a = hashIp("1.2.3.4", "salt-one");
    expect(a).toBe(hashIp("1.2.3.4", "salt-one"));
    expect(a).not.toBe(hashIp("1.2.3.4", "salt-two"));
    expect(a).not.toBe(hashIp("1.2.3.5", "salt-one"));
    expect(a).not.toContain("1.2.3.4");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("clientIp prefers the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
