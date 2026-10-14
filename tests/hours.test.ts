import { describe, expect, it } from "vitest";
import { openNow } from "@/lib/hours";

// WITA = UTC+8. 2026-10-14 is a Wednesday.
const at = (hhmm: string, date = "2026-10-14") => new Date(`${date}T${hhmm}:00+08:00`);

describe("openNow", () => {
  it("24 hours is always open", () => {
    expect(openNow("24/7", true, at("03:00"))).toEqual({ state: "open", label: "Buka 24 jam" });
  });
  it.each([
    ["Mo-Su 05:00-22:00", "04:59", "closed"],
    ["Mo-Su 05:00-22:00", "05:00", "open"],
    ["Mo-Su 05:00-22:00", "21:59", "open"],
    ["Mo-Su 05:00-22:00", "22:00", "closed"],
    ["06:00-20:30", "12:00", "open"],
    ["Mo-Su 05:00-00:00", "23:30", "open"],
    ["Mo-Su,PH 06:00-22:00", "10:00", "open"],
    ["PH,Mo-Su 06:00-23:00", "23:30", "closed"],
    ["Mo-Fr 08:00-17:00", "10:00", "open"],
    ["Sa-Su 08:00-17:00", "10:00", "closed"],
    ["Mo-Su 22:00-06:00", "23:00", "open"],
    ["Mo-Su 22:00-06:00", "03:00", "open"],
    ["Mo-Su 22:00-06:00", "12:00", "closed"],
  ])("%s at %s -> %s", (hours, time, state) => {
    expect(openNow(hours, false, at(time)).state).toBe(state);
  });
  it("is unknown for missing or unsupported formats instead of guessing", () => {
    expect(openNow(null, false, at("10:00")).state).toBe("unknown");
    expect(openNow("", false, at("10:00")).state).toBe("unknown");
    expect(openNow("sunrise-sunset", false, at("10:00")).state).toBe("unknown");
    expect(openNow("Mo-Fr 08:00-12:00,14:00-18:00", false, at("10:00")).state).toBe("unknown");
  });
  it("says when it opens and when it closes", () => {
    expect(openNow("Mo-Su 05:00-22:00", false, at("04:00")).label).toBe("Tutup sekarang · jam buka 05:00–22:00");
    expect(openNow("Mo-Su 05:00-22:00", false, at("10:00")).label).toBe("Buka sampai 22:00");
    expect(openNow("Mo-Su 05:00-00:00", false, at("10:00")).label).toBe("Buka sampai 00:00");
  });
});
