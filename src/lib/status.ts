import {
  ADMIN_DEVICE_ID,
  ADMIN_OUT_CONFIRMED_MIN,
  ADMIN_QUEUE_SHOW_MIN,
  DOMINANCE,
  HALF_LIFE_MIN,
  MIN_DEVICES_FOR_OUT,
  QUEUE_TTL_MIN,
  STOCK_TTL_MIN,
} from "./config";

export type Fuel =
  | "pertalite"
  | "pertamax"
  | "pertamax_turbo"
  | "solar"
  | "dexlite"
  | "pertamina_dex";

export interface Report {
  deviceId: string;
  createdAt: Date | string | number;
  hidden?: boolean;
  queueLevel?: number | null; // 0 sepi, 1 sedang, 2 panjang
  fuel?: Fuel | null;
  stockStatus?: "available" | "out" | null;
}

export type QueueState = "sepi" | "sedang" | "panjang" | "unknown";
export type StockState = "available" | "out" | "unconfirmed" | "conflicting" | "unknown";
export type Confidence = "none" | "low" | "normal";

interface Summary {
  reportCount: number; // distinct devices counted
  lastReportAt: string | null;
  /** The newest counted report was entered by the admin (CCTV), not by a visitor. */
  fromAdmin: boolean;
  /** The newest counted report is older than the normal TTL: only admin reports can be (they are kept until replaced). */
  stale: boolean;
  confidence: Confidence;
}

export interface QueueStatus extends Summary {
  status: QueueState;
}

export interface StockStatus extends Summary {
  status: StockState;
}

const MS_PER_MIN = 60_000;

function ageMin(createdAt: Report["createdAt"], now: Date): number {
  const t = new Date(createdAt).getTime();
  // A report "from the future" (clock skew) counts as brand new.
  return Math.max(0, (now.getTime() - t) / MS_PER_MIN);
}

export function weight(ageMinutes: number): number {
  return Math.pow(0.5, ageMinutes / HALF_LIFE_MIN);
}

interface Used {
  report: Report;
  age: number;
  w: number;
}

/**
 * Fresh, non-hidden reports that pass `match`, latest one per device.
 * Admin reports never expire (until replaced); their weight stops decaying at the TTL so a fresh visitor report outweighs them.
 */
function latestPerDevice(
  reports: Report[],
  ttlMin: number,
  now: Date,
  match: (r: Report) => boolean,
): Used[] {
  const latest = new Map<string, Used>();
  for (const r of reports) {
    if (r.hidden || !match(r)) continue;
    const age = ageMin(r.createdAt, now);
    const admin = r.deviceId === ADMIN_DEVICE_ID;
    if (age >= ttlMin && !admin) continue; // only reports newer than the TTL count
    const prev = latest.get(r.deviceId);
    if (!prev || age < prev.age) latest.set(r.deviceId, { report: r, age, w: weight(admin ? Math.min(age, ttlMin) : age) });
  }
  return [...latest.values()];
}

function summarize(used: Used[], ttlMin: number): Summary {
  if (used.length === 0) return { reportCount: 0, lastReportAt: null, fromAdmin: false, stale: false, confidence: "none" };
  const newest = used.reduce((a, b) => (a.age <= b.age ? a : b));
  return {
    reportCount: used.length,
    lastReportAt: new Date(newest.report.createdAt).toISOString(),
    fromAdmin: newest.report.deviceId === ADMIN_DEVICE_ID,
    stale: newest.age >= ttlMin,
    confidence: used.length === 1 || newest.age >= ttlMin ? "low" : "normal",
  };
}

export function computeQueueStatus(reports: Report[], now: Date = new Date()): QueueStatus {
  const used = latestPerDevice(
    reports,
    QUEUE_TTL_MIN,
    now,
    (r) => r.queueLevel !== null && r.queueLevel !== undefined,
  );
  const summary = summarize(used, QUEUE_TTL_MIN);
  if (used.length === 0) return { status: "unknown", ...summary };

  const newestAge = Math.min(...used.map((u) => u.age));
  // Only an admin report can be this old (visitor reports expire at QUEUE_TTL_MIN). Keep the time, drop the status.
  if (newestAge >= ADMIN_QUEUE_SHOW_MIN) return { status: "unknown", ...summary };

  // A fresh admin observation that no visitor has contradicted since decides the status alone.
  const admin = used.find((u) => u.report.deviceId === ADMIN_DEVICE_ID);
  if (admin && admin.age < QUEUE_TTL_MIN && used.every((u) => u === admin || u.age >= admin.age)) {
    const level = admin.report.queueLevel as number;
    return { status: level < 0.5 ? "sepi" : level < 1.5 ? "sedang" : "panjang", ...summary };
  }

  const totalW = used.reduce((s, u) => s + u.w, 0);
  const rawMean = used.reduce((s, u) => s + u.w * (u.report.queueLevel as number), 0) / totalW;
  const mean = Math.round(rawMean * 1e9) / 1e9; // avoid float noise at the 0.5 / 1.5 cut-offs
  const status: QueueState = mean < 0.5 ? "sepi" : mean < 1.5 ? "sedang" : "panjang";
  return { status, ...summary };
}

export function computeStockStatus(
  reports: Report[],
  fuel: Fuel,
  now: Date = new Date(),
): StockStatus {
  const used = latestPerDevice(
    reports,
    STOCK_TTL_MIN,
    now,
    (r) => r.fuel === fuel && (r.stockStatus === "available" || r.stockStatus === "out"),
  );
  const summary = summarize(used, STOCK_TTL_MIN);
  if (used.length === 0) return { status: "unknown", ...summary };

  const totalW = used.reduce((s, u) => s + u.w, 0);
  const outUsed = used.filter((u) => u.report.stockStatus === "out");
  const outShare = outUsed.reduce((s, u) => s + u.w, 0) / totalW;
  const availShare = 1 - outShare;
  // Tolerance so an exact 60/40 split is not lost to floating-point error.
  const EPS = 1e-9;

  if (availShare >= DOMINANCE - EPS) return { status: "available", ...summary };
  if (outShare >= DOMINANCE - EPS) {
    // Anti-panic: red "habis" needs several independent devices.
    // The admin watches the station directly (CCTV), so a recent admin report is confirmation on its own.
    const confirmed =
      outUsed.length >= MIN_DEVICES_FOR_OUT ||
      outUsed.some((u) => u.report.deviceId === ADMIN_DEVICE_ID && u.age < ADMIN_OUT_CONFIRMED_MIN);
    return { status: confirmed ? "out" : "unconfirmed", ...summary };
  }
  return { status: "conflicting", ...summary };
}
