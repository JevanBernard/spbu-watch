import { NextResponse } from "next/server";
import { z } from "zod";
import { anonClient, serviceClient } from "@/lib/supabase";
import { anonymizeReports } from "@/lib/anonymize";
import { fuelsReportedSold } from "@/lib/fuels-sold";
import { buildTimeline, TIMELINE_HOURS } from "@/lib/timeline";
import {
  computeStationStatus,
  loadAdminReports,
  loadSoldReports,
  mergeReports,
  publicStation,
  REPORT_COLUMNS,
  STATION_COLUMNS,
  toReport,
  type ReportRow,
  type StationRow,
} from "@/lib/stations";

export const dynamic = "force-dynamic";

const DETAIL_WINDOW_MIN = 120;
// The history chart needs a full day plus the longest status TTL before it.
const HISTORY_WINDOW_MIN = TIMELINE_HOURS * 60 + 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID SPBU tidak valid." }, { status: 400 });
  }
  try {
    const now = new Date();
    const { data: station, error } = await anonClient()
      .from("stations")
      .select(STATION_COLUMNS)
      .eq("id", id)
      .eq("active", true)
      .maybeSingle<StationRow>();
    if (error) throw new Error(error.message);
    if (!station) return NextResponse.json({ error: "SPBU tidak ditemukan." }, { status: 404 });

    const since = new Date(now.getTime() - HISTORY_WINDOW_MIN * 60_000).toISOString();
    const { data: rows, error: repErr } = await serviceClient()
      .from("reports")
      .select(REPORT_COLUMNS)
      .eq("station_id", id)
      .eq("hidden", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(3000)
      .returns<ReportRow[]>();
    if (repErr) throw new Error(repErr.message);
    const history = rows ?? [];
    const recentSince = now.getTime() - DETAIL_WINDOW_MIN * 60_000;
    const reports = history.filter((r) => new Date(r.created_at).getTime() >= recentSince);
    const admin = await loadAdminReports(serviceClient(), now, id);
    const sold = await loadSoldReports(serviceClient(), now, id);
    const pub = publicStation(station, fuelsReportedSold(sold.get(id) ?? [], now));

    return NextResponse.json(
      {
        station: {
          ...pub,
          ...computeStationStatus(
            { fuels: pub.fuels },
            mergeReports(reports, admin).map(toReport),
            now,
          ),
        },
        // Hourly history for the chart. Computed here because it needs device ids, which never leave the server.
        timeline: buildTimeline(mergeReports(history, admin).map(toReport), now),
        // Anonymized: no device_id, ip_hash or report id.
        recentReports: anonymizeReports(reports),
        generatedAt: now.toISOString(),
      },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    console.error("GET /api/stations/[id]", err);
    return NextResponse.json({ error: "Gagal memuat data SPBU." }, { status: 500 });
  }
}
