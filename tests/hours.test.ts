import { describe, expect, it } from "vitest";
import { effectiveOpen, matchesOpenFilter, openNow } from "@/lib/hours";

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

describe("matchesOpenFilter (buka sekarang / tutup)", () => {
  const day = { openingHours: "Mo-Su 06:00-20:00", is24h: false };
  const always = { openingHours: "24/7", is24h: true };
  const unknown = { openingHours: null, is24h: false };
  const odd = { openingHours: "by appointment", is24h: false }; // present but not understood

  it("no filter matches everything", () => {
    for (const s of [day, always, unknown, odd]) expect(matchesOpenFilter(s, "", at("03:00"))).toBe(true);
  });
  it("'open' keeps stations that are open now, 24-hour ones always", () => {
    expect(matchesOpenFilter(day, "open", at("12:00"))).toBe(true);
    expect(matchesOpenFilter(day, "open", at("21:00"))).toBe(false);
    expect(matchesOpenFilter(always, "open", at("03:00"))).toBe(true);
  });
  it("'closed' keeps stations that are closed now, never a 24-hour one", () => {
    expect(matchesOpenFilter(day, "closed", at("21:00"))).toBe(true);
    expect(matchesOpenFilter(day, "closed", at("12:00"))).toBe(false);
    expect(matchesOpenFilter(always, "closed", at("03:00"))).toBe(false);
  });
  it("unknown or unreadable hours match neither: the filter never claims more than the data knows", () => {
    for (const s of [unknown, odd]) {
      expect(matchesOpenFilter(s, "open", at("12:00"))).toBe(false);
      expect(matchesOpenFilter(s, "closed", at("12:00"))).toBe(false);
    }
  });
});

describe("effectiveOpen: opening hours combined with reports", () => {
  const hours = { openingHours: "Mo-Su 06:00-20:00", is24h: false };
  const none = { openingHours: null, is24h: false };
  const rep = (status: "open" | "closed" | "unconfirmed" | "conflicting" | "unknown", fromAdmin = false) => ({
    status,
    fromAdmin,
    lastReportAt: at("11:50").toISOString(),
  });
  const now = at("12:00");

  it("without reports it is just the opening hours", () => {
    expect(effectiveOpen(hours, now)).toMatchObject({ state: "open", reported: false });
    expect(effectiveOpen(none, now)).toMatchObject({ state: "unknown", reported: false });
  });
  it("a confirmed 'tutup' wins over hours that say open, and over a 24-hour station", () => {
    const e = effectiveOpen({ ...hours, open: rep("closed") }, now);
    expect(e).toMatchObject({ state: "closed", reported: true });
    expect(e.label).toMatch(/Tutup menurut laporan warga \(10 menit lalu\)/);
    expect(effectiveOpen({ openingHours: "24/7", is24h: true, open: rep("closed", true) }, now).label).toMatch(/pantauan admin/);
  });
  it("a confirmed 'buka' fills in when hours say closed or are unknown, but changes nothing when already open", () => {
    expect(effectiveOpen({ ...hours, open: rep("open") }, at("21:00"))).toMatchObject({ state: "open", reported: true });
    expect(effectiveOpen({ ...none, open: rep("open") }, now)).toMatchObject({ state: "open", reported: true });
    expect(effectiveOpen({ ...hours, open: rep("open") }, now)).toMatchObject({ state: "open", reported: false });
  });
  it("unconfirmed, mixed or missing reports change nothing", () => {
    for (const status of ["unconfirmed", "conflicting", "unknown"] as const) {
      expect(effectiveOpen({ ...hours, open: rep(status) }, now)).toMatchObject({ state: "open", reported: false });
      expect(effectiveOpen({ ...none, open: rep(status) }, now)).toMatchObject({ state: "unknown", reported: false });
    }
  });
  it("the open / closed filter follows the combined answer", () => {
    expect(matchesOpenFilter({ ...hours, open: rep("closed") }, "closed", now)).toBe(true);
    expect(matchesOpenFilter({ ...hours, open: rep("closed") }, "open", now)).toBe(false);
    expect(matchesOpenFilter({ ...none, open: rep("open") }, "open", now)).toBe(true);
  });
});
