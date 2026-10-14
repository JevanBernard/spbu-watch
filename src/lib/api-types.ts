import type { StationCategory } from "./category";
import type { Fuel, QueueStatus, StockStatus } from "./status";

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
  hasEvCharging: boolean;
  pertaminaCode: string | null;
  category: StationCategory;
  isGes: boolean;
  queue: QueueStatus;
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
