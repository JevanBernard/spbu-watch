import { FUEL_SOLD_MIN_DEVICES, FUEL_SOLD_WINDOW_DAYS } from "./config";
import type { Fuel } from "./status";

export interface AvailableReport {
  deviceId: string;
  fuel: Fuel;
  createdAt: Date | string | number;
}

/**
 * Fuels users have shown to be sold at a station: reported "available" by at least
 * FUEL_SOLD_MIN_DEVICES distinct devices within FUEL_SOLD_WINDOW_DAYS. Positive evidence only.
 */
export function fuelsReportedSold(reports: AvailableReport[], now: Date = new Date()): Fuel[] {
  const cutoff = now.getTime() - FUEL_SOLD_WINDOW_DAYS * 86_400_000;
  const devices = new Map<Fuel, Set<string>>();
  for (const r of reports) {
    if (new Date(r.createdAt).getTime() < cutoff) continue;
    const set = devices.get(r.fuel) ?? new Set<string>();
    set.add(r.deviceId);
    devices.set(r.fuel, set);
  }
  return [...devices.entries()].filter(([, d]) => d.size >= FUEL_SOLD_MIN_DEVICES).map(([f]) => f);
}
