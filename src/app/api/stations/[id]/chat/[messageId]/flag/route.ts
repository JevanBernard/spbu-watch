import { NextResponse } from "next/server";
import { z } from "zod";
import { processChatFlag } from "@/lib/chat";
import { createFlagDeps } from "@/lib/chat-db";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** "Laporkan pesan": one flag per device. Enough different devices hide the message automatically. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { messageId } = await params;
  if (!z.string().uuid().safeParse(messageId).success) {
    return NextResponse.json({ error: "ID pesan tidak valid." }, { status: 400 });
  }
  const raw = await req.json().catch(() => undefined);
  try {
    const result = await processChatFlag(raw, messageId, createFlagDeps(serviceClient()));
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("POST /api/stations/[id]/chat/[messageId]/flag", err);
    return NextResponse.json({ error: "Gagal melaporkan pesan." }, { status: 500 });
  }
}
