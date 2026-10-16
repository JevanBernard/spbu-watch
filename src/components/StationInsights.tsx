"use client";

import { useState, type ReactNode } from "react";
import type { StationDTO, StationTimelineDTO } from "@/lib/api-types";
import { FUEL_LABEL, FUEL_ORDER, STOCK_LABEL, stationFuels, timeAgo } from "@/lib/format";
import { effectiveOpen } from "@/lib/hours";
import type { Fuel, QueueState, StockState } from "@/lib/status";
import { queueTone } from "./StatusBits";
import { ClockIcon, GasIcon, TimerIcon } from "./ui";

const hourFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Makassar" });

const QUEUE_SHORT: Record<QueueState, string> = { sepi: "Sepi", sedang: "Sedang", panjang: "Panjang", unknown: "Belum ada data" };

const STOCK_TONE: Record<StockState, { box: string; text: string; word: string }> = {
  available: { box: "border-status-smooth/40 bg-status-smooth-bg", text: "text-status-smooth", word: "Tersedia" },
  out: { box: "border-status-critical/40 bg-status-critical-bg", text: "text-status-critical", word: "HABIS" },
  unconfirmed: { box: "border-line bg-status-stale-bg", text: "text-slate-800", word: "Belum terkonfirmasi" },
  conflicting: { box: "border-line bg-status-stale-bg", text: "text-slate-800", word: "Laporan beragam" },
  unknown: { box: "border-line bg-status-stale-bg", text: "text-status-stale", word: "Belum ada laporan" },
};

