import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { clientIp, hashIp, processReport } from "@/lib/reports";
import { createReportDeps } from "@/lib/reports-db";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_000;

export async function POST(req: Request) {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    console.error("POST /api/reports: IP_HASH_SALT is not set");
    return NextResponse.json({ error: "Server belum dikonfigurasi." }, { status: 500 });
  }

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) throw new Error("too large");
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Data laporan tidak valid." }, { status: 400 });
  }

  try {
    const ip = clientIp(req.headers);
    if (turnstileEnabled()) {
      const token = (raw as { turnstileToken?: unknown } | null)?.turnstileToken;
      const ok = await verifyTurnstile(
        typeof token === "string" ? token : undefined,
        process.env.TURNSTILE_SECRET_KEY!,
        ip,
      );
      if (!ok) {
        return NextResponse.json(
          { error: "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi." },
          { status: 403 },
        );
      }
    }
    const ipHash = hashIp(ip, salt);
    const result = await processReport(raw, ipHash, createReportDeps(serviceClient()));
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (err) {
    console.error("POST /api/reports", err);
    return NextResponse.json(
      { error: "Gagal menyimpan laporan. Coba lagi sebentar lagi." },
      { status: 500 },
    );
  }
}
