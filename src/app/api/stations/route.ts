import { NextResponse } from "next/server";
import { anonClient, serviceClient } from "@/lib/supabase";
import { loadStationsWithStatus } from "@/lib/stations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stations = await loadStationsWithStatus(serviceClient(), anonClient());
    return NextResponse.json(
      { stations, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    console.error("GET /api/stations", err);
    return NextResponse.json({ error: "Gagal memuat data SPBU." }, { status: 500 });
  }
}
