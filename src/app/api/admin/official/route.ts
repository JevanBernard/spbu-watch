import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createOfficialSchema, patchOfficialSchema, toColumns } from "@/lib/official";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COLUMNS = "id,title,body,source_name,source_url,published_at,pinned,active";

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });
const failed = (where: string, err: unknown) => {
  console.error(where, err);
  return NextResponse.json({ error: "Operasi gagal. Coba lagi." }, { status: 500 });
};

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

/** All updates including inactive ones, for the admin page. */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const { data, error } = await serviceClient()
      .from("official_updates")
      .select(COLUMNS)
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ updates: data ?? [] });
  } catch (err) {
    return failed("GET /api/admin/official", err);
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const parsed = createOfficialSchema.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  try {
    const { data, error } = await serviceClient()
      .from("official_updates")
      .insert(toColumns(parsed.data))
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ update: data }, { status: 201 });
  } catch (err) {
    return failed("POST /api/admin/official", err);
  }
}

export async function PATCH(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const parsed = patchOfficialSchema.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const { id, ...changes } = parsed.data;
  try {
    const { data, error } = await serviceClient()
      .from("official_updates")
      .update(toColumns(changes))
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Informasi tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ update: data });
  } catch (err) {
    return failed("PATCH /api/admin/official", err);
  }
}
