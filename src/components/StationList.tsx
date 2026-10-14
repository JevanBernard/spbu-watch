import type { StationDTO } from "@/lib/api-types";
import { formatDistance, reportedText } from "@/lib/format";
import { CategoryBadge, GesBadge, QueueBadge } from "./StatusBits";

export interface ListItem {
  station: StationDTO;
  distance: number | null;
}

export default function StationList({
  items,
  onSelect,
}: {
  items: ListItem[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="p-4 text-sm text-slate-700">Tidak ada SPBU yang cocok.</p>;
  }
  return (
    <ul className="divide-y divide-slate-200">
      {items.map(({ station: s, distance }) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            className="flex min-h-14 w-full flex-col gap-1 px-4 py-3 text-left active:bg-slate-100"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="font-bold leading-tight">{s.name}</span>
              {distance !== null && (
                <span className="shrink-0 text-xs font-semibold text-slate-700">
                  {formatDistance(distance)}
                </span>
              )}
            </span>
            <span className="text-xs text-slate-700">{s.address ?? s.regency}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs">
              <CategoryBadge category={s.category} />
              {s.isGes && <GesBadge />}
              {s.is24h && (
                <span className="rounded bg-slate-200 px-2 py-0.5 font-bold text-slate-800">24 jam</span>
              )}
              <span className="text-slate-600">
                {s.pertaminaCode ? `Kode ${s.pertaminaCode}` : "Kode belum diketahui"}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <QueueBadge status={s.queue.status} />
              {s.queue.reportCount > 0 && (
                <span className="text-xs text-slate-600">{reportedText(s.queue)}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
