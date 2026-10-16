import type { StationDTO } from "@/lib/api-types";
import { FUEL_LABEL, reportedText, stationFuels, updatedText } from "@/lib/format";
import { StockBadge } from "./StatusBits";
import { AlertIcon } from "./ui";

/** One card per fuel: name, stock badge, and when it was last reported. A confirmed "HABIS" spans both columns. */
export default function FuelGrid({ station }: { station: StationDTO }) {
  const fuels = stationFuels(station);
  if (fuels.length === 0) {
    return <p className="text-sm text-slate-700">Belum ada laporan stok untuk SPBU ini.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-2">
      {fuels.map((fuel) => {
        const st = station.stock[fuel];
        const out = st?.status === "out";
        const meta = !st || st.reportCount === 0 ? "Belum ada laporan" : st.fromAdmin || out ? reportedText(st) : updatedText(st.lastReportAt);
        return (
          <li
            key={fuel}
            className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${
              out ? "col-span-2 border-status-critical/40 bg-status-critical-bg" : "border-line bg-white"
            }`}
          >
            <div className="min-w-0 space-y-1">
              <span className="block text-sm font-bold text-slate-900">{FUEL_LABEL[fuel]}</span>
              <StockBadge status={st?.status ?? "unknown"} />
              <span className={`block text-[11px] ${out ? "text-status-critical" : "text-slate-600"}`}>{meta}</span>
            </div>
            {out && (
              <span className="shrink-0 text-status-critical">
                <AlertIcon />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
