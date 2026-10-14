import { describe, expect, it } from "vitest";
import { computeQueueStatus, computeStockStatus, weight, type Report } from "@/lib/status";

const NOW = new Date("2026-10-14T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);

const q = (deviceId: string, level: number, minAgo: number, hidden = false): Report => ({
  deviceId,
  queueLevel: level,
  createdAt: ago(minAgo),
  hidden,
});
const s = (
  deviceId: string,
  stockStatus: "available" | "out",
  minAgo: number,
  fuel: Report["fuel"] = "pertalite",
): Report => ({ deviceId, fuel, stockStatus, createdAt: ago(minAgo) });

describe("weight", () => {
  it("halves every 20 minutes", () => {
    expect(weight(0)).toBe(1);
    expect(weight(20)).toBeCloseTo(0.5);
    expect(weight(40)).toBeCloseTo(0.25);
  });
});

describe("computeQueueStatus", () => {
  it("is unknown without reports", () => {
    expect(computeQueueStatus([], NOW)).toEqual({
      status: "unknown",
      reportCount: 0,
      lastReportAt: null,
      confidence: "none",
    });
  });

  const cases: [string, Report[], string][] = [
    ["single level 0", [q("a", 0, 1)], "sepi"],
    ["single level 1", [q("a", 1, 1)], "sedang"],
    ["single level 2", [q("a", 2, 1)], "panjang"],
    ["mean 0.5 is sedang (boundary)", [q("a", 0, 5), q("b", 1, 5)], "sedang"],
    ["mean 1.5 is panjang (boundary)", [q("a", 1, 5), q("b", 2, 5)], "panjang"],
    ["fresh report outweighs an old one", [q("a", 0, 40), q("b", 2, 0)], "panjang"],
    ["fresh report outweighs an old one, other way", [q("a", 2, 40), q("b", 0, 0)], "sepi"],
  ];
  it.each(cases)("%s", (_name, reports, expected) => {
    expect(computeQueueStatus(reports, NOW).status).toBe(expected);
  });

  it("keeps 44 minutes and expires at exactly the TTL", () => {
    expect(computeQueueStatus([q("a", 2, 44)], NOW).status).toBe("panjang");
    expect(computeQueueStatus([q("a", 2, 45)], NOW).status).toBe("unknown");
    expect(computeQueueStatus([q("a", 2, 46)], NOW).status).toBe("unknown");
  });

  it("ignores hidden reports", () => {
    expect(computeQueueStatus([q("a", 2, 1, true)], NOW).status).toBe("unknown");
  });

  it("keeps only the latest report per device", () => {
    const res = computeQueueStatus([q("a", 2, 30), q("a", 0, 2)], NOW);
    expect(res.status).toBe("sepi");
    expect(res.reportCount).toBe(1);
  });

  it("a hidden newer report does not shadow an older visible one", () => {
    const res = computeQueueStatus([q("a", 2, 10), q("a", 0, 1, true)], NOW);
    expect(res.status).toBe("panjang");
  });

  it("returns count, lastReportAt and confidence", () => {
    const one = computeQueueStatus([q("a", 1, 12)], NOW);
    expect(one.confidence).toBe("low");
    expect(one.lastReportAt).toBe(ago(12).toISOString());
    const three = computeQueueStatus([q("a", 1, 12), q("b", 1, 30), q("c", 1, 3)], NOW);
    expect(three.reportCount).toBe(3);
    expect(three.confidence).toBe("normal");
    expect(three.lastReportAt).toBe(ago(3).toISOString());
  });

  it("treats future timestamps as brand new", () => {
    expect(computeQueueStatus([q("a", 2, -5)], NOW).status).toBe("panjang");
  });
});

describe("computeStockStatus", () => {
  it("is unknown without reports for that fuel", () => {
    expect(computeStockStatus([s("a", "out", 1, "pertamax")], "pertalite", NOW).status).toBe(
      "unknown",
    );
  });

  it("keeps 59 minutes and expires at 60", () => {
    expect(computeStockStatus([s("a", "available", 59)], "pertalite", NOW).status).toBe(
      "available",
    );
    expect(computeStockStatus([s("a", "available", 60)], "pertalite", NOW).status).toBe("unknown");
  });

  it("one or two 'out' devices stay unconfirmed", () => {
    expect(computeStockStatus([s("a", "out", 1)], "pertalite", NOW).status).toBe("unconfirmed");
    expect(computeStockStatus([s("a", "out", 1), s("b", "out", 2)], "pertalite", NOW).status).toBe(
      "unconfirmed",
    );
  });

  it("three distinct 'out' devices confirm out", () => {
    const reports = [s("a", "out", 1), s("b", "out", 2), s("c", "out", 3)];
    expect(computeStockStatus(reports, "pertalite", NOW).status).toBe("out");
  });

  it("one device reporting out three times is still one device", () => {
    const reports = [s("a", "out", 1), s("a", "out", 2), s("a", "out", 3)];
    const res = computeStockStatus(reports, "pertalite", NOW);
    expect(res.status).toBe("unconfirmed");
    expect(res.reportCount).toBe(1);
  });

  it("three 'out' devices lose against a dominant 'available'", () => {
    const reports = [
      s("a", "out", 30),
      s("b", "out", 30),
      s("c", "out", 30),
      s("d", "available", 0),
      s("e", "available", 0),
    ];
    expect(computeStockStatus(reports, "pertalite", NOW).status).toBe("available");
  });

  it("an even split is conflicting", () => {
    const split = [s("a", "out", 5), s("b", "available", 5)];
    expect(computeStockStatus(split, "pertalite", NOW).status).toBe("conflicting");
  });

  it("dominance boundary: out share exactly 0.6 with 3 devices is out", () => {
    const reports = [
      s("a", "out", 5),
      s("b", "out", 5),
      s("c", "out", 5),
      s("d", "available", 5),
      s("e", "available", 5),
    ];
    expect(computeStockStatus(reports, "pertalite", NOW).status).toBe("out");
  });

  it("dominance boundary: available share exactly 0.6 is available", () => {
    const reports = [
      s("a", "available", 5),
      s("b", "available", 5),
      s("c", "available", 5),
      s("d", "out", 5),
      s("e", "out", 5),
    ];
    expect(computeStockStatus(reports, "pertalite", NOW).status).toBe("available");
  });

  it("newer reports outweigh older ones (decay)", () => {
    const reports = [
      s("a", "out", 55),
      s("b", "out", 55),
      s("c", "out", 55),
      s("d", "available", 0),
    ];
    // out weight 3 * 2^-2.75 ~ 0.45 vs available 1 -> available share ~ 0.69
    expect(computeStockStatus(reports, "pertalite", NOW).status).toBe("available");
  });

  it("a device's latest report wins", () => {
    const reports = [s("a", "out", 20), s("a", "available", 1)];
    expect(computeStockStatus(reports, "pertalite", NOW).status).toBe("available");
  });

  it("ignores hidden reports", () => {
    const hidden: Report = { ...s("a", "available", 1), hidden: true };
    expect(computeStockStatus([hidden], "pertalite", NOW).status).toBe("unknown");
  });
});
