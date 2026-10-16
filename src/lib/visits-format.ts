export function countText(n: number): string {
  return n.toLocaleString("id-ID");
}

const sinceFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "10 Oktober 2026" from a "2026-10-10" day string (a plain date: no time zone shift). */
export function sinceText(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : sinceFmt.format(d);
}