function Tile({
  label,
  icon,
  value,
  sub,
  box = "border-line bg-white",
  valueCls = "text-slate-900",
}: {
  label: string;
  icon: ReactNode;
  value: string;
  sub?: string;
  box?: string;
  valueCls?: string;
}) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${box}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-600 uppercase">
        <span className="scale-75">{icon}</span>
        {label}
      </p>
      <p className={`mt-1 text-lg leading-tight font-bold ${valueCls}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-600">{sub}</p>}
    </div>
  );
}

/** Four tiles at the top of the station page: main fuel, open now, queue, and how many reports came in today. */
export function SummaryTiles({ station, timeline }: { station: StationDTO; timeline: StationTimelineDTO | null }) {
  const fuels = stationFuels(station);
  const main: Fuel | undefined = fuels.includes("pertalite") ? "pertalite" : fuels[0];
  const st = main ? station.stock[main] : undefined;
  const stockTone = STOCK_TONE[st?.status ?? "unknown"];
  const open = effectiveOpen(station);
  const rep = station.open;
  const q = station.queue;
  const qt = queueTone(q.status);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Tile
        label={main ? FUEL_LABEL[main] : "BBM"}
        icon={<GasIcon />}
        value={main ? stockTone.word : "Belum ada data"}
        sub={st && st.reportCount > 0 ? `${st.reportCount} pelapor · ${timeAgo(st.lastReportAt)}` : "Belum ada laporan"}
        box={stockTone.box}
        valueCls={stockTone.text}
      />
      <Tile
        label="Buka"
        icon={<ClockIcon />}
        value={open.state === "open" ? "Buka" : open.state === "closed" ? "Tutup" : "Belum diketahui"}
        sub={
          open.reported
            ? `${rep.reportCount} pelapor · ${timeAgo(rep.lastReportAt)}`
            : rep.status === "unconfirmed"
              ? "Ada laporan tutup, belum terkonfirmasi"
              : rep.status === "conflicting"
                ? "Laporan buka/tutup beragam"
                : station.is24h
                  ? "24 jam"
                  : (station.openingHours ?? undefined)
        }
        box={open.state === "closed" ? "border-slate-400 bg-status-stale-bg" : "border-line bg-white"}
        valueCls={open.state === "open" ? "text-status-smooth" : "text-slate-900"}
      />
      <Tile
        label="Antrean"
        icon={<TimerIcon />}
        value={QUEUE_SHORT[q.status]}
        sub={
          q.stale && q.lastReportAt
            ? `terakhir dipantau admin ${timeAgo(q.lastReportAt)}`
            : q.reportCount > 0
              ? `${q.reportCount} pelapor · ${timeAgo(q.lastReportAt)}`
              : "Belum ada laporan"
        }
        box={`border ${qt.block}`}
        valueCls={qt.text}
      />
      <Tile
        label="Laporan 24 jam"
        icon={<ClockIcon />}
        value={timeline ? String(timeline.reportCount) : "…"}
        sub="dari warga dan admin"
      />
    </div>
  );
}

const CHIP_ICON: Record<StockState, string> = { available: "✓", out: "✕", unconfirmed: "?", conflicting: "≠", unknown: "–" };

/** One compact chip per fuel: name on top, status icon and word, and how many reports it rests on. */
export function FuelChips({ station }: { station: StationDTO }) {
  const fuels = stationFuels(station);
  if (fuels.length === 0) return <p className="text-sm text-slate-700">Belum ada laporan stok untuk SPBU ini.</p>;
  return (
    <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {fuels.map((fuel) => {
        const st = station.stock[fuel];
        const status = st?.status ?? "unknown";
        const tone = STOCK_TONE[status];
        return (
          <li key={fuel} className="w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-white">
            <p className="bg-primary px-1 py-1 text-center text-xs font-bold text-white">{FUEL_LABEL[fuel]}</p>
            <div className={`flex flex-col items-center gap-0.5 px-1 py-2 ${tone.box}`}>
              <span aria-hidden className={`text-2xl leading-none font-bold ${tone.text}`}>
                {CHIP_ICON[status]}
              </span>
              <span className={`text-center text-[11px] leading-tight font-bold ${tone.text}`}>{STOCK_LABEL[status]}</span>
              <span className="text-[10px] text-slate-600">
                {st && st.reportCount > 0 ? `${st.reportCount} laporan` : "Belum ada"}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const BAR: Record<QueueState, { h: string; cls: string; label: string }> = {
  sepi: { h: "h-1/3", cls: "bg-status-smooth", label: "sepi" },
  sedang: { h: "h-2/3", cls: "bg-status-moderate", label: "sedang" },
  panjang: { h: "h-full", cls: "bg-status-critical", label: "panjang" },
  unknown: { h: "h-0.5", cls: "bg-line", label: "belum ada data" },
};

const CELL: Record<StockState, { cls: string; label: string }> = {
  available: { cls: "bg-status-smooth", label: "ada" },
  out: { cls: "bg-status-critical", label: "habis (terkonfirmasi)" },
  unconfirmed: {
    cls: "bg-[repeating-linear-gradient(45deg,#cbd5e1,#cbd5e1_3px,#f1f5f9_3px,#f1f5f9_6px)]",
    label: "belum terkonfirmasi",
  },
  conflicting: {
    cls: "bg-[repeating-linear-gradient(45deg,#cbd5e1,#cbd5e1_3px,#f1f5f9_3px,#f1f5f9_6px)]",
    label: "laporan beragam",
  },
  unknown: { cls: "bg-status-stale-bg border border-line", label: "belum ada laporan" },
};

/** 24-hour history: queue level as bars, and stock of one fuel as a row of hourly cells. */
export function Timeline24h({ station, timeline }: { station: StationDTO; timeline: StationTimelineDTO | null | "error" }) {
  // Fuels the station is known to sell, plus any that appear in the history (reported earlier today).
  const inHistory = timeline && timeline !== "error" ? timeline.slots.flatMap((sl) => Object.keys(sl.stock) as Fuel[]) : [];
  const options = FUEL_ORDER.filter((f) => stationFuels(station).includes(f) || inHistory.includes(f));
  const [picked, setPicked] = useState<Fuel | null>(null);
  const fuel = picked && options.includes(picked) ? picked : (options.includes("pertalite") ? "pertalite" : options[0]);

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm" aria-label="Riwayat 24 jam">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">24 jam terakhir</h3>
        {timeline && timeline !== "error" && (
          <span className="text-xs text-slate-600">{timeline.reportCount} laporan</span>
        )}
      </div>

      {timeline === null && <p className="text-sm text-slate-600">Memuat riwayat…</p>}
      {timeline === "error" && <p className="text-sm text-slate-700">Riwayat belum bisa dimuat. Coba lagi nanti.</p>}
      {timeline && timeline !== "error" && timeline.reportCount === 0 && (
        <p className="text-sm text-slate-700">Belum ada laporan dalam 24 jam terakhir, jadi belum ada grafik.</p>
      )}

      {timeline && timeline !== "error" && timeline.reportCount > 0 && (
        <>
          <div
            role="img"
            aria-label={`Antrean dan stok ${fuel ? FUEL_LABEL[fuel] : ""} tiap jam selama 24 jam terakhir`}
            className="space-y-2"
          >
            <div className="flex items-end gap-2">
              <span className="w-10 shrink-0 pb-0.5 text-[11px] font-semibold text-slate-600">Antre</span>
              <div className="grid h-16 flex-1 grid-cols-24 items-end gap-0.5 border-b border-line">
                {timeline.slots.map((s) => {
                  const b = BAR[s.queue];
                  return (
                    <div key={s.at} className="flex h-full items-end" title={`${hourFmt.format(new Date(s.at))} WITA: ${b.label}`}>
                      <div className={`w-full rounded-t-sm ${b.h} ${b.cls}`} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[11px] font-semibold text-slate-600">BBM</span>
              <div className="grid flex-1 grid-cols-24 gap-0.5">
                {timeline.slots.map((s) => {
                  const state = fuel ? (s.stock[fuel] ?? "unknown") : "unknown";
                  const c = CELL[state];
                  return (
                    <div
                      key={s.at}
                      className={`h-4 rounded-sm ${c.cls}`}
                      title={`${hourFmt.format(new Date(s.at))} WITA: ${fuel ? FUEL_LABEL[fuel] : ""} ${c.label}`}
                    />
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <span className="w-10 shrink-0" />
              <div className="relative h-4 flex-1 text-[10px] font-semibold text-slate-600">
                {[0, 8, 16].map((i) => (
                  <span key={i} className="absolute" style={{ left: `${(i / 24) * 100}%` }}>
                    {hourFmt.format(new Date(timeline.slots[i].at)).replace(":", ".")}
                  </span>
                ))}
                <span className="absolute right-0 text-slate-900">sekarang</span>
              </div>
            </div>
          </div>

          {options.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="BBM yang ditampilkan di grafik">
              {options.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={f === fuel}
                  onClick={() => setPicked(f)}
                  className={`min-h-9 rounded-full border px-3 text-xs font-bold ${
                    f === fuel ? "border-ink bg-ink text-white" : "border-line bg-white text-slate-800"
                  }`}
                >
                  {FUEL_LABEL[f]}
                </button>
              ))}
            </div>
          )}

          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-700" aria-label="Keterangan grafik">
            <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-status-smooth" />ada BBM</li>
            <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-status-critical" />habis (terkonfirmasi)</li>
            <li className="flex items-center gap-1">
              <span className={`size-2.5 rounded-sm ${CELL.unconfirmed.cls}`} />belum terkonfirmasi
            </li>
            <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-line bg-status-stale-bg" />belum ada laporan</li>
          </ul>
          <p className="text-[11px] text-slate-600">
            Kondisi per jam dari laporan warga, dengan aturan yang sama seperti status saat ini. Merah hanya untuk
            &quot;habis&quot; yang dikonfirmasi beberapa pelapor. Tinggi batang = panjang antrean.
          </p>
        </>
      )}
    </section>
  );
}
