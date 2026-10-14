import data from "@/data/fuel_prices.json";
import type { Fuel } from "./status";

export const FUEL_PRICES = data as {
  region: string;
  asOf: string;
  source: string;
  prices: Partial<Record<Fuel, number>>;
};

export function rupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export function priceOf(fuel: Fuel): number | null {
  return FUEL_PRICES.prices[fuel] ?? null;
}

/** "14 Okt 2026" from an ISO date (no time zone shifts). */
export function asOfText(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${months[m - 1]} ${y}`;
}
