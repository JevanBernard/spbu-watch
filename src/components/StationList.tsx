import type { StationDTO } from "@/lib/api-types";
import StationCard from "./StationCard";

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
    return (
      <p className="mx-4 rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">
        Tidak ada SPBU yang cocok. Coba hapus sebagian filter.
      </p>
    );
  }
  return (
    <ul className="space-y-3 px-4">
      {items.map(({ station, distance }) => (
        <li key={station.id}>
          <StationCard station={station} distance={distance} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}
