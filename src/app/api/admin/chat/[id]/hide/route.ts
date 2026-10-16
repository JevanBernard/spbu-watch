import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Moderation: hides a chat message. It stays in the database until the retention job removes it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID pesan tidak valid." }, { status: 400 });
  }
  try {
    const { data, error } = await serviceClient()
      .from("chat_messages")
      .update({ hidden: true })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Pesan tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("POST /api/admin/chat/[id]/hide", err);
    return NextResponse.json({ error: "Gagal menyembunyikan pesan." }, { status: 500 });
  }
}
