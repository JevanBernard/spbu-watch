import { describe, expect, it } from "vitest";
import { distanceM, formatDistance, reportedText, timeAgo } from "@/lib/format";

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
