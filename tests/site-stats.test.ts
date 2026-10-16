import { describe, expect, it } from "vitest";
import { EMPTY_STATS, hasAnyStats, statsSentence, type SiteStats } from "@/lib/site-stats";

const full: SiteStats = {
  today: 1316,
  online: 24,
  total: 48210,
  since: "2026-10-10",
  reports24h: { total: 37, queue: 20, stock: 14, open: 3 },
};

describe("site stats helpers", () => {
  it("knows when there is nothing to show", () => {
    expect(hasAnyStats(EMPTY_STATS)).toBe(false);
    expect(hasAnyStats({ ...EMPTY_STATS, online: 0 })).toBe(true); // zero is a number worth showing
    expect(hasAnyStats({ ...EMPTY_STATS, reports24h: { total: 0, queue: 0, stock: 0, open: 0 } })).toBe(true);
  });

  it("reads all parts as one sentence, with Indonesian thousands separators", () => {
    expect(statsSentence(full)).toBe(
      "24 pengunjung online, 1.316 pengunjung hari ini, 48.210 total pengunjung, 37 laporan dalam 24 jam terakhir",
    );
  });

  it("leaves out the parts that could not be read", () => {
    expect(statsSentence({ ...full, total: null, reports24h: null })).toBe("24 pengunjung online, 1.316 pengunjung hari ini");
    expect(statsSentence(EMPTY_STATS)).toBe("");
  });
});
