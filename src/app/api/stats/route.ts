import { NextResponse } from "next/server";
import { countReports24h, type ReportCounts } from "@/lib/report-stats";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Public counters: visitors (online now, today, all-time) and reports of the last 24 hours. Each part is read on its own, so
 * a part that cannot be read (for example the visits table is missing) is null and the rest still shows.
 */
export async function GET() {
  const headers = { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" };
  const db = serviceClient();

  const visitors = async (): Promise<{ today: number; online: number } | null> => {
    try {
      const { data, error } = await db.rpc("visit_stats");
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return { today: Number(row?.today ?? 0), online: Number(row?.online ?? 0) };
    } catch {
      return null;
    }
  };
  // All-time visitor-days since counting began (migration 0008). Null until that migration has been run.
  const totals = async (): Promise<{ total: number; since: string | null } | null> => {
    try {
      const { data, error } = await db.rpc("visit_totals");
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return { total: Number(row?.total ?? 0), since: row?.since ? String(row.since) : null };
    } catch {
      return null;
    }
  };
  const reports = async (): Promise<ReportCounts | null> => {
    try {
      return await countReports24h(db);
    } catch {
      return null;
    }
  };

  const [v, r, t] = await Promise.all([visitors(), reports(), totals()]);
  return NextResponse.json(
    {
      today: v?.today ?? null,
      online: v?.online ?? null,
      total: t?.total ?? null,
      since: t?.since ?? null,
      reports24h: r,
    },
    { headers },
  );
}
