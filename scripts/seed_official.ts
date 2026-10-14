// Seeds the single allowed official entry: the Pertamina Call Center 135 contact.
// No schedules, supply claims or targets are seeded (SPEC Phase 5). Safe to run twice.
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.resolve(__dirname, "..", ".env"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env vars in .env");
const db = createClient(url, key, { auth: { persistSession: false } });

const TITLE = "Pertamina Call Center 135";

async function main() {
  const { data, error } = await db.from("official_updates").select("id").eq("title", TITLE);
  if (error) throw new Error(error.message);
  if (data.length > 0) return console.log("Call Center 135 entry already exists.");
  const { error: insErr } = await db.from("official_updates").insert({
    title: TITLE,
    body: "Untuk pertanyaan dan pengaduan layanan BBM, hubungi Call Center Pertamina di 135.",
    source_name: "Pertamina Contact Center",
    source_url: null,
    published_at: new Date().toISOString(),
    pinned: true,
    active: true,
  });
  if (insErr) throw new Error(insErr.message);
  console.log("Seeded Call Center 135 entry.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
