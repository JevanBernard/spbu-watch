import { describe, expect, it } from "vitest";
import type { StationDTO } from "@/lib/api-types";
import { matchesFuelFilter, soldFuelsText } from "@/lib/format";
import type { Fuel } from "@/lib/status";

const st = (fuels: Fuel[], fuelsComplete: boolean) => ({ fuels, fuelsComplete }) as StationDTO;

describe("matchesFuelFilter (static fact, never live stock)", () => {
  it("no filter shows everything", () => {
    expect(matchesFuelFilter(st([], false), "")).toBe(true);
  });
  it("shows stations known to sell the fuel", () => {
    expect(matchesFuelFilter(st(["pertamax", "solar"], true), "pertamax")).toBe(true);
  });
  it("keeps stations whose fuel list is unknown or partial (no hiding on missing data)", () => {
    expect(matchesFuelFilter(st([], false), "pertamax")).toBe(true);
    expect(matchesFuelFilter(st(["solar"], false), "pertamax")).toBe(true);
  });
  it("hides only stations whose verified complete list lacks the fuel", () => {
    expect(matchesFuelFilter(st(["pertalite", "solar"], true), "pertamax")).toBe(false);
  });
});

describe("soldFuelsText", () => {
  it("lists known fuels in a fixed order and returns null when unknown", () => {
    expect(soldFuelsText({ fuels: ["solar", "pertalite"] })).toBe("Pertalite, Solar");
    expect(soldFuelsText({ fuels: [] })).toBeNull();
  });
});
