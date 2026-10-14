import type { StationDTO } from "@/lib/api-types";
import { formatDistance, reportedText } from "@/lib/format";
import { QueueBadge } from "./StatusBits";

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
            <span className="text-xs text-slate-600">
              {[s.address?.split(",").slice(0, 2).join(",").trim(), s.regency]
                .filter(Boolean)
                .join(" · ")}
              {s.is24h && " · 24 jam"}
              {s.pertaminaCode && ` · ${s.pertaminaCode}`}
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
