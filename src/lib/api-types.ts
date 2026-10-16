import type { StationCategory } from "./category";
import type { Fuel, OpenReportStatus, QueueState, QueueStatus, StockState, StockStatus } from "./status";

export interface StationDTO {
  id: string;
  name: string;
  brand: string | null;
  regency: string;
  lat: number;
  lng: number;
  address: string | null;
  openingHours: string | null;
  is24h: boolean;
  fuels: Fuel[];
  fuelsFromUsers: Fuel[]; // part of `fuels` that comes from user reports, not from the static data
  hasEvCharging: boolean;
  pertaminaCode: string | null;
  category: StationCategory;
  isGes: boolean;
  fuelsComplete: boolean; // true: `fuels` is the verified full list of fuels sold
  queue: QueueStatus;
  /** What visitors and the admin report about the station being open now ("SPBU buka / tutup"). */
  open: OpenReportStatus;
  stock: Partial<Record<Fuel, StockStatus>>;
}

export interface OfficialUpdateDTO {
  id: string;
  title: string;
  body: string;
  sourceName: string;
  sourceUrl: string | null;
  publishedAt: string;
  pinned: boolean;
}

/** Hourly history of one station (oldest first). Same shape as `Timeline` in lib/timeline.ts. */
export interface StationTimelineDTO {
  slots: { at: string; queue: QueueState; stock: Partial<Record<Fuel, StockState>> }[];
  reportCount: number;
}
