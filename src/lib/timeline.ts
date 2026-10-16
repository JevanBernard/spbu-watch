import { computeQueueStatus, computeStockStatus, type Fuel, type QueueState, type Report, type StockState } from "./status";

export const TIMELINE_HOURS = 24;
const HOUR_MS = 3_600_000;
/** Each hourly slot looks at its end and at two earlier points, so a short quiet gap does not blank the hour. */
const PROBES_MIN = [0, 20, 40];

export interface TimelineSlot {
  /** End of the hour (ISO). The last slot ends "now". */
  at: string;
  queue: QueueState;
  stock: Partial<Record<Fuel, StockState>>;
}

export interface Timeline {
  slots: TimelineSlot[];
  /** Non-hidden reports (visitors and admin) created within the window. */
  reportCount: number;
}

const FUELS: Fuel[] = ["pertalite", "pertamax", "pertamax_turbo", "solar", "dexlite", "pertamina_dex"];

/**
 * Hourly history of the status shown on the station page, computed with the same rules as the live status
 * (decay, one report per device, "habis" only when several devices agree). Done on the server because it needs
 * the device ids, which never leave it. Old admin reports that are only kept until replaced count as "unknown" here.
 */
export function buildTimeline(reports: Report[], now: Date, hours = TIMELINE_HOURS): Timeline {
  const visible = reports.filter((r) => !r.hidden);
  const times = visible.map((r) => new Date(r.createdAt).getTime());
  const fuels = FUELS.filter((f) => visible.some((r) => r.fuel === f));

  const slots: TimelineSlot[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const end = now.getTime() - i * HOUR_MS;
    let queue: QueueState = "unknown";
    const stock: Partial<Record<Fuel, StockState>> = {};
    for (const f of fuels) stock[f] = "unknown";
    // Newest probe first; the first probe that knows something wins.
    for (const back of PROBES_MIN) {
      const t = new Date(end - back * 60_000);
      const upTo = visible.filter((_, idx) => times[idx] <= t.getTime()); // nothing "from the future"
      if (queue === "unknown") {
        const q = computeQueueStatus(upTo, t);
        if (!q.stale) queue = q.status;
      }
      for (const f of fuels) {
        if (stock[f] !== "unknown") continue;
        const s = computeStockStatus(upTo, f, t);
        if (!s.stale) stock[f] = s.status;
      }
    }
    slots.push({ at: new Date(end).toISOString(), queue, stock });
  }

  const since = now.getTime() - hours * HOUR_MS;
  const reportCount = times.filter((t) => t >= since && t <= now.getTime()).length;
  return { slots, reportCount };
}
