import type { Fuel, QueueState, StockState } from "./status";
import type { StationDTO } from "./api-types";
import { CATEGORY_LABEL } from "./category";

export const QUEUE_LABEL: Record<QueueState, string> = {
  sepi: "Antrean sepi",
  sedang: "Antrean sedang",
  panjang: "Antrean panjang",
  unknown: "Belum ada laporan",
};

export const STOCK_LABEL: Record<StockState, string> = {
  available: "Tersedia",
  out: "HABIS",
  unconfirmed: "Belum terkonfirmasi",
  conflicting: "Laporan beragam",
  unknown: "Belum ada laporan",
};

export const FUEL_LABEL: Record<Fuel, string> = {
  pertalite: "Pertalite",
  pertamax: "Pertamax",
  pertamax_turbo: "Pertamax Turbo",
  solar: "Solar",
  dexlite: "Dexlite",
  pertamina_dex: "Pertamina Dex",
};

export const FUEL_ORDER: Fuel[] = [
  "pertalite",
  "pertamax",
  "pertamax_turbo",
  "solar",
  "dexlite",
  "pertamina_dex",
];

export function timeAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} jam lalu`;
  return `${Math.floor(min / 1440)} hari lalu`;
}

/** "dilaporkan 12 menit lalu oleh 3 orang", or "dipantau admin (CCTV) 5 menit lalu" when the newest report is the admin's. */
export function reportedText(
  s: { reportCount: number; lastReportAt: string | null; fromAdmin?: boolean; stale?: boolean },
  now?: Date,
): string {
  if (!s.lastReportAt || s.reportCount === 0) return "Belum ada laporan terbaru";
  if (s.fromAdmin && s.stale) return `terakhir dipantau admin ${timeAgo(s.lastReportAt, now)}`;
  if (s.fromAdmin) {
    const others = s.reportCount - 1;
    return `dipantau admin (CCTV) ${timeAgo(s.lastReportAt, now)}${others > 0 ? `, ditambah ${others} pengguna` : ""}`;
  }
  return `dilaporkan ${timeAgo(s.lastReportAt, now)} oleh ${s.reportCount} orang`;
}

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Fuels to list in a station sheet: known fuels plus any with a stock status. */
export function stationFuels(s: StationDTO): Fuel[] {
  const set = new Set<Fuel>([...s.fuels, ...(Object.keys(s.stock) as Fuel[])]);
  return FUEL_ORDER.filter((f) => set.has(f));
}

export function hasConfirmedOut(s: StationDTO): boolean {
  return Object.values(s.stock).some((v) => v?.status === "out");
}

export function matchesSearch(s: StationDTO, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [s.name, s.address ?? "", s.regency, s.brand ?? "", s.pertaminaCode ?? "", CATEGORY_LABEL[s.category]].some((t) =>
    t.toLowerCase().includes(needle),
  );
}

/**
 * Static filter "sells <fuel>". Never uses live stock. A station stays in the list unless its fuel list
 * is verified complete and lacks the fuel, so unknown stations are not hidden by missing data.
 */
export function matchesFuelFilter(s: StationDTO, fuel: Fuel | ""): boolean {
  if (!fuel) return true;
  if (s.fuels.includes(fuel)) return true;
  return !s.fuelsComplete;
}

/** "Pertalite, Pertamax, Solar" for the fuels known to be sold, or null when nothing is known. */
export function soldFuelsText(s: Pick<StationDTO, "fuels">): string | null {
  const known = FUEL_ORDER.filter((f) => s.fuels.includes(f));
  return known.length ? known.map((f) => FUEL_LABEL[f]).join(", ") : null;
}
