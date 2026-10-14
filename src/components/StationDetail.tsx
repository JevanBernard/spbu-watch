import { useEffect, useRef, useState } from "react";
import type { StationDTO } from "@/lib/api-types";
import { CATEGORY_LABEL } from "@/lib/category";
import { FUEL_LABEL, FUEL_ORDER, formatDistance, reportedText, stationFuels } from "@/lib/format";
import { asOfText, FUEL_PRICES, priceOf, rupiah } from "@/lib/prices";
import ReportFlow from "./ReportFlow";
import ShareDialog from "./ShareDialog";
import { CategoryBadge, FuelsSold, GesBadge, OpenBadge, QueueBadge, StockBadge } from "./StatusBits";
import { BackIcon, NavIcon, routeUrl } from "./ui";

type Tab = "ringkasan" | "harga" | "info";
const TABS: { id: Tab; label: string }[] = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "harga", label: "Harga BBM" },
  { id: "info", label: "Info" },
];

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

export default function StationDetail({
  station,
  distance,
  onBack,
  onReported,
}: {
  station: StationDTO;
  distance: number | null;
  onBack: () => void;
  onReported: () => void;
}) {
  const fuels = stationFuels(station);
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [reporting, setReporting] = useState<"queue" | "stock" | null>(null);
  const [sharing, setSharing] = useState(false);
  const reportBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reporting) reportBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [reporting]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali ke daftar SPBU"
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-900"
          >
            <BackIcon />
          </button>
          <span className="text-sm font-semibold text-slate-600">Daftar SPBU</span>
        </div>
        <h2 className="mt-1 text-xl leading-snug font-bold text-slate-900">{station.name}</h2>
        <p className="mt-0.5 text-sm text-slate-600">{station.address ?? station.regency}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <OpenBadge hours={station.openingHours} is24h={station.is24h} />
          {distance !== null && (
            <span className="rounded bg-blue-50 px-2 py-0.5 font-bold text-blue-900">
              {formatDistance(distance)}
            </span>
          )}
          <CategoryBadge category={station.category} />
          {station.isGes && <GesBadge />}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Bagian detail SPBU" className="flex shrink-0 gap-1 border-b border-slate-200 px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 flex-1 border-b-4 px-2 text-sm font-bold ${
              tab === t.id ? "border-blue-900 text-blue-900" : "border-transparent text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        {tab === "ringkasan" && (
          <>
            <section className={card}>
              <h3 className="text-sm font-bold text-slate-900">Antrean</h3>
              <div className="mt-2">
                <QueueBadge status={station.queue.status} />
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {reportedText(station.queue)}
                {station.queue.confidence === "low" && " (baru 1 laporan, kurang pasti)"}
              </p>
            </section>

            <section className={card}>
              <h3 className="text-sm font-bold text-slate-900">Stok BBM</h3>
              {fuels.length === 0 ? (
                <p className="mt-1 text-sm text-slate-700">Belum ada laporan stok untuk SPBU ini.</p>
              ) : (
                <ul className="mt-1 divide-y divide-slate-100">
                  {fuels.map((fuel) => {
                    const st = station.stock[fuel];
                    return (
                      <li key={fuel} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="font-semibold">{FUEL_LABEL[fuel]}</span>
                        <span className="text-right">
                          <StockBadge status={st?.status ?? "unknown"} />
                          {st && st.reportCount > 0 && (
                            <span className="mt-0.5 block text-xs text-slate-600">{reportedText(st)}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-xs text-slate-600">
                &quot;Belum terkonfirmasi&quot; berarti baru sedikit pelapor. Itu bukan berarti BBM habis.
              </p>
            </section>

            <div ref={reportBox}>
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
                    className="min-h-14 rounded-2xl border-2 border-blue-900 bg-white px-2 text-base font-bold text-blue-900"
                  >
                    Laporkan antrean
                  </button>
                  <button
                    type="button"
                    onClick={() => setReporting("stock")}
                    className="min-h-14 rounded-2xl border-2 border-blue-900 bg-white px-2 text-base font-bold text-blue-900"
                  >
                    Laporkan stok
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "harga" && (
          <>
            <section className={card}>
              <h3 className="text-sm font-bold text-slate-900">BBM yang dijual</h3>
              <p className="mt-1 text-sm">
                <FuelsSold
                  fuels={station.fuels}
                  complete={station.fuelsComplete}
                  fromUsers={station.fuelsFromUsers}
                  label={false}
                />
              </p>
            </section>
            <ul className="grid grid-cols-2 gap-2">
              {FUEL_ORDER.map((fuel) => {
                const sold = station.fuels.includes(fuel);
                const notSold = station.fuelsComplete && !sold;
                return (
                  <li key={fuel} className={`${card} p-3`}>
                    <span className="block text-sm font-bold text-slate-900">{FUEL_LABEL[fuel]}</span>
                    <span className="block text-lg font-bold text-blue-900">
                      {priceOf(fuel) !== null ? rupiah(priceOf(fuel) as number) : "-"}
                    </span>
                    <span
                      className={`block text-xs font-semibold ${
                        sold ? "text-green-800" : "text-slate-500"
                      }`}
                    >
                      {sold ? "✓ Dijual" : notSold ? "Tidak dijual" : "Belum diketahui"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-slate-600">
              Harga resmi {FUEL_PRICES.region} per {asOfText(FUEL_PRICES.asOf)} (sumber: {FUEL_PRICES.source}).
              Bisa berubah dan berbeda di Pertashop.
            </p>
          </>
        )}

        {tab === "info" && (
          <>
            <dl className={`${card} space-y-3 text-sm`}>
              <div>
                <dt className="text-xs font-semibold text-slate-500">Kode resmi</dt>
                <dd className="font-bold text-slate-900">
                  {station.pertaminaCode ? (
                    <span className="font-mono">{station.pertaminaCode}</span>
                  ) : (
                    <span className="font-normal text-slate-600">belum diketahui</span>
                  )}
                </dd>
                {station.pertaminaCode && (
                  <dd className="text-xs text-slate-600">
                    Kode dari daftar Pertamina atau input pengelola. Jika ragu, periksa papan di lokasi.
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">Jenis</dt>
                <dd className="font-bold text-slate-900">
                  {CATEGORY_LABEL[station.category]}
                  {station.isGes && " · Green Energy Station (GES)"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">Alamat</dt>
                <dd className="text-slate-900">{station.address ?? "-"}</dd>
                <dd className="text-slate-600">{station.regency}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">Jam buka</dt>
                <dd className="text-slate-900">
                  {station.is24h ? "24 jam" : (station.openingHours ?? "Belum diketahui")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">Fasilitas</dt>
                <dd className="text-slate-600">Belum ada data fasilitas.</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-600">
              Data berasal dari laporan warga dan bersifat indikatif. Bukan informasi resmi Pertamina. Lokasi
              SPBU dari OpenStreetMap (ODbL).
            </p>
          </>
        )}
      </div>

      {/* Sticky actions */}
      <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white/95 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <a
          href={routeUrl(station.lat, station.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-2xl bg-blue-900 px-4 text-base font-bold text-white"
        >
          <NavIcon />
          Rute
        </a>
        <button
          type="button"
          onClick={() => setSharing(true)}
          className="min-h-12 flex-1 rounded-2xl border-2 border-blue-900 bg-white px-2 text-base font-bold text-blue-900"
        >
          Bagikan
        </button>
      </div>

      {sharing && (
        <ShareDialog
          url={`${window.location.origin}/?spbu=${station.id}`}
          title={station.name}
          text="Lihat antrean dan stok BBM SPBU ini di SPBU Watch SARBAGITA."
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
