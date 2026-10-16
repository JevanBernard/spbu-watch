import { describe, expect, it } from "vitest";
import { distanceM, formatDistance, reportedText, timeAgo, travelMinutes, updatedText } from "@/lib/format";

const NOW = new Date("2026-10-14T12:00:00Z");
const ago = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe("format", () => {
  it("timeAgo", () => {
    expect(timeAgo(ago(0), NOW)).toBe("baru saja");
    expect(timeAgo(ago(12), NOW)).toBe("12 menit lalu");
    expect(timeAgo(ago(75), NOW)).toBe("1 jam lalu");
  });
  it("reportedText", () => {
    expect(reportedText({ reportCount: 3, lastReportAt: ago(12) }, NOW)).toBe(
      "dilaporkan 12 menit lalu oleh 3 orang",
    );
    expect(reportedText({ reportCount: 0, lastReportAt: null })).toBe("Belum ada laporan terbaru");
  });
  it("distance", () => {
    const a = { lat: -8.65, lng: 115.2166 };
    expect(distanceM(a, a)).toBe(0);
    expect(distanceM(a, { lat: -8.64, lng: 115.2166 })).toBeGreaterThan(1000);
    expect(formatDistance(420)).toBe("420 m");
    expect(formatDistance(1530)).toBe("1.5 km");
  });
});

describe("reportedText (admin)", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const iso = new Date(now.getTime() - 5 * 60_000).toISOString();
  it("names the admin when the newest report is theirs", () => {
    expect(reportedText({ reportCount: 1, lastReportAt: iso, fromAdmin: true }, now)).toBe("dipantau admin (CCTV) 5 menit lalu");
    expect(reportedText({ reportCount: 3, lastReportAt: iso, fromAdmin: true }, now)).toBe(
      "dipantau admin (CCTV) 5 menit lalu, ditambah 2 pengguna",
    );
  });
  it("keeps the visitor wording otherwise", () => {
    expect(reportedText({ reportCount: 2, lastReportAt: iso, fromAdmin: false }, now)).toBe("dilaporkan 5 menit lalu oleh 2 orang");
  });
});

describe("reportedText (stale admin)", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  it("says when the admin last watched", () => {
    const iso = new Date(now.getTime() - 3 * 3_600_000).toISOString();
    expect(reportedText({ reportCount: 1, lastReportAt: iso, fromAdmin: true, stale: true }, now)).toBe("terakhir dipantau admin 3 jam lalu");
  });
  it("counts days after two days", () => {
    expect(timeAgo(new Date(now.getTime() - 3 * 86_400_000).toISOString(), now)).toBe("3 hari lalu");
  });
});

describe("travel time estimate", () => {
  it("is a rough motorbike estimate: straight line x 1.3 at 25 km/h, at least 1 minute", () => {
    expect(travelMinutes(0)).toBe(1);
    expect(travelMinutes(100)).toBe(1);
    expect(travelMinutes(650)).toBe(2);
    expect(travelMinutes(5000)).toBe(16);
  });
  it("updatedText", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(updatedText(new Date(now.getTime() - 8 * 60_000).toISOString(), now)).toBe("Update 8 menit lalu");
    expect(updatedText(null)).toBe("Belum ada laporan");
  });
});
