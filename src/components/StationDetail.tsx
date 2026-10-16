import { useEffect, useRef, useState } from "react";
import type { StationDTO, StationTimelineDTO } from "@/lib/api-types";
import { CATEGORY_LABEL } from "@/lib/category";
import { FUEL_LABEL, FUEL_ORDER, formatDistance, reportedText } from "@/lib/format";
import { asOfText, FUEL_PRICES, priceOf, rupiah } from "@/lib/prices";
import { GES_SOURCE } from "@/lib/text";
import { TravelEstimate } from "./FeaturedStation";
import ReportFlow from "./ReportFlow";
import SiteFooter from "./SiteFooter";
import { FuelChips, SummaryTiles, Timeline24h } from "./StationInsights";
import ShareDialog from "./ShareDialog";
import { CategoryBadge, FuelsSold, GesBadge, OpenBadge, QueueBlock } from "./StatusBits";
import { BackIcon, NavIcon, ReportPinIcon, ShareIcon, routeUrl } from "./ui";

type Tab = "ringkasan" | "harga" | "info";
const TABS: { id: Tab; label: string }[] = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "harga", label: "Harga BBM" },
  { id: "info", label: "Info" },
];

const card = "rounded-2xl border border-line bg-white p-4 shadow-sm";

export default function StationDetail({
  station,
  distance,
  startReporting = false,
  onBack,
  onReported,
}: {
  station: StationDTO;
  distance: number | null;
  /** Open with the "what do you want to report?" choice already showing. */
  startReporting?: boolean;
  onBack: () => void;
  onReported: () => void;
}) {
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [reporting, setReporting] = useState<"choose" | "queue" | "stock" | null>(startReporting ? "choose" : null);
  const [sharing, setSharing] = useState(false);
  const reportBox = useRef<HTMLDivElement>(null);
  const [timeline, setTimeline] = useState<StationTimelineDTO | null | "error">(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stations/${station.id}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ timeline?: StationTimelineDTO }>;
      })
      .then((json) => {
        if (!cancelled) setTimeline(json.timeline ?? "error");
      })
      .catch(() => {
        if (!cancelled) setTimeline((cur) => cur ?? "error"); // keep the last good chart if a refresh fails
      });
    return () => {
      cancelled = true;
    };
  }, [station.id, reloadKey]);

  // After a report, the list refreshes and so does this station's history.
  const reported = () => {
    onReported();
    setReloadKey((k) => k + 1);
  };

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
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-slate-900"
          >
            <BackIcon />
          </button>
          <span className="flex-1 text-sm font-semibold text-slate-600">Daftar SPBU</span>
          <button
            type="button"
            onClick={() => setSharing(true)}
            aria-label="Bagikan SPBU ini (tautan & QR)"
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-primary"
          >
            <ShareIcon />
          </button>
        </div>
        <h2 className="mt-1 text-xl leading-snug font-bold text-slate-900">{station.name}</h2>
        <p className="mt-0.5 text-sm text-slate-600">{station.address ?? station.regency}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <OpenBadge hours={station.openingHours} is24h={station.is24h} />
          {distance !== null && (
            <span className="tnum rounded bg-primary-fixed px-2 py-0.5 font-bold text-primary">
              {formatDistance(distance)} · <TravelEstimate distance={distance} />
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
              tab === t.id ? "border-primary text-primary" : "border-transparent text-slate-600"
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
            <SummaryTiles station={station} timeline={timeline === "error" ? null : timeline} />

            <section className={card}>
              <h3 className="mb-2 text-sm font-bold text-slate-900">Stok BBM</h3>
              <FuelChips station={station} />
              <p className="mt-2 text-xs text-slate-600">
                &quot;Belum terkonfirmasi&quot; berarti baru sedikit pelapor. Itu bukan berarti BBM habis.
              </p>
            </section>

            <section className={card}>
              <h3 className="mb-2 text-sm font-bold text-slate-900">Antrean</h3>
              <QueueBlock
                status={station.queue.status}
                text={reportedText(station.queue)}
                pill={
                  station.queue.reportCount > 0
                    ? station.queue.confidence === "low"
                      ? "Kurang pasti"
                      : `${station.queue.reportCount} pelapor`
                    : undefined
                }
              />
            </section>

            <Timeline24h station={station} timeline={timeline} />

            <div ref={reportBox}>
              {reporting === "queue" || reporting === "stock" ? (
                <ReportFlow
                  key={reporting}
                  station={station}
                  kind={reporting}
                  onClose={() => setReporting(null)}
                  onDone={reported}
                />
              ) : reporting === "choose" ? (
                <section className={`${card} space-y-3 border-2 border-primary`}>
                  <h3 className="text-base font-bold text-slate-900">Apa yang ingin Anda laporkan?</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReporting("queue")}
                      className="min-h-14 rounded-2xl bg-primary px-2 text-base font-bold text-white"
                    >
                      Laporkan antrean
                    </button>
                    <button
                      type="button"
                      onClick={() => setReporting("stock")}
                      className="min-h-14 rounded-2xl border-2 border-primary bg-white px-2 text-base font-bold text-primary"
                    >
                      Laporkan stok
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReporting(null)}
                    className="min-h-11 w-full text-sm font-bold text-slate-600"
                  >
                    Batal
                  </button>
                </section>
              ) : null}
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
                    <span className="block text-lg font-bold text-primary">
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
                {station.isGes && <dd className="text-xs text-slate-600">Menurut {GES_SOURCE}.</dd>}
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
            <SiteFooter withDisclaimer className="px-0" />
          </>
        )}
      </div>

      {/* Sticky actions */}
      <div className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-line bg-white px-4 py-2 pb-2">
        <button
          type="button"
          onClick={() => {
            setTab("ringkasan");
            setReporting((r) => r ?? "choose");
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-3 text-base font-bold text-white shadow-sm active:opacity-90"
        >
          <ReportPinIcon />
          Lapor kondisi
        </button>
        <a
          href={routeUrl(station.lat, station.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-base font-bold text-white shadow-md active:opacity-90"
        >
          <NavIcon />
          Rute
        </a>
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
