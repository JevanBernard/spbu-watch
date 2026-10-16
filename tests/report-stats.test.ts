import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { countReports24h } from "@/lib/report-stats";

// A stand-in for the query builder that records the filters and answers with a count per kind.
function fakeDb(counts: Record<string, number>, fail?: string) {
  const calls: { filters: Record<string, unknown>; head: boolean }[] = [];
  const from = () => {
    const filters: Record<string, unknown> = {};
    let head = false;
    const b = {
      select: (_cols: string, opts?: { head?: boolean }) => ((head = Boolean(opts?.head)), b),
      eq: (c: string, v: unknown) => ((filters[c] = v), b),
      gte: (c: string, v: unknown) => ((filters[c] = v), b),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        calls.push({ filters: { ...filters }, head });
        const kind = String(filters.kind);
        const out = fail === kind ? { count: null, error: { message: "boom" } } : { count: counts[kind] ?? 0, error: null };
        return Promise.resolve(out).then(res, rej);
      },
    };
    return b;
  };
  return { db: { from } as unknown as SupabaseClient, calls };
}

describe("countReports24h", () => {
  const NOW = new Date("2026-10-16T06:00:00Z");

  it("counts per kind and adds them up", async () => {
    const { db } = fakeDb({ queue: 20, stock: 14, open: 3 });
    expect(await countReports24h(db, NOW)).toEqual({ total: 37, queue: 20, stock: 14, open: 3 });
  });

  it("looks at the last 24 hours, skips hidden reports and only asks for counts", async () => {
    const { db, calls } = fakeDb({});
    await countReports24h(db, NOW);
    expect(calls).toHaveLength(3);
    for (const c of calls) {
      expect(c.head).toBe(true); // no report rows are read
      expect(c.filters.hidden).toBe(false);
      expect(c.filters.created_at).toBe("2026-10-15T06:00:00.000Z");
    }
  });

  it("is zero when there are no reports", async () => {
    const { db } = fakeDb({});
    expect(await countReports24h(db, NOW)).toEqual({ total: 0, queue: 0, stock: 0, open: 0 });
  });

  it("fails as a whole when one count cannot be read, so the total is never wrong", async () => {
    const { db } = fakeDb({ queue: 5 }, "stock");
    await expect(countReports24h(db, NOW)).rejects.toThrow("boom");
  });
});
