import { NextResponse } from "next/server";
import { z } from "zod";
import { processChatMessage, toPublicMessages } from "@/lib/chat";
import { createChatDeps } from "@/lib/chat-db";
import { CHAT_VISIBLE_HOURS } from "@/lib/config";
import { clientIp, hashIp } from "@/lib/reports";
import { serviceClient } from "@/lib/supabase";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 3_000;
const MAX_MESSAGES = 100;
const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;
// Personalised (the "mine" flag) and refreshed every few seconds: never cache, in browsers or on a CDN.
const NO_STORE = { "Cache-Control": "no-store" };

/** Everyone can read the chat of a station. Messages of the last CHAT_VISIBLE_HOURS, oldest first. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID SPBU tidak valid." }, { status: 400, headers: NO_STORE });
  }
  const header = req.headers.get("x-device-id");
  const asking = header && DEVICE_ID.test(header) ? header : null;
  try {
    const since = new Date(Date.now() - CHAT_VISIBLE_HOURS * 3_600_000).toISOString();
    const { data, error } = await serviceClient()
      .from("chat_messages")
      .select("id,nickname,body,created_at,device_id")
      .eq("station_id", id)
      .eq("hidden", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_MESSAGES);
    if (error) throw new Error(error.message);
    const rows = [...(data ?? [])].reverse();
    return NextResponse.json({ messages: toPublicMessages(rows, asking) }, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/stations/[id]/chat", err);
    return NextResponse.json({ error: "Gagal memuat obrolan." }, { status: 500, headers: NO_STORE });
  }
}

/** Send a message. Only from within the geofence; limits and content rules are in lib/chat.ts. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ID SPBU tidak valid." }, { status: 400 });
  }
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    console.error("POST /api/stations/[id]/chat: IP_HASH_SALT is not set");
    return NextResponse.json({ error: "Server belum dikonfigurasi." }, { status: 500 });
  }

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) throw new Error("too large");
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Data pesan tidak valid." }, { status: 400 });
  }

  try {
    const ip = clientIp(req.headers);
    if (turnstileEnabled()) {
      const token = (raw as { turnstileToken?: unknown } | null)?.turnstileToken;
      const ok = await verifyTurnstile(typeof token === "string" ? token : undefined, process.env.TURNSTILE_SECRET_KEY!, ip);
      if (!ok) {
        return NextResponse.json(
          { error: "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi." },
          { status: 403 },
        );
      }
    }
    const result = await processChatMessage(raw, id, hashIp(ip, salt), salt, createChatDeps(serviceClient()));
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (err) {
    console.error("POST /api/stations/[id]/chat", err);
    return NextResponse.json({ error: "Gagal mengirim pesan. Coba lagi sebentar lagi." }, { status: 500 });
  }
}
