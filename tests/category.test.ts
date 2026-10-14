import { describe, expect, it } from "vitest";
import { fuelListComplete, gesInfo, stationCategory } from "@/lib/category";

describe("stationCategory", () => {
  it.each([
    [{ pertaminaCode: "54.801.01", brand: "Pertamina" }, "spbu"],
    [{ pertaminaCode: "51.801.30" }, "spbu"],
    [{ pertaminaCode: "5P.801.07", brand: "Pertashop" }, "pertashop"],
    [{ pertaminaCode: "5P.801.02" }, "pertashop"],
    [{ pertaminaCode: "56.801.01" }, "spbuk"],
    [{ pertaminaCode: null, brand: "Pertashop" }, "pertashop"],
    [{ pertaminaCode: null, brand: "", name: "Pertashop (Timpag)" }, "pertashop"],
    [{ pertaminaCode: null, brand: "", name: "SPBU (Puhu)" }, "spbu"],
    [{ pertaminaCode: "54.801.46", name: "SPBBK 54.801.46 (Sesetan)" }, "spbbk"],
    [{ pertaminaCode: "54.801.01", name: "SPBU Pertamina 54.801.01" }, "spbu"],
    [{ pertaminaCode: "58.803.01", name: "SPBUN Pertamina 58.803.01 (Tanjung Benoa Segara Kulon)" }, "spbun"],
    [{ pertaminaCode: "58.803.01" }, "spbun"],
    [{}, "spbu"],
  ])("%j -> %s", (input, expected) => {
    expect(stationCategory(input)).toBe(expected);
  });
});

describe("gesInfo", () => {
  it("knows GES codes and reports EV facilities", () => {
    expect(gesInfo("54.801.54")).toEqual({ spklu: false, spbklu: false });
    expect(gesInfo("54.803.35")).toEqual({ spklu: false, spbklu: true });
  });
  it("is null for non-GES, empty or missing codes", () => {
    expect(gesInfo("54.801.01")).toBeNull();
    expect(gesInfo("")).toBeNull();
    expect(gesInfo(null)).toBeNull();
    expect(gesInfo(undefined)).toBeNull();
  });
});

describe("fuelListComplete", () => {
  it("is false for missing codes and codes without a verified list", () => {
    expect(fuelListComplete(null)).toBe(false);
    expect(fuelListComplete("")).toBe(false);
    expect(fuelListComplete("00.000.00")).toBe(false);
  });
});
