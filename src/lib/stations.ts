import type { SupabaseClient } from "@supabase/supabase-js";
import { STOCK_TTL_MIN } from "./config";
import {
  computeQueueStatus,
  computeStockStatus,
  type Fuel,
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
  device_id: string;
  hidden: boolean;
  created_at: string;
}

export const STATION_COLUMNS =
  "id,name,brand,operator,regency,lat,lng,address,opening_hours,is_24h,fuels,has_ev_charging,pertamina_code";
export const REPORT_COLUMNS =
  "id,station_id,kind,queue_level,fuel,stock_status,device_id,hidden,created_at";

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
  };
}

export interface StationStatus {
  queue: QueueStatus;
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
  return { queue: computeQueueStatus(reports, now), stock };
}

export function publicStation(s: StationRow) {
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
    fuels: s.fuels,
    hasEvCharging: s.has_ev_charging,
    pertaminaCode: s.pertamina_code,
  };
}

export async function loadStationsWithStatus(
  service: SupabaseClient,
  anon: SupabaseClient,
  now = new Date(),
) {
  const since = new Date(now.getTime() - STOCK_TTL_MIN * 60_000).toISOString(); // longest TTL
  const stations = await fetchAllPages<StationRow>((from, to) =>
    anon.from("stations").select(STATION_COLUMNS).eq("active", true).order("id").range(from, to),
  );
  const reports = await fetchAllPages<ReportRow>((from, to) =>
    service
      .from("reports")
      .select(REPORT_COLUMNS)
      .eq("hidden", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  const byStation = new Map<string, Report[]>();
  for (const r of reports) {
    const list = byStation.get(r.station_id) ?? [];
    list.push(toReport(r));
    byStation.set(r.station_id, list);
  }
  return stations.map((s) => ({
    ...publicStation(s),
    ...computeStationStatus(s, byStation.get(s.id) ?? [], now),
  }));
}
