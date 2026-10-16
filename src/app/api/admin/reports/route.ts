import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ADMIN_DEVICE_ID } from "@/lib/config";
import { adminReportSchema } from "@/lib/reports";
import { serviceClient } from "@/lib/supabase";
import { withOpenColumn } from "@/lib/stations";

export const dynamic = "force-dynamic";

const WINDOW_HOURS = 24;

interface Row {
  id: string;
  kind: "queue" | "stock" | "open";
  queue_level: number | null;
  fuel: string | null;
  stock_status: string | null;
  open_status?: string | null;
  device_id: string;
  hidden: boolean;
  created_at: string;
  stations: { name: string; regency: string } | null;
}

/** Recent reports for moderation. Device IDs are shortened; ip_hash is never returned. */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
    // Without the open_status column (migration 0007 not run yet) the list is loaded without it.
    const { data } = await withOpenColumn(async (columns) => {
      const res = await serviceClient()
        .from("reports")
        .select(`${columns.replace("id,station_id,", "id,")},stations(name,regency)`)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200)
        .returns<Row[]>();
      if (res.error) throw new Error(res.error.message);
      return res;
    });
    return NextResponse.json({
      reports: (data ?? []).map((r) => ({
        id: r.id,
        station: r.stations ? `${r.stations.name} (${r.stations.regency})` : "?",
        kind: r.kind,
        queueLevel: r.queue_level,
        fuel: r.fuel,
        stockStatus: r.stock_status,
        openStatus: r.open_status ?? null,
        device: r.device_id.slice(0, 8),
        hidden: r.hidden,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/reports", err);
    return NextResponse.json({ error: "Gagal memuat laporan." }, { status: 500 });
  }
}

/**
 * Admin report, e.g. from watching CCTV. Skips the geofence and rate limits (the admin token is the check),
 * and is stored under ADMIN_DEVICE_ID so it can be told apart from visitor reports.
 */
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const parsed = adminReportSchema.safeParse(await req.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data laporan tidak valid." }, { status: 400 });
  }
  const r = parsed.data;
  try {
    const { data, error } = await serviceClient().from("reports").insert({
      station_id: r.stationId,
      kind: r.kind,
      queue_level: r.kind === "queue" ? (r.queueLevel ?? null) : null,
      fuel: r.kind === "stock" ? (r.fuel ?? null) : null,
      stock_status: r.kind === "stock" ? (r.stockStatus ?? null) : null,
      ...(r.kind === "open" ? { open_status: r.openStatus } : {}),
      device_id: ADMIN_DEVICE_ID,
      ip_hash: "admin",
    }).select("id").single();
    if (error) {
      // 23503 = foreign key violation: the station does not exist.
      if (error.code === "23503") return NextResponse.json({ error: "SPBU tidak ditemukan." }, { status: 404 });
      throw new Error(error.message);
    }
    // The id lets the admin UI undo the report (hide) right after sending it.
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/reports", err);
    return NextResponse.json({ error: "Gagal menyimpan laporan." }, { status: 500 });
  }
}
