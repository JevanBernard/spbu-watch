import { NextResponse } from "next/server";
import { anonClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await anonClient()
      .from("official_updates")
      .select("id,title,body,source_name,source_url,published_at,pinned")
      .eq("active", true)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    const updates = (data ?? []).map((u) => ({
      id: u.id,
      title: u.title,
      body: u.body,
      sourceName: u.source_name,
      sourceUrl: u.source_url,
      publishedAt: u.published_at,
      pinned: u.pinned,
    }));
    return NextResponse.json(
      { updates },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    console.error("GET /api/official", err);
    return NextResponse.json({ error: "Gagal memuat informasi resmi." }, { status: 500 });
  }
}
