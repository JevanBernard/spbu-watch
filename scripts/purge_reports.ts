// Deletes reports older than 30 days and chat messages older than 2 days (CHAT_RETENTION_DAYS in src/lib/config.ts). Use when pg_cron is not available:
// run daily from a scheduled job (e.g. GitHub Actions) with the Supabase env vars set.
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(path.resolve(__dirname, "..", ".env"));
} catch {
  // In CI the variables come from the environment.
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env vars");

const db = createClient(url, key, { auth: { persistSession: false } });

async function purge(table: string, days: number) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { count, error } = await db.from(table).delete({ count: "exact" }).lt("created_at", cutoff);
  if (error) {
    // chat_messages does not exist until migration 0006 has been run: not an error for a reports-only setup
    console.error(`${table}: ${error.message}`);
    return false;
  }
  console.log(`Deleted ${count ?? 0} rows from ${table} older than ${cutoff}`);
  return true;
}

(async () => {
  const reportsOk = await purge("reports", 30);
  await purge("chat_messages", 2);
  if (!reportsOk) process.exit(1);
})();
