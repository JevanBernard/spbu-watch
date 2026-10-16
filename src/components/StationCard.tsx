import type { StationDTO } from "@/lib/api-types";
import { QUEUE_LABEL, formatDistance, reportedText } from "@/lib/format";
import { TravelEstimate } from "./FeaturedStation";
import { CategoryBadge, GesBadge, OpenBadge, QueueBadge, queueTone } from "./StatusBits";
import { GasIcon, NavIcon, routeUrl } from "./ui";

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

/** Compact row for "Pilihan alternatif": coloured icon tile, name, queue level, distance and rough travel time. */
export function StationMini({
  station: s,
  distance,
  onSelect,
}: {
  station: StationDTO;
  distance: number;
  onSelect: (id: string) => void;
}) {
  const tone = queueTone(s.queue.status);
  return (
    <button
      type="button"
      onClick={() => onSelect(s.id)}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-canvas p-3 text-left active:scale-[0.99]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tone.tile}`}>
          <GasIcon />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-slate-900">{s.name}</span>
          <span className={`block text-xs font-semibold ${tone.text}`}>
            {QUEUE_LABEL[s.queue.status]}
            {s.queue.reportCount > 0 && ` · ${s.queue.reportCount} pelapor`}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="tnum block text-sm font-bold text-slate-900">{formatDistance(distance)}</span>
        <TravelEstimate distance={distance} className="block text-[11px] text-slate-600" />
      </span>
    </button>
  );
}
