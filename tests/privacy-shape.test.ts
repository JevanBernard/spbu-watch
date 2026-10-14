import { describe, expect, it } from "vitest";
import { anonymizeReports } from "@/lib/anonymize";
import { publicStation, type StationRow } from "@/lib/stations";

// A database row as it comes back from Supabase, including every column that must never be public.
const dbRow = {
  id: "11111111-1111-4111-8111-111111111111",
  station_id: "22222222-2222-4222-8222-222222222222",
  kind: "stock" as const,
  queue_level: null,
  fuel: "pertamax",
  stock_status: "available" as const,
  device_id: "secret-device-abcdef12",
  ip_hash: "f".repeat(64),
  hidden: false,
  created_at: "2026-10-14T10:00:00Z",
  lat: -8.65,
  lng: 115.21,
};

describe("anonymizeReports", () => {
  it("exposes only kind, level, fuel, status and time", () => {
    const [out] = anonymizeReports([dbRow]);
    expect(Object.keys(out).sort()).toEqual(["createdAt", "fuel", "kind", "queueLevel", "stockStatus"]);
  });
  it("never contains the device id, ip hash, report id or station id anywhere in the JSON", () => {
    const json = JSON.stringify(anonymizeReports([dbRow, { ...dbRow, kind: "queue" as const, queue_level: 2 }]));
    for (const secret of ["secret-device", "ffffffff", dbRow.id, dbRow.station_id, "device", "ip_hash", "hidden"]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe("publicStation", () => {
  const station = {
    id: "s1", name: "SPBU Pertamina 54.801.01", brand: "Pertamina", operator: "Pertamina", regency: "Denpasar",
    lat: -8.6, lng: 115.2, address: "Jl. A", opening_hours: null, is_24h: true, fuels: ["solar"], has_ev_charging: false,
    pertamina_code: "54.801.01",
    // not selected by the real query, but if one ever were it must still not be exposed:
    ip_hash: "x", device_id: "y", geom: "POINT(1 2)",
  } as unknown as StationRow;
  it("is a fixed whitelist of fields", () => {
    expect(Object.keys(publicStation(station)).sort()).toEqual(
      [
        "id", "name", "brand", "regency", "lat", "lng", "address", "openingHours", "is24h", "fuels", "fuelsFromUsers",
        "hasEvCharging", "pertaminaCode", "category", "isGes", "fuelsComplete",
      ].sort(),
    );
    const json = JSON.stringify(publicStation(station));
    expect(json).not.toContain("ip_hash");
    expect(json).not.toContain("device_id");
    expect(json).not.toContain("geom");
  });
});
