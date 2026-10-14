// DEV ONLY: inserts fake reports so every status colour/state can be checked in the UI.
// Usage: pnpm fake-reports          (insert; first removes older fake rows)
//        pnpm fake-reports --clear  (remove fake rows only)
// Fake rows are recognisable by device_id starting with "dev-fake-" and ip_hash "dev-fake".
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.resolve(__dirname, "..", ".env"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env vars in .env");
const db = createClient(url, key, { auth: { persistSession: false } });

const minAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
let n = 0;
type Row = Record<string, unknown>;
const base = (station_id: string, created_at: string) => ({
  station_id,
  device_id: `dev-fake-${n++}`,
  ip_hash: "dev-fake",
  hidden: false,
  created_at,
  // Every row needs the same keys in a bulk insert, otherwise missing ones are sent as null.
  queue_level: null as number | null,
  fuel: null as string | null,
  stock_status: null as string | null,
});
const queue = (id: string, level: number, m: number): Row => ({
  ...base(id, minAgo(m)),
  kind: "queue",
  queue_level: level,
});
const stock = (id: string, fuel: string, st: "available" | "out", m: number): Row => ({
  ...base(id, minAgo(m)),
  kind: "stock",
  fuel,
  stock_status: st,
});

async function clear() {
  const { error } = await db.from("reports").delete().eq("ip_hash", "dev-fake");
  if (error) throw new Error(error.message);
}

async function main() {
  await clear();
  if (process.argv.includes("--clear")) return console.log("Fake reports removed.");

  const { data: stations, error } = await db.from("stations").select("id,name").order("name");
  if (error || !stations) throw new Error(error?.message ?? "no stations");
  if (stations.length < 12) throw new Error("Seed stations first (pnpm seed).");
  const s = stations.map((x) => x.id as string);

  const rows: Row[] = [
    // 0: sepi, 3 people. 1: sedang. 2: panjang. 3: single report (low confidence).
    queue(s[0], 0, 3), queue(s[0], 0, 10), queue(s[0], 1, 20),
    queue(s[1], 1, 5), queue(s[1], 1, 15),
    queue(s[2], 2, 2), queue(s[2], 2, 8), queue(s[2], 2, 25),
    queue(s[3], 2, 12),
    // 4: stale (46 min) -> unknown/grey
    queue(s[4], 2, 46),
    // 5: panjang + CONFIRMED OUT pertalite (3 devices)
    queue(s[5], 2, 4),
    stock(s[5], "pertalite", "out", 3), stock(s[5], "pertalite", "out", 6), stock(s[5], "pertalite", "out", 9),
    stock(s[5], "pertamax", "available", 5),
    // 6: only 2 devices say out -> "Belum terkonfirmasi" (neutral)
    queue(s[6], 1, 6),
    stock(s[6], "pertalite", "out", 4), stock(s[6], "pertalite", "out", 7),
    // 7: conflicting
    queue(s[7], 1, 5),
    stock(s[7], "pertamax", "out", 5), stock(s[7], "pertamax", "available", 5),
    // 8: available (stock only, no queue)
    stock(s[8], "pertalite", "available", 2), stock(s[8], "pertalite", "available", 12),
    stock(s[8], "solar", "available", 20),
    // 9: out reports older than 60 min are ignored -> unknown
    stock(s[9], "pertalite", "out", 61), stock(s[9], "pertalite", "out", 62), stock(s[9], "pertalite", "out", 63),
    // 10: hidden report is ignored
    { ...queue(s[10], 2, 1), hidden: true },
  ];
  const { error: insErr } = await db.from("reports").insert(rows);
  if (insErr) throw new Error(insErr.message);
  console.log(`Inserted ${rows.length} fake reports on 11 stations. Run with --clear to remove.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
