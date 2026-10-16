import { describe, expect, it } from "vitest";
import type { StationDTO } from "@/lib/api-types";
import { buildAppCard, buildStationCard, slugify, stampText } from "@/lib/share-card";

const NOW = new Date("2026-10-16T06:32:00Z"); // 14.32 WITA
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

const summary = (over: object = {}) => ({
  reportCount: 0,
  lastReportAt: null,
  fromAdmin: false,
  stale: false,
  confidence: "none" as const,
  ...over,
});

function station(over: Partial<StationDTO> = {}): StationDTO {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "SPBU Pertamina 54.801.60 (Setia Budi)",
    brand: "Pertamina",
    regency: "Denpasar",
    lat: -8.65,
    lng: 115.2,
    address: "Jl. Gatot Subroto Barat No. 348, Denpasar",
    openingHours: null,
    is24h: false,
    fuels: ["pertalite", "pertamax"],
    fuelsFromUsers: [],
    hasEvCharging: false,
    pertaminaCode: "54.801.60",
    category: "spbu",
    isGes: false,
    fuelsComplete: false,
    queue: { status: "unknown", ...summary() },
    open: { status: "unknown", ...summary() },
    stock: {},
    ...over,
  } as StationDTO;
}
const URL_ = "https://spbu-watch.vercel.app/?spbu=11111111-1111-4111-8111-111111111111";

describe("station share card", () => {
  it("always carries the time it was made, the disclaimer and a link to live data", () => {
    const c = buildStationCard(station(), NOW, URL_);
    expect(c.stamp).toBe("Per Jumat, 16 Oktober 2026, pukul 14.32 WITA");
    expect(c.disclaimer).toMatch(/Bukan informasi resmi Pertamina/);
    expect(c.note).toMatch(/saat dibuat/);
    expect(c.url).toBe(URL_);
    expect(c.urlText).toBe("spbu-watch.vercel.app");
  });

  it("queue: level, tone and who reported when", () => {
    const c = buildStationCard(
      station({ queue: { status: "panjang", ...summary({ reportCount: 4, lastReportAt: ago(8), confidence: "normal" }) } }),
      NOW,
      URL_,
    );
    expect(c.queue).toMatchObject({ tone: "bad", title: "Antrean panjang" });
    expect(c.queue!.detail).toBe("dilaporkan 8 menit lalu oleh 4 orang");
    const low = buildStationCard(
      station({ queue: { status: "sepi", ...summary({ reportCount: 1, lastReportAt: ago(3), confidence: "low" }) } }),
      NOW,
      URL_,
    );
    expect(low.queue!.detail).toMatch(/kurang pasti/);
  });

  it("no reports: neutral, never a coloured status", () => {
    const c = buildStationCard(station(), NOW, URL_);
    expect(c.queue).toMatchObject({ tone: "neutral", title: "Belum ada laporan" });
  });

  it("red is only used for a confirmed 'habis'; unconfirmed and mixed stay neutral (anti-panic)", () => {
    const st = (status: string, n = 1) => ({ status, ...summary({ reportCount: n, lastReportAt: ago(5) }) });
    const c = buildStationCard(
      station({
        fuels: ["pertalite", "pertamax", "pertamax_turbo", "solar", "dexlite"],
        stock: {
          pertalite: st("available", 3),
          pertamax: st("out", 4),
          pertamax_turbo: st("unconfirmed"),
          solar: st("conflicting", 2),
          dexlite: st("unknown", 0),
        } as StationDTO["stock"],
      }),
      NOW,
      URL_,
    );
    const by = Object.fromEntries(c.rows.map((r) => [r.name, r]));
    expect(by["Pertalite"]).toMatchObject({ tone: "good", status: "Tersedia" });
    expect(by["Pertamax"]).toMatchObject({ tone: "bad", status: "HABIS" });
    expect(by["Pertamax Turbo"]).toMatchObject({ tone: "neutral", status: "Belum terkonfirmasi" });
    expect(by["Solar"]).toMatchObject({ tone: "neutral", status: "Laporan beragam" });
    expect(by["Dexlite"]).toMatchObject({ tone: "neutral", status: "Belum ada laporan" });
  });

  it("an old admin observation shows as such, not as a current status", () => {
    const c = buildStationCard(
      station({ queue: { status: "unknown", ...summary({ reportCount: 1, lastReportAt: ago(5 * 60), fromAdmin: true, stale: true }) } }),
      NOW,
      URL_,
    );
    expect(c.queue!.tone).toBe("neutral");
    expect(c.queue!.detail).toMatch(/terakhir dipantau admin 5 jam lalu/);
  });

  it("open / closed follows the combined answer; unknown leaves it out", () => {
    expect(buildStationCard(station(), NOW, URL_).open).toBeNull();
    expect(buildStationCard(station({ is24h: true, openingHours: "24/7" }), NOW, URL_).open).toMatchObject({ tone: "good", title: "Buka 24 jam" });
    const closed = buildStationCard(
      station({ open: { status: "closed", ...summary({ reportCount: 3, lastReportAt: ago(10) }) } }),
      NOW,
      URL_,
    );
    expect(closed.open).toMatchObject({ tone: "neutral" });
    expect(closed.open!.title).toMatch(/^Tutup menurut laporan warga/);
  });

  it("badges: type and GES", () => {
    expect(buildStationCard(station({ category: "pertashop", isGes: true }), NOW, URL_).badges).toEqual(["Pertashop", "GES"]);
  });

  it("contains nothing that identifies a reporter or a place a person was", () => {
    const json = JSON.stringify(buildStationCard(station(), NOW, URL_));
    for (const bad of ["deviceId", "device_id", "ip_hash", "lat", "lng", "-8.65", "115.2"]) expect(json).not.toContain(bad);
  });
});

describe("app share card", () => {
  it("is a plain invitation: no station data, no status, still the disclaimer", () => {
    const c = buildAppCard("https://spbu-watch.vercel.app");
    expect(c.kind).toBe("app");
    expect(c.queue).toBeNull();
    expect(c.rows).toEqual([]);
    expect(c.stamp).toBeNull();
    expect(c.bullets.length).toBeGreaterThan(1);
    expect(c.disclaimer).toMatch(/indikatif/);
  });
});

describe("helpers", () => {
  it("slugify makes a safe file name part", () => {
    expect(slugify("SPBU Pertamina 54.801.60 (Setia Budi)")).toBe("spbu-pertamina-54-801-60-setia-budi");
    expect(slugify("  ")).toBe("spbu");
    expect(slugify("Pertashop Kéde/Jaya")).toBe("pertashop-kede-jaya");
  });
  it("stampText is in WITA", () => {
    expect(stampText(new Date("2026-10-16T20:05:00Z"))).toBe("Per Sabtu, 17 Oktober 2026, pukul 04.05 WITA");
  });
});
