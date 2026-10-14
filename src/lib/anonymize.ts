export interface PublicReport {
  kind: "queue" | "stock";
  queueLevel: number | null;
  fuel: string | null;
  stockStatus: "available" | "out" | null;
  createdAt: string;
}

interface ReportLike {
  kind: "queue" | "stock";
  queue_level: number | null;
  fuel: string | null;
  stock_status: "available" | "out" | null;
  created_at: string;
}

/**
 * The only shape of a report that ever leaves the server. A whitelist, so a new database column
 * (device_id, ip_hash, ids, anything) can never leak by accident.
 */
export function anonymizeReports(rows: ReportLike[]): PublicReport[] {
  return rows.map((r) => ({
    kind: r.kind,
    queueLevel: r.queue_level,
    fuel: r.fuel,
    stockStatus: r.stock_status,
    createdAt: r.created_at,
  }));
}
