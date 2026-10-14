// Deletes reports older than 30 days. Use when pg_cron is not available:
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

const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
createClient(url, key, { auth: { persistSession: false } })
  .from("reports")
  .delete({ count: "exact" })
  .lt("created_at", cutoff)
  .then(({ count, error }) => {
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    console.log(`Deleted ${count ?? 0} reports older than ${cutoff}`);
  });
