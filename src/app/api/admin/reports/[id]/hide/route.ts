import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Moderation: hides a report. It stays in the database but no longer counts toward any status. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID laporan tidak valid." }, { status: 400 });
  }
  try {
    const { data, error } = await serviceClient()
      .from("reports")
      .update({ hidden: true })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("POST /api/admin/reports/[id]/hide", err);
    return NextResponse.json({ error: "Gagal menyembunyikan laporan." }, { status: 500 });
  }
}
