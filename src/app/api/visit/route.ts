import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/reports";
import { serviceClient } from "@/lib/supabase";
import { visitorHash, witaDay } from "@/lib/visits";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }).strict();

/** Heartbeat for the visitor counter. Never fails loudly: the counter is a nicety. */
export async function POST(req: Request) {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) return new NextResponse(null, { status: 204 });
  try {
    const text = await req.text();
    if (text.length > 200) return new NextResponse(null, { status: 400 });
    const parsed = bodySchema.safeParse(JSON.parse(text));
    if (!parsed.success) return new NextResponse(null, { status: 400 });
    const visitor = visitorHash(clientIp(req.headers), parsed.data.deviceId, salt, witaDay());
    const { error } = await serviceClient().rpc("record_visit", { p_visitor: visitor });
    if (error) console.error("record_visit", error.message);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
