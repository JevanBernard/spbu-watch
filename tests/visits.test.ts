import { describe, expect, it } from "vitest";
import { visitorHash, witaDay } from "@/lib/visits";
import { countText } from "@/lib/visits-format";

describe("witaDay", () => {
  it("uses UTC+8, so the day changes at 16:00 UTC", () => {
    expect(witaDay(new Date("2026-10-14T15:59:00Z"))).toBe("2026-10-14");
    expect(witaDay(new Date("2026-10-14T16:00:00Z"))).toBe("2026-10-15");
  });
});

describe("visitorHash", () => {
  const base = visitorHash("1.2.3.4", "device-aaaa-1", "salt", "2026-10-14");
  it("is stable and hides its inputs", () => {
    expect(visitorHash("1.2.3.4", "device-aaaa-1", "salt", "2026-10-14")).toBe(base);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(base).not.toContain("1.2.3.4");
    expect(base).not.toContain("device-aaaa-1");
  });
  it("differs per day, ip, device and salt, so visits cannot be linked across days", () => {
    expect(visitorHash("1.2.3.4", "device-aaaa-1", "salt", "2026-10-15")).not.toBe(base);
    expect(visitorHash("1.2.3.5", "device-aaaa-1", "salt", "2026-10-14")).not.toBe(base);
    expect(visitorHash("1.2.3.4", "device-bbbb-2", "salt", "2026-10-14")).not.toBe(base);
    expect(visitorHash("1.2.3.4", "device-aaaa-1", "other", "2026-10-14")).not.toBe(base);
  });
});

describe("countText", () => {
  it("formats with Indonesian separators", () => {
    expect(countText(1316)).toBe("1.316");
    expect(countText(0)).toBe("0");
  });
});
