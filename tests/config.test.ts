import { describe, expect, it } from "vitest";
import * as config from "@/lib/config";

describe("config", () => {
  it("matches the values in SPEC section 7", () => {
    expect(config.QUEUE_TTL_MIN).toBe(45);
    expect(config.STOCK_TTL_MIN).toBe(60);
    expect(config.HALF_LIFE_MIN).toBe(20);
    expect(config.MIN_DEVICES_FOR_OUT).toBe(3);
    expect(config.DOMINANCE).toBe(0.6);
    expect(config.GEOFENCE_M).toBe(300);
  });
});
