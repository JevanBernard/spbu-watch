import { describe, expect, it } from "vitest";
import { ADMIN_DEVICE_ID } from "@/lib/config";
import type { Report } from "@/lib/status";
import { buildTimeline } from "@/lib/timeline";

const NOW = new Date("2026-10-14T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const queue = (device: string, min: number, level: number): Report => ({ deviceId: device, createdAt: ago(min), queueLevel: level });
const stock = (device: string, min: number, status: "available" | "out"): Report => ({
  deviceId: device,
  createdAt: ago(min),
  fuel: "pertalite",
  stockStatus: status,
});

describe("buildTimeline", () => {
  it("returns 24 hourly slots, oldest first, the last one ending now", () => {
    const t = buildTimeline([], NOW);
    expect(t.slots).toHaveLength(24);
    expect(t.slots[23].at).toBe(NOW.toISOString());
    expect(t.slots[0].at).toBe(new Date(NOW.getTime() - 23 * 3_600_000).toISOString());
    expect(t.reportCount).toBe(0);
    expect(t.slots.every((s) => s.queue === "unknown")).toBe(true);
  });

  it("puts a report in its own hour and not in the hours before it was made", () => {
    const t = buildTimeline([queue("a", 5, 2)], NOW);
    expect(t.slots[23].queue).toBe("panjang");
    expect(t.slots[22].queue).toBe("unknown"); // report did not exist yet
    expect(t.reportCount).toBe(1);
  });

  it("keeps the 3-device rule for red 'habis' in the history too", () => {
    const one = buildTimeline([stock("a", 10, "out")], NOW);
    expect(one.slots[23].stock.pertalite).toBe("unconfirmed");
    const three = buildTimeline([stock("a", 10, "out"), stock("b", 9, "out"), stock("c", 8, "out")], NOW);
    expect(three.slots[23].stock.pertalite).toBe("out");
  });

  it("ignores hidden reports", () => {
    const t = buildTimeline([{ ...queue("a", 5, 2), hidden: true }], NOW);
    expect(t.slots[23].queue).toBe("unknown");
    expect(t.reportCount).toBe(0);
  });

  it("does not stretch an old admin report over the whole day", () => {
    const old: Report = { deviceId: ADMIN_DEVICE_ID, createdAt: ago(20 * 60), queueLevel: 2 };
    const t = buildTimeline([old], NOW);
    expect(t.slots[3].queue).toBe("panjang"); // right after it was made
    expect(t.slots[23].queue).toBe("unknown"); // 20 hours later it is only kept as "old", not shown as current
  });

  it("only lists fuels that have reports", () => {
    const t = buildTimeline([stock("a", 5, "available")], NOW);
    expect(Object.keys(t.slots[23].stock)).toEqual(["pertalite"]);
    expect(t.slots[23].stock.pertalite).toBe("available");
  });
});
