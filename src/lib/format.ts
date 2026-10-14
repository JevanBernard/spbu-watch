import type { Fuel, QueueState, StockState } from "./status";
import type { StationDTO } from "./api-types";

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
  return `${Math.floor(min / 60)} jam lalu`;
}

/** "dilaporkan 12 menit lalu oleh 3 orang" */
export function reportedText(
  s: { reportCount: number; lastReportAt: string | null },
  now?: Date,
): string {
  if (!s.lastReportAt || s.reportCount === 0) return "Belum ada laporan terbaru";
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
  return [s.name, s.address ?? "", s.regency, s.brand ?? ""].some((t) =>
    t.toLowerCase().includes(needle),
  );
}
