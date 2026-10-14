import type { StationDTO } from "@/lib/api-types";
import { formatDistance, reportedText } from "@/lib/format";
import { CategoryBadge, GesBadge, OpenBadge, QueueBadge } from "./StatusBits";
import { NavIcon, routeUrl } from "./ui";

/** One SPBU as a card: used in the nearest-stations carousel and in the full list. */
export default function StationCard({
  station: s,
  distance,
  onSelect,
  className = "",
}: {
  station: StationDTO;
  distance: number | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        className="min-h-11 min-w-0 flex-1 space-y-1.5 text-left"
      >
        <span className="line-clamp-2 block text-base leading-snug font-bold text-slate-900">
          {s.name}
        </span>
        <span className="line-clamp-1 block text-sm text-slate-600">{s.address ?? s.regency}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs">
          <OpenBadge hours={s.openingHours} is24h={s.is24h} />
          {distance !== null && (
            <span className="rounded bg-blue-50 px-2 py-0.5 font-bold text-blue-900">
              {formatDistance(distance)}
            </span>
          )}
          <CategoryBadge category={s.category} />
          {s.isGes && <GesBadge />}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <QueueBadge status={s.queue.status} />
          {s.queue.reportCount > 0 && (
            <span className="text-xs text-slate-600">{reportedText(s.queue)}</span>
          )}
        </span>
      </button>
      <a
        href={routeUrl(s.lat, s.lng)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Rute ke ${s.name}`}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900 active:bg-blue-100"
      >
        <NavIcon />
      </a>
    </div>
  );
}
