import { describe, expect, it } from "vitest";
import { asOfText, priceOf, rupiah } from "@/lib/prices";

describe("prices", () => {
  it("formats rupiah with Indonesian thousands separators", () => {
    expect(rupiah(10000)).toBe("Rp 10.000");
    expect(rupiah(15950)).toBe("Rp 15.950");
  });
  it("formats the as-of date without time zone shifts", () => {
    expect(asOfText("2026-10-14")).toBe("14 Okt 2026");
    expect(asOfText("2026-01-01")).toBe("1 Jan 2026");
  });
  it("has a price for every product in the data", () => {
    for (const f of ["pertalite", "pertamax", "solar"] as const) expect(priceOf(f)).toBeGreaterThan(0);
  });
});
