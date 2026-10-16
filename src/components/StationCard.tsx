import type { StationDTO } from "@/lib/api-types";
import { formatDistance, reportedText } from "@/lib/format";
import { CategoryBadge, GesBadge, OpenBadge, QueueBadge, queueTone } from "./StatusBits";
import { GasIcon, NavIcon, TravelEstimate, routeUrl } from "./ui";

/** One SPBU as a card in the full list. */
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
  const tone = queueTone(s.queue.status);
  return (
    <div className={`flex items-start gap-2 rounded-2xl border border-line bg-white p-3 shadow-sm ${className}`}>
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone.tile}`}>
          <GasIcon />
        </span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 block text-base leading-snug font-bold text-slate-900">{s.name}</span>
            {distance !== null && (
              <span className="shrink-0 text-right">
                <span className="tnum block text-base font-bold text-primary">{formatDistance(distance)}</span>
                <TravelEstimate distance={distance} className="block text-[11px] text-slate-600" />
              </span>
            )}
          </span>
          <span className="line-clamp-1 block text-sm text-slate-600">{s.address ?? s.regency}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            <OpenBadge hours={s.openingHours} is24h={s.is24h} />
            <CategoryBadge category={s.category} />
            {s.isGes && <GesBadge />}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <QueueBadge status={s.queue.status} />
            {s.queue.reportCount > 0 && <span className="text-xs text-slate-600">{reportedText(s.queue)}</span>}
          </span>
        </span>
      </button>
      <a
        href={routeUrl(s.lat, s.lng)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Rute ke ${s.name}`}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary active:opacity-80"
      >
        <NavIcon />
      </a>
    </div>
  );
}

/** Compact card for the nearby row: icon tile, name, distance and rough travel time, badges and queue level. */
export function NearbyCard({
  station: s,
  distance,
  active,
  onOpen,
}: {
  station: StationDTO;
  distance: number | null;
  active: boolean;
  onOpen: () => void;
}) {
  const tone = queueTone(s.queue.status);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? "true" : undefined}
      className={`flex h-full w-full flex-col gap-1.5 rounded-2xl border bg-white p-3 text-left shadow-sm ${
        active ? "border-primary ring-primary/25 ring-2" : "border-line"
      }`}
    >
      <span className="flex items-start gap-2.5">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tone.tile}`}>
          <GasIcon />
        </span>
        <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-bold text-slate-900">{s.name}</span>
        {distance !== null && (
          <span className="shrink-0 text-right">
            <span className="tnum text-primary block text-sm font-bold">{formatDistance(distance)}</span>
            <TravelEstimate distance={distance} className="block text-[11px] text-slate-600" />
          </span>
        )}
      </span>
      <span className="line-clamp-1 block text-xs text-slate-600">{s.address ?? s.regency}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        <CategoryBadge category={s.category} />
        <OpenBadge hours={s.openingHours} is24h={s.is24h} />
        <QueueBadge status={s.queue.status} />
      </span>
    </button>
  );
}
