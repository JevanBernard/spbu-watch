import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const WINDOW_HOURS = 24;

interface Row {
  id: string;
  kind: "queue" | "stock";
  queue_level: number | null;
  fuel: string | null;
  stock_status: string | null;
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
    const { data, error } = await serviceClient()
      .from("reports")
      .select("id,kind,queue_level,fuel,stock_status,device_id,hidden,created_at,stations(name,regency)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<Row[]>();
    if (error) throw new Error(error.message);
    return NextResponse.json({
      reports: (data ?? []).map((r) => ({
        id: r.id,
        station: r.stations ? `${r.stations.name} (${r.stations.regency})` : "?",
        kind: r.kind,
        queueLevel: r.queue_level,
        fuel: r.fuel,
        stockStatus: r.stock_status,
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
