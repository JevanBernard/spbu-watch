import { countText } from "./visits-format";

/** Public counters from /api/stats. Every part is null when it could not be read. */
export interface SiteStats {
  today: number | null;
  online: number | null;
  /** Visitor-days since counting began, and the first day counted (null until migration 0008 has been run). */
  total: number | null;
  since: string | null;
  reports24h: { total: number; queue: number; stock: number; open: number } | null;
}

export const EMPTY_STATS: SiteStats = { today: null, online: null, total: null, since: null, reports24h: null };

export function hasAnyStats(s: SiteStats): boolean {
  return s.online !== null || s.today !== null || s.total !== null || s.reports24h !== null;
}

/** The same numbers as one sentence, for screen readers. */
export function statsSentence(s: SiteStats): string {
  const parts: string[] = [];
  if (s.online !== null) parts.push(`${countText(s.online)} pengunjung online`);
  if (s.today !== null) parts.push(`${countText(s.today)} pengunjung hari ini`);
  if (s.total !== null) parts.push(`${countText(s.total)} total pengunjung`);
  if (s.reports24h) parts.push(`${countText(s.reports24h.total)} laporan dalam 24 jam terakhir`);
  return parts.join(", ");
}
