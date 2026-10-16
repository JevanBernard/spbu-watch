// Read-only check of the Supabase project in .env: which migrations have been run?
// Writes nothing. Run:  pnpm verify:db
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(path.resolve(__dirname, "..", ".env"));
} catch {
  // variables may already be in the environment
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(url, key, { auth: { persistSession: false } });

interface Check {
  label: string;
  migration: string;
  run: () => PromiseLike<{ error: { message: string } | null }>;
}

async function main() {
  const { data: st } = await db.from("stations").select("id,lat,lng").limit(1).maybeSingle();
  const table = (name: string) => () => db.from(name).select("*", { count: "exact", head: true });

  const checks: Check[] = [
    { label: "tabel stations", migration: "0001_init.sql", run: table("stations") },
    { label: "tabel reports", migration: "0001_init.sql", run: table("reports") },
    { label: "tabel official_updates", migration: "0001_init.sql", run: table("official_updates") },
    {
      label: "fungsi station_distance_m (jarak untuk radius laporan dan chat)",
      migration: "0002_station_distance.sql",
      run: () => db.rpc("station_distance_m", { p_station_id: st?.id, p_lat: st?.lat, p_lng: st?.lng }),
    },
    { label: "tabel visits (penghitung pengunjung)", migration: "0005_visits.sql", run: table("visits") },
    { label: "fungsi visit_stats", migration: "0005_visits.sql", run: () => db.rpc("visit_stats") },
    {
      label: "kolom reports.open_status (laporan SPBU buka/tutup)",
      migration: "0007_open_reports.sql",
      run: () => db.from("reports").select("open_status", { count: "exact", head: true }),
    },
    { label: "tabel chat_messages", migration: "0006_chat.sql", run: table("chat_messages") },
    { label: "tabel chat_flags", migration: "0006_chat.sql", run: table("chat_flags") },
  ];

  let missing = 0;
  const hints = new Set<string>();
  for (const c of checks) {
    const { error } = await c.run();
    if (error) {
      missing++;
      hints.add(c.migration);
      console.log(`  BELUM   ${c.label}  [${c.migration}]  (${error.message})`);
    } else {
      console.log(`  ok      ${c.label}`);
    }
  }
  if (missing === 0) {
    console.log("\nSemua migrasi yang dibutuhkan sudah dijalankan.");
  } else {
    console.log(`\n${missing} pemeriksaan gagal. Jalankan di SQL Editor Supabase: ${[...hints].sort().join(", ")}`);
    process.exitCode = 1;
  }
}

main();
