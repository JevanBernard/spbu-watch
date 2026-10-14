// Loads data/stations.csv into Supabase (upsert on osm_type + osm_id).
// Usage: pnpm seed   (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env)
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(__dirname, "..");
process.loadEnvFile(path.join(root, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
}

const rows = parse(readFileSync(path.join(root, "data", "stations.csv"), "utf-8"), {
  columns: true,
  skip_empty_lines: true,
}) as Record<string, string>[];

const payload = rows.map((r) => ({
  osm_type: r.osm_type,
  osm_id: Number(r.osm_id),
  pertamina_code: r.pertamina_code || null,
  name: r.name,
  brand: r.brand || null,
  operator: r.operator || null,
  regency: r.regency,
  lat: Number(r.lat),
  lng: Number(r.lng),
  address: r.address || null,
  opening_hours: r.opening_hours || null,
  is_24h: r.is_24h === "true",
  fuels: JSON.parse(r.fuels || "[]"),
  has_ev_charging: r.has_ev_charging === "true",
  google_place_id: r.google_place_id || null,
  active: r.active !== "false",
}));

async function main() {
  const db = createClient(url!, key!, { auth: { persistSession: false } });
  for (let i = 0; i < payload.length; i += 100) {
    const { error } = await db
      .from("stations")
      .upsert(payload.slice(i, i + 100), { onConflict: "osm_type,osm_id" });
    if (error) throw new Error(error.message);
  }
  const { count } = await db.from("stations").select("*", { count: "exact", head: true });
  console.log(`Upserted ${payload.length} stations; table now has ${count}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
