import { describe, expect, it } from "vitest";
import { fuelsReportedSold, type AvailableReport } from "@/lib/fuels-sold";
import { mergeFuels } from "@/lib/stations";

const NOW = new Date("2026-10-14T12:00:00Z");
const day = 86_400_000;
const r = (deviceId: string, fuel: AvailableReport["fuel"], daysAgo = 1): AvailableReport => ({
  deviceId,
  fuel,
  createdAt: new Date(NOW.getTime() - daysAgo * day),
});

describe("fuelsReportedSold", () => {
  it("needs two distinct devices", () => {
    expect(fuelsReportedSold([r("a", "pertamax")], NOW)).toEqual([]);
    expect(fuelsReportedSold([r("a", "pertamax"), r("a", "pertamax", 2)], NOW)).toEqual([]);
    expect(fuelsReportedSold([r("a", "pertamax"), r("b", "pertamax")], NOW)).toEqual(["pertamax"]);
  });
  it("counts each fuel separately", () => {
    const got = fuelsReportedSold([r("a", "pertamax"), r("b", "pertamax"), r("a", "solar"), r("c", "pertalite")], NOW);
    expect(got).toEqual(["pertamax"]);
  });
  it("ignores reports older than 30 days", () => {
    expect(fuelsReportedSold([r("a", "solar", 31), r("b", "solar", 40)], NOW)).toEqual([]);
    expect(fuelsReportedSold([r("a", "solar", 29), r("b", "solar", 1)], NOW)).toEqual(["solar"]);
  });
});

describe("mergeFuels", () => {
  it("adds user fuels without duplicating and keeps a fixed order", () => {
    expect(mergeFuels(["solar"], ["pertamax", "solar"])).toEqual({
      fuels: ["pertamax", "solar"],
      fuelsFromUsers: ["pertamax"],
    });
  });
  it("is empty when nothing is known", () => {
    expect(mergeFuels([], [])).toEqual({ fuels: [], fuelsFromUsers: [] });
  });
});
