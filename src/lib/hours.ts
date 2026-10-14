export interface OpenState {
  state: "open" | "closed" | "unknown";
  label: string;
}

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const UNKNOWN: OpenState = { state: "unknown", label: "" };

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (min: number) => `${pad(Math.floor((min % 1440) / 60))}:${pad(min % 60)}`;

function toMin(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

/** Day indexes (0 = Monday) for a spec like "Mo-Fr", "Mo,We" or "PH,Mo-Su". Public holidays are ignored. */
function parseDays(spec: string): number[] | null {
  const out = new Set<number>();
  for (const part of spec.split(",").map((p) => p.trim()).filter(Boolean)) {
    if (part === "PH") continue;
    const [a, b] = part.split("-");
    const i = DAYS.indexOf(a);
    const j = b === undefined ? i : DAYS.indexOf(b);
    if (i < 0 || j < 0) return null;
    for (let d = i; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === j) break;
    }
  }
  return [...out];
}

/**
 * Open or closed right now, in WITA (UTC+8). Understands the common OSM forms (24/7, "Mo-Su 05:00-22:00",
 * "06:00-20:30"). Anything else is reported as unknown rather than guessed.
 */
export function openNow(openingHours: string | null | undefined, is24h: boolean, now: Date = new Date()): OpenState {
  if (is24h) return { state: "open", label: "Buka 24 jam" };
  if (!openingHours) return UNKNOWN;
  const wita = new Date(now.getTime() + 8 * 3_600_000);
  const day = (wita.getUTCDay() + 6) % 7; // 0 = Monday
  const minute = wita.getUTCHours() * 60 + wita.getUTCMinutes();

  let todayRange: [number, number] | null = null;
  let openUntil: number | null = null;
  for (const rule of openingHours.split(";").map((r) => r.trim()).filter(Boolean)) {
    const m = /^(?:(.+?)\s+)?(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(rule);
    if (!m) return UNKNOWN;
    const days = m[1] ? parseDays(m[1]) : [0, 1, 2, 3, 4, 5, 6];
    const start = toMin(m[2]);
    let end = toMin(m[3]);
    if (!days || start === null || end === null) return UNKNOWN;
    if (end === 0) end = 1440; // "05:00-00:00" means until midnight
    const overnight = end <= start;
    const yesterday = (day + 6) % 7;
    if (days.includes(day)) {
      todayRange = [start, end];
      if (!overnight && minute >= start && minute < end) openUntil = end;
      if (overnight && minute >= start) openUntil = end + 1440;
    }
    if (overnight && days.includes(yesterday) && minute < end) openUntil = end;
  }
  if (openUntil !== null) return { state: "open", label: `Buka sampai ${hhmm(openUntil)}` };
  if (todayRange) {
    const [s, e] = todayRange;
    return { state: "closed", label: `Tutup sekarang · jam buka ${hhmm(s)}–${hhmm(e)}` };
  }
  return { state: "closed", label: "Tutup hari ini" };
}
