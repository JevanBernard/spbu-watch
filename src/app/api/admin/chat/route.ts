import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const WINDOW_HOURS = 24;

interface Row {
  id: string;
  nickname: string;
  body: string;
  hidden: boolean;
  created_at: string;
  stations: { name: string; regency: string } | null;
}

/** Recent chat messages for moderation. Device ids and IP hashes are never returned. */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
    const { data, error } = await serviceClient()
      .from("chat_messages")
      .select("id,nickname,body,hidden,created_at,stations(name,regency)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<Row[]>();
    if (error) throw new Error(error.message);
    return NextResponse.json({
      messages: (data ?? []).map((m) => ({
        id: m.id,
        station: m.stations ? `${m.stations.name} (${m.stations.regency})` : "?",
        nickname: m.nickname,
        body: m.body,
        hidden: m.hidden,
        createdAt: m.created_at,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/chat", err);
    return NextResponse.json({ error: "Gagal memuat obrolan." }, { status: 500 });
  }
}
