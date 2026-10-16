import { Fragment } from "react";
import { hasAnyStats, statsSentence, type SiteStats } from "@/lib/site-stats";
import { countText } from "@/lib/visits-format";

/**
 * One line of live numbers under the disclaimer: online now, visitors today, all-time visitors, reports in 24 hours.
 * Parts that could not be read are left out; on a very narrow screen the line scrolls sideways instead of wrapping.
 */
export default function StatsStrip({ stats }: { stats: SiteStats }) {
  if (!hasAnyStats(stats)) return null;
  const items: { key: string; node: React.ReactNode }[] = [];
  if (stats.online !== null) {
    items.push({
      key: "online",
      node: (
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-1.5 rounded-full bg-status-smooth" />
          <b className="text-status-smooth">{countText(stats.online)}</b> online
        </span>
      ),
    });
  }
  if (stats.today !== null) {
    items.push({ key: "today", node: <span><b className="text-slate-900">{countText(stats.today)}</b> hari ini</span> });
  }
  if (stats.total !== null) {
    items.push({ key: "total", node: <span><b className="text-slate-900">{countText(stats.total)}</b> total</span> });
  }
  if (stats.reports24h) {
    items.push({
      key: "reports",
      node: (
        <span>
          <b className="text-primary">{countText(stats.reports24h.total)}</b> laporan/24 jam
        </span>
      ),
    });
  }
  return (
    <div
      role="group"
      aria-label={`Statistik: ${statsSentence(stats)}`}
      data-testid="stats-strip"
      className="tnum no-scrollbar border-line/70 pointer-events-auto flex items-center gap-x-1.5 overflow-x-auto rounded-xl border bg-white/95 px-2.5 py-1 text-[11px] leading-5 whitespace-nowrap text-slate-600 shadow-md"
    >
      {items.map((it, i) => (
        <Fragment key={it.key}>
          {i > 0 && (
            <span aria-hidden className="text-slate-300">
              ·
            </span>
          )}
          {it.node}
        </Fragment>
      ))}
    </div>
  );
}
