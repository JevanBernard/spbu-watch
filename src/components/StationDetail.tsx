import { useState } from "react";
import { asOfText, FUEL_PRICES, priceOf, rupiah } from "@/lib/prices";
import type { StationDTO } from "@/lib/api-types";
import { FUEL_LABEL, reportedText, stationFuels } from "@/lib/format";
import ReportFlow from "./ReportFlow";
import { CategoryBadge, FuelsSold, GesBadge, OpenBadge, QueueBadge, StockBadge } from "./StatusBits";

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
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const share = async () => {
    const url = `${window.location.origin}/?spbu=${station.id}`;
    const text = `${station.name}: lihat antrean dan stok BBM di SPBU Watch SARBAGITA`;
    try {
      if (navigator.share) {
        await navigator.share({ title: station.name, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareMsg("Tautan disalin");
    } catch {
      setShareMsg("Tautan tidak bisa dibagikan dari perangkat ini");
    }
  };
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
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <CategoryBadge category={station.category} />
          {station.isGes && <GesBadge />}
          {station.is24h && (
            <span className="rounded bg-slate-200 px-2 py-0.5 font-bold text-slate-800">24 jam</span>
          )}
          <OpenBadge hours={station.openingHours} is24h={station.is24h} />
        </div>
        <p className="mt-2 text-sm text-slate-800">
          Kode resmi:{" "}
          {station.pertaminaCode ? (
            <b className="font-mono">{station.pertaminaCode}</b>
          ) : (
            <span className="text-slate-600">belum diketahui</span>
          )}
          {station.pertaminaCode && (
            <span className="block text-xs text-slate-600">
              Kode dari daftar Pertamina atau input pengelola. Jika ragu, periksa papan di lokasi.
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-slate-800">{station.address ?? station.regency}</p>
        <p className="mt-1 text-sm">
          <FuelsSold
            fuels={station.fuels}
            complete={station.fuelsComplete}
            fromUsers={station.fuelsFromUsers}
          />
        </p>
        {!station.is24h && station.openingHours && (
          <p className="mt-1 text-xs text-slate-700">Buka: {station.openingHours}</p>
        )}
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
                  <span>
                    <span className="font-semibold">{FUEL_LABEL[fuel]}</span>
                    {priceOf(fuel) !== null && (
                      <span className="block text-xs text-slate-600">{rupiah(priceOf(fuel) as number)}/liter</span>
                    )}
                  </span>
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
        <p className="mt-1 text-xs text-slate-600">
          Harga resmi {FUEL_PRICES.region} per {asOfText(FUEL_PRICES.asOf)}. Bisa berubah dan berbeda di
          Pertashop.
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

      <button
        type="button"
        onClick={share}
        className="min-h-12 w-full rounded-md border-2 border-blue-900 px-4 text-base font-bold text-blue-900"
      >
        Bagikan SPBU ini
      </button>
      {shareMsg && <p className="text-center text-sm text-slate-700">{shareMsg}</p>}

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
