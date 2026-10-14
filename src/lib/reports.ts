import { createHash } from "node:crypto";
import { z } from "zod";
import {
  DEVICE_MAX_PER_HOUR,
  GEOFENCE_M,
  IP_MAX_PER_HOUR,
  REPORT_COOLDOWN_MIN,
} from "./config";

const FUELS = [
  "pertalite",
  "pertamax",
  "pertamax_turbo",
  "solar",
  "dexlite",
  "pertamina_dex",
] as const;

/** kind decides which of queueLevel / fuel+stockStatus are required. Shared by user and admin reports. */
function checkKind(
  v: { kind: "queue" | "stock"; queueLevel?: number; fuel?: string; stockStatus?: string },
  ctx: z.RefinementCtx,
) {
  const bad = (message: string) => ctx.addIssue({ code: "custom", message });
  if (v.kind === "queue") {
    if (v.queueLevel === undefined) bad("queueLevel wajib untuk laporan antrean");
    if (v.fuel !== undefined || v.stockStatus !== undefined) bad("fuel/stockStatus tidak boleh");
  } else {
    if (v.fuel === undefined || v.stockStatus === undefined) bad("fuel dan stockStatus wajib");
    if (v.queueLevel !== undefined) bad("queueLevel tidak boleh untuk laporan stok");
  }
}

const reportFields = {
  stationId: z.string().uuid(),
  kind: z.enum(["queue", "stock"]),
  queueLevel: z.number().int().min(0).max(2).optional(),
  fuel: z.enum(FUELS).optional(),
  stockStatus: z.enum(["available", "out"]).optional(),
};

/** Admin report (from CCTV): no device, location or captcha; the route checks the admin token instead. */
export const adminReportSchema = z.object(reportFields).strict().superRefine(checkKind);
export type AdminReportInput = z.infer<typeof adminReportSchema>;

export const reportSchema = z
  .object({
    ...reportFields,
    deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    turnstileToken: z.string().max(2048).optional(), // checked in the route, never stored
  })
  .strict()
  .superRefine(checkKind);

export type ReportInput = z.infer<typeof reportSchema>;

export interface NewReportRow {
  station_id: string;
  kind: "queue" | "stock";
  queue_level: number | null;
  fuel: string | null;
  stock_status: string | null;
  device_id: string;
  ip_hash: string;
}

/** Database access, injected so the rules below can be tested without a database. */
export interface ReportDeps {
  /** Metres from the station to the point, or null when the station does not exist. */
  distanceM(stationId: string, lat: number, lng: number): Promise<number | null>;
  countDeviceSame(input: ReportInput, sinceIso: string): Promise<number>;
  countDevice(deviceId: string, sinceIso: string): Promise<number>;
  countIp(ipHash: string, sinceIso: string): Promise<number>;
  insert(row: NewReportRow): Promise<void>;
  now(): Date;
}

export interface ReportResult {
  status: 201 | 400 | 403 | 404 | 429;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip")?.trim() || "unknown";
}

const minutesAgo = (now: Date, m: number) => new Date(now.getTime() - m * 60_000).toISOString();

export async function processReport(
  raw: unknown,
  ipHash: string,
  deps: ReportDeps,
): Promise<ReportResult> {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, body: { error: "Data laporan tidak valid." } };
  }
  const r = parsed.data;

  // Geofence. The coordinates are used only for this check and are never stored.
  const distance = await deps.distanceM(r.stationId, r.lat, r.lng);
  if (distance === null) {
    return { status: 404, body: { error: "SPBU tidak ditemukan." } };
  }
  if (distance > GEOFENCE_M) {
    return {
      status: 403,
      body: {
        error: `Laporan hanya bisa dikirim dari dekat SPBU (maksimal ${GEOFENCE_M} meter). Anda sekitar ${Math.round(distance)} meter dari SPBU ini.`,
      },
    };
  }

  const now = deps.now();
  const sameSince = minutesAgo(now, REPORT_COOLDOWN_MIN);
  const hourSince = minutesAgo(now, 60);

  if ((await deps.countDeviceSame(r, sameSince)) > 0) {
    return {
      status: 429,
      body: {
        error: `Anda sudah mengirim laporan serupa untuk SPBU ini. Coba lagi dalam ${REPORT_COOLDOWN_MIN} menit.`,
      },
      headers: { "Retry-After": String(REPORT_COOLDOWN_MIN * 60) },
    };
  }
  if ((await deps.countDevice(r.deviceId, hourSince)) >= DEVICE_MAX_PER_HOUR) {
    return {
      status: 429,
      body: { error: "Terlalu banyak laporan dari perangkat ini. Coba lagi dalam satu jam." },
      headers: { "Retry-After": "3600" },
    };
  }
  if ((await deps.countIp(ipHash, hourSince)) >= IP_MAX_PER_HOUR) {
    return {
      status: 429,
      body: { error: "Terlalu banyak laporan dari jaringan ini. Coba lagi dalam satu jam." },
      headers: { "Retry-After": "3600" },
    };
  }

  await deps.insert({
    station_id: r.stationId,
    kind: r.kind,
    queue_level: r.kind === "queue" ? (r.queueLevel ?? null) : null,
    fuel: r.kind === "stock" ? (r.fuel ?? null) : null,
    stock_status: r.kind === "stock" ? (r.stockStatus ?? null) : null,
    device_id: r.deviceId,
    ip_hash: ipHash,
  });
  return { status: 201, body: { ok: true, cooldownMinutes: REPORT_COOLDOWN_MIN } };
}
