import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_DEVICE_ID, ADMIN_KEEP_DAYS, FUEL_SOLD_WINDOW_DAYS, OPEN_TTL_MIN, STOCK_TTL_MIN } from "./config";
import { fuelListComplete, gesInfo, stationCategory } from "./category";
import { fuelsReportedSold, type AvailableReport } from "./fuels-sold";
import {
  computeOpenReportStatus,
  computeQueueStatus,
  computeStockStatus,
  type Fuel,
  type OpenReportStatus,
  type QueueStatus,
  type Report,
  type StockStatus,
} from "./status";

export interface StationRow {
  id: string;
  name: string;
  brand: string | null;
  operator: string | null;
  regency: string;
  lat: number;
  lng: number;
  address: string | null;
  opening_hours: string | null;
  is_24h: boolean;
  fuels: Fuel[];
  has_ev_charging: boolean;
  pertamina_code: string | null;
}

export interface ReportRow {
  id: string;
  station_id: string;
  kind: "queue" | "stock";
  queue_level: number | null;
  fuel: Fuel | null;
  stock_status: "available" | "out" | null;
  open_status?: "open" | "closed" | null; // only present once migration 0007 has been run
  device_id: string;
  hidden: boolean;
  created_at: string;
}

export const STATION_COLUMNS =
  "id,name,brand,operator,regency,lat,lng,address,opening_hours,is_24h,fuels,has_ev_charging,pertamina_code";
const REPORT_COLUMNS_BASE = "id,station_id,kind,queue_level,fuel,stock_status,device_id,hidden,created_at";
export const REPORT_COLUMNS = `${REPORT_COLUMNS_BASE},open_status`;

/**
 * Runs `load` with the column list that includes `open_status`. If the database has not had migration 0007 yet,
 * the column does not exist: run it again without, so the rest of the app keeps working (open reports are then
 * simply not read).
 */
export async function withOpenColumn<T>(load: (columns: string) => PromiseLike<T>): Promise<T> {
  try {
    return await load(REPORT_COLUMNS);
  } catch (err) {
    if (/open_status/i.test(err instanceof Error ? err.message : String(err))) return load(REPORT_COLUMNS_BASE);
    throw err;
  }
}

const PAGE = 1000; // Supabase API returns at most 1000 rows per request by default.

export async function fetchAllPages<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export function toReport(r: ReportRow): Report {
  return {
    deviceId: r.device_id,
    createdAt: r.created_at,
    hidden: r.hidden,
    queueLevel: r.queue_level,
    fuel: r.fuel,
    stockStatus: r.stock_status,
    openStatus: r.open_status ?? null,
  };
}

export interface StationStatus {
  queue: QueueStatus;
  open: OpenReportStatus;
  stock: Partial<Record<Fuel, StockStatus>>;
}

/** Stock is computed for fuels the station is known to sell, plus any fuel with a report. */
export function computeStationStatus(
  station: Pick<StationRow, "fuels">,
  reports: Report[],
  now: Date,
): StationStatus {
  const fuels = new Set<Fuel>(station.fuels ?? []);
  for (const r of reports) if (r.fuel) fuels.add(r.fuel);
  const stock: Partial<Record<Fuel, StockStatus>> = {};
  for (const fuel of fuels) stock[fuel] = computeStockStatus(reports, fuel, now);
  return { queue: computeQueueStatus(reports, now), stock, open: computeOpenReportStatus(reports, now) };
}

const FUEL_ORDER: Fuel[] = ["pertalite", "pertamax", "pertamax_turbo", "solar", "dexlite", "pertamina_dex"];

/** Static fuel list merged with fuels users reported (positive evidence only). */
export function mergeFuels(known: Fuel[], fromUsers: Fuel[]): { fuels: Fuel[]; fuelsFromUsers: Fuel[] } {
  const fuelsFromUsers = fromUsers.filter((f) => !known.includes(f));
  const all = new Set<Fuel>([...known, ...fromUsers]);
  return { fuels: FUEL_ORDER.filter((f) => all.has(f)), fuelsFromUsers: FUEL_ORDER.filter((f) => fuelsFromUsers.includes(f)) };
}

