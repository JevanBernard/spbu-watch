import type { ReactNode } from "react";
import type { StationDTO } from "@/lib/api-types";
import { GEOFENCE_M } from "@/lib/config";
import { formatDistance, reportedText, travelMinutes } from "@/lib/format";
import FuelGrid from "./FuelGrid";
import { CategoryBadge, GesBadge, OpenBadge, QueueBlock } from "./StatusBits";
import { NavIcon, ReportPinIcon, routeUrl } from "./ui";

/** "± 2 mnt": a rough motorbike estimate from the straight-line distance. Not navigation. */
export function TravelEstimate({ distance, className = "" }: { distance: number; className?: string }) {
  return (
    <span
      className={`tnum ${className}`}
      title="Perkiraan kasar dengan sepeda motor dari jarak lurus. Bukan navigasi."
    >
      ± {travelMinutes(distance)} mnt
    </span>
  );
}

/** The selected (or nearest) station as the main card of the bottom sheet. */
export default function FeaturedStation({
  station: s,
  distance,
  onDetail,
  onReport,
  adminSlot = null,
}: {
  station: StationDTO;
  distance: number | null;
  onDetail: () => void;
  onReport: () => void;
  /** Admin edit block, shown only in admin mode. */
  adminSlot?: ReactNode;
}) {
  const q = s.queue;
  const inRange = distance !== null && distance <= GEOFENCE_M;
  return (
    <div className="space-y-3.5 rounded-2xl bg-canvas p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onDetail} className="min-h-11 min-w-0 flex-1 space-y-1 text-left">
          <span className="block text-base leading-snug font-bold text-slate-900">{s.name}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            <CategoryBadge category={s.category} />
            {s.isGes && <GesBadge />}
            <OpenBadge hours={s.openingHours} is24h={s.is24h} />
          </span>
          <span className="line-clamp-2 block text-sm text-slate-600">{s.address ?? s.regency}</span>
        </button>
        {distance !== null && (
          <div className="flex shrink-0 flex-col items-end">
            <span className="tnum text-lg font-bold text-primary">{formatDistance(distance)}</span>
            <TravelEstimate distance={distance} className="text-xs text-slate-600" />
          </div>
        )}
      </div>

      <QueueBlock
        status={q.status}
        text={reportedText(q)}
        pill={q.reportCount > 0 && !q.stale ? (q.confidence === "low" ? "Kurang pasti" : `${q.reportCount} pelapor`) : undefined}
      />
      {inRange && (
        <p className="-mt-2 text-xs font-semibold text-status-smooth">
          ✓ Anda berada dalam jangkauan lapor (maksimal {GEOFENCE_M} m)
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900">Ketersediaan produk BBM</span>
        </div>
        <FuelGrid station={s} />
        <p className="text-[11px] text-slate-600">
          &quot;Belum terkonfirmasi&quot; berarti baru sedikit pelapor. Itu bukan berarti BBM habis.
        </p>
      </div>

      {adminSlot}

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onReport}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-secondary px-2 text-sm font-bold whitespace-nowrap text-white shadow-sm active:opacity-90"
        >
          <ReportPinIcon />
          Lapor kondisi
        </button>
        <a
          href={routeUrl(s.lat, s.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-primary px-2 text-sm font-bold whitespace-nowrap text-white shadow-md active:opacity-90"
        >
          <NavIcon />
          Buka navigasi
        </a>
      </div>
      <button type="button" onClick={onDetail} className="min-h-11 w-full text-sm font-bold text-primary">
        Lihat detail, harga, dan info SPBU
      </button>
    </div>
  );
}
