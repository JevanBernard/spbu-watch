import type { SupabaseClient } from "@supabase/supabase-js";

export const STATS_WINDOW_HOURS = 24;

export interface ReportCounts {
  total: number;
  queue: number;
  stock: number;
  open: number;
}

/**
 * How many reports came in during the last 24 hours, by kind. Counts visitor and admin reports, skips hidden
 * ones. `total` is the sum of the kinds, so the numbers always add up. Only counts are read, never report rows.
 */
export async function countReports24h(db: SupabaseClient, now: Date = new Date()): Promise<ReportCounts> {
  const since = new Date(now.getTime() - STATS_WINDOW_HOURS * 3_600_000).toISOString();
  const one = async (kind: "queue" | "stock" | "open") => {
    const { count, error } = await db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("hidden", false)
      .eq("kind", kind)
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const [queue, stock, open] = await Promise.all([one("queue"), one("stock"), one("open")]);
  return { total: queue + stock + open, queue, stock, open };
}