export function publicStation(s: StationRow, fromUsers: Fuel[] = []) {
  const { fuels, fuelsFromUsers } = mergeFuels(s.fuels ?? [], fromUsers);
  return {
    id: s.id,
    name: s.name,
    brand: s.brand,
    regency: s.regency,
    lat: s.lat,
    lng: s.lng,
    address: s.address,
    openingHours: s.opening_hours,
    is24h: s.is_24h,
    fuels,
    fuelsFromUsers,
    hasEvCharging: s.has_ev_charging,
    pertaminaCode: s.pertamina_code,
    category: stationCategory({ brand: s.brand, name: s.name, pertaminaCode: s.pertamina_code }),
    isGes: gesInfo(s.pertamina_code) !== null,
    fuelsComplete: fuelListComplete(s.pertamina_code),
  };
}

/**
 * The admin's latest report per station/kind/fuel from the last ADMIN_KEEP_DAYS, whatever its age.
 * These stay on the map (marked as old) until the admin or a newer report replaces them.
 */
export async function loadAdminReports(
  service: SupabaseClient,
  now: Date,
  stationId?: string,
): Promise<ReportRow[]> {
  const since = new Date(now.getTime() - ADMIN_KEEP_DAYS * 86_400_000).toISOString();
  const rows = await withOpenColumn((columns) =>
    fetchAllPages<ReportRow>((from, to) => {
      let q = service
        .from("reports")
        .select(columns)
        .eq("device_id", ADMIN_DEVICE_ID)
        .eq("hidden", false)
        .gte("created_at", since);
      if (stationId) q = q.eq("station_id", stationId);
      return q.order("created_at", { ascending: false }).order("id").range(from, to).returns<ReportRow[]>();
    }),
  );
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.station_id}|${r.kind}|${r.fuel ?? ""}`; // newest first, so the first one wins
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Window reports plus the admin's kept reports, without duplicates. */
export function mergeReports(windowRows: ReportRow[], adminRows: ReportRow[]): ReportRow[] {
  const ids = new Set(windowRows.map((r) => r.id));
  return [...windowRows, ...adminRows.filter((r) => !ids.has(r.id))];
}

export async function loadStationsWithStatus(
  service: SupabaseClient,
  anon: SupabaseClient,
  now = new Date(),
) {
  const since = new Date(now.getTime() - Math.max(STOCK_TTL_MIN, OPEN_TTL_MIN) * 60_000).toISOString(); // longest TTL
  const stations = await fetchAllPages<StationRow>((from, to) =>
    anon.from("stations").select(STATION_COLUMNS).eq("active", true).order("id").range(from, to),
  );
  const reports = await withOpenColumn((columns) =>
    fetchAllPages<ReportRow>((from, to) =>
      service
        .from("reports")
        .select(columns)
        .eq("hidden", false)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
        .returns<ReportRow[]>(),
    ),
  );
  const sold = await loadSoldReports(service, now);
  const byStation = new Map<string, Report[]>();
  for (const r of mergeReports(reports, await loadAdminReports(service, now))) {
    const list = byStation.get(r.station_id) ?? [];
    list.push(toReport(r));
    byStation.set(r.station_id, list);
  }
  return stations.map((s) => {
    const pub = publicStation(s, fuelsReportedSold(sold.get(s.id) ?? [], now));
    return { ...pub, ...computeStationStatus({ fuels: pub.fuels }, byStation.get(s.id) ?? [], now) };
  });
}

interface SoldRow {
  station_id: string;
  fuel: Fuel;
  device_id: string;
  created_at: string;
}

/** "Available" stock reports of the last FUEL_SOLD_WINDOW_DAYS, grouped by station. */
export async function loadSoldReports(
  service: SupabaseClient,
  now: Date,
  stationId?: string,
): Promise<Map<string, AvailableReport[]>> {
  const since = new Date(now.getTime() - FUEL_SOLD_WINDOW_DAYS * 86_400_000).toISOString();
  const rows = await fetchAllPages<SoldRow>((from, to) => {
    let q = service
      .from("reports")
      .select("station_id,fuel,device_id,created_at")
      .eq("kind", "stock")
      .eq("stock_status", "available")
      .eq("hidden", false)
      .gte("created_at", since);
    if (stationId) q = q.eq("station_id", stationId);
    return q.order("created_at", { ascending: false }).order("id").range(from, to);
  });
  const byStation = new Map<string, AvailableReport[]>();
  for (const r of rows) {
    const list = byStation.get(r.station_id) ?? [];
    list.push({ deviceId: r.device_id, fuel: r.fuel, createdAt: r.created_at });
    byStation.set(r.station_id, list);
  }
  return byStation;
}
