import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Constant-time comparison. Hashing first gives both sides equal length. */
export function tokensMatch(provided: string | null | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Returns an error response when the request is not an authorised admin call, otherwise null. */
export function requireAdmin(req: Request): NextResponse | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    console.error("ADMIN_TOKEN is not set; admin endpoints are disabled");
    return NextResponse.json({ error: "Admin belum dikonfigurasi." }, { status: 503 });
  }
  if (!tokensMatch(req.headers.get("x-admin-token"), expected)) {
    return NextResponse.json({ error: "Token admin salah." }, { status: 401 });
  }
  return null;
}
