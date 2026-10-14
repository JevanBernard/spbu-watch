import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Visitor counter. If the table is missing or the call fails, return nulls so the UI hides the counter. */
export async function GET() {
  const headers = { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" };
  try {
    const { data, error } = await serviceClient().rpc("visit_stats");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json(
      { today: Number(row?.today ?? 0), online: Number(row?.online ?? 0) },
      { headers },
    );
  } catch {
    return NextResponse.json({ today: null, online: null }, { headers });
  }
}
