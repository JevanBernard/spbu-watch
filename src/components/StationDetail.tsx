import { useState } from "react";
import type { StationDTO } from "@/lib/api-types";
import { FUEL_LABEL, reportedText, stationFuels } from "@/lib/format";
import ReportFlow from "./ReportFlow";
import { QueueBadge, StockBadge } from "./StatusBits";

export default function StationDetail({
  station,
  onBack,
  onReported,
}: {
  station: StationDTO;
  onBack: () => void;
  onReported: () => void;
}) {
  const fuels = stationFuels(station);
  const [reporting, setReporting] = useState<"queue" | "stock" | null>(null);
  return (
    <div className="space-y-4 p-4">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 rounded-md border border-slate-400 px-3 text-sm font-bold"
      >
        ← Daftar SPBU
      </button>

      <header>
        <h2 className="text-lg font-bold leading-tight">{station.name}</h2>
        <p className="text-sm text-slate-700">
          {[station.brand, station.regency].filter(Boolean).join(" · ")}
        </p>
        {station.address && <p className="mt-1 text-sm text-slate-700">{station.address}</p>}
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
          {station.is24h && (
            <span className="rounded bg-blue-900 px-2 py-1 text-white">24 jam</span>
          )}
          {!station.is24h && station.openingHours && (
            <span className="rounded bg-slate-200 px-2 py-1">Buka: {station.openingHours}</span>
          )}
        </div>
      </header>

      <section>
        <h3 className="mb-1 text-sm font-bold">Antrean</h3>
        <QueueBadge status={station.queue.status} />
        <p className="mt-1 text-sm text-slate-700">
          {reportedText(station.queue)}
          {station.queue.confidence === "low" && " (baru 1 laporan, kurang pasti)"}
        </p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-bold">Stok BBM</h3>
        {fuels.length === 0 ? (
          <p className="text-sm text-slate-700">Belum ada laporan stok untuk SPBU ini.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {fuels.map((fuel) => {
              const st = station.stock[fuel];
              return (
                <li key={fuel} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-semibold">{FUEL_LABEL[fuel]}</span>
                  <span className="text-right">
                    <StockBadge status={st?.status ?? "unknown"} />
                    {st && st.reportCount > 0 && (
                      <span className="mt-0.5 block text-xs text-slate-600">
                        {reportedText(st)}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-600">
          Status &quot;Belum terkonfirmasi&quot; berarti baru sedikit pelapor. Itu bukan berarti
          BBM habis.
        </p>
      </section>

      {reporting ? (
        <ReportFlow
          key={reporting}
          station={station}
          kind={reporting}
          onClose={() => setReporting(null)}
          onDone={onReported}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setReporting("queue")}
            className="min-h-14 rounded-md border-2 border-blue-900 px-2 text-base font-bold text-blue-900"
          >
            Laporkan antrean
          </button>
          <button
            type="button"
            onClick={() => setReporting("stock")}
            className="min-h-14 rounded-md border-2 border-blue-900 px-2 text-base font-bold text-blue-900"
          >
            Laporkan stok
          </button>
        </div>
      )}

      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 items-center justify-center rounded-md bg-blue-900 px-4 text-base font-bold text-white"
      >
        Rute
      </a>
    </div>
  );
}
