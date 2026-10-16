import { CATEGORY_LABEL, type StationCategory } from "@/lib/category";
import type { Fuel, QueueState, StockState } from "@/lib/status";
import { QUEUE_LABEL, STOCK_LABEL, soldFuelsText } from "@/lib/format";
import { effectiveOpen, type OpenReportLike } from "@/lib/hours";
import { GES_SOURCE } from "@/lib/text";
import { CheckCircleIcon } from "./ui";

const QUEUE_STYLE: Record<QueueState, { cls: string; bars: number }> = {
  sepi: { cls: "bg-status-smooth text-white", bars: 1 },
  sedang: { cls: "bg-status-moderate text-white", bars: 2 },
  panjang: { cls: "bg-status-critical text-white", bars: 3 },
  unknown: { cls: "bg-status-stale text-white", bars: 0 },
};

/** Bars (1/2/3) plus a text label, so the status never depends on colour alone. */
export function QueueBadge({ status }: { status: QueueState }) {
  const { cls, bars } = QUEUE_STYLE[status];
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${cls}`}
    >
      <span aria-hidden className="flex items-end gap-0.5">
        {bars === 0 ? (
          <span className="text-base leading-none">?</span>
        ) : (
          Array.from({ length: bars }, (_, i) => (
            <span key={i} className="w-1 rounded-sm bg-white" style={{ height: 6 + i * 4 }} />
          ))
        )}
      </span>
      {QUEUE_LABEL[status]}
    </span>
  );
}

const STOCK_STYLE: Record<StockState, { cls: string; icon: string }> = {
  available: { cls: "bg-status-smooth-bg text-status-smooth border-status-smooth", icon: "✓" },
  out: { cls: "bg-status-critical text-white border-status-critical", icon: "✕" },
  unconfirmed: { cls: "bg-status-stale-bg text-slate-800 border-slate-400", icon: "?" },
  conflicting: { cls: "bg-status-stale-bg text-slate-800 border-slate-400", icon: "≠" },
  unknown: { cls: "bg-status-stale-bg text-status-stale border-line", icon: "–" },
};

export function StockBadge({ status }: { status: StockState }) {
  const { cls, icon } = STOCK_STYLE[status];
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-bold ${cls}`}
    >
      <span aria-hidden>{icon}</span>
      {STOCK_LABEL[status]}
    </span>
  );
}

const QUEUE_TONE: Record<QueueState, { block: string; tile: string; text: string; dot: string }> = {
  sepi: {
    block: "border-status-smooth/40 bg-status-smooth-bg",
    tile: "bg-status-smooth-bg text-status-smooth",
    text: "text-status-smooth",
    dot: "bg-status-smooth",
  },
  sedang: {
    block: "border-status-moderate/40 bg-status-moderate-bg",
    tile: "bg-status-moderate-bg text-status-moderate",
    text: "text-status-moderate",
    dot: "bg-status-moderate",
  },
  panjang: {
    block: "border-status-critical/40 bg-status-critical-bg",
    tile: "bg-status-critical-bg text-status-critical",
    text: "text-status-critical",
    dot: "bg-status-critical",
  },
  unknown: {
    block: "border-line bg-status-stale-bg",
    tile: "bg-status-stale-bg text-status-stale",
    text: "text-status-stale",
    dot: "bg-status-stale",
  },
};

export const queueTone = (status: QueueState) => QUEUE_TONE[status];

/** 1/2/3 bars or "?" inside a coloured disc: the queue level without relying on colour. */
export function QueueBars({ status }: { status: QueueState }) {
  const { bars } = QUEUE_STYLE[status];
  return (
    <span aria-hidden className="flex items-end gap-0.5">
      {bars === 0 ? (
        <span className="text-base leading-none font-bold">?</span>
      ) : (
        Array.from({ length: bars }, (_, i) => (
          <span key={i} className="w-1 rounded-sm bg-white" style={{ height: 6 + i * 4 }} />
        ))
      )}
    </span>
  );
}

/** Queue status as a tinted block: level, how many reported (pill), and who reported when. */
export function QueueBlock({ status, text, pill }: { status: QueueState; text: string; pill?: string }) {
  const tone = QUEUE_TONE[status];
  return (
    <div className={`space-y-1.5 rounded-xl border p-3 ${tone.block}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-white ${tone.dot}`}>
            <QueueBars status={status} />
          </span>
          <span className={`text-base font-bold ${tone.text}`}>{QUEUE_LABEL[status]}</span>
        </div>
        {pill && (
          <span className={`shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-sm ${tone.text}`}>
            {pill}
          </span>
        )}
      </div>
      <p className="flex items-start gap-1.5 text-sm text-slate-700">
        <span className={`mt-0.5 shrink-0 scale-75 ${tone.text}`}>
          <CheckCircleIcon />
        </span>
        <span>{text}</span>
      </p>
    </div>
  );
}

export function Legend() {
  return (
    <p className="text-xs leading-relaxed text-slate-700">
      <b>Antrean:</b> 1 batang = sepi, 2 = sedang, 3 = panjang, ? = belum ada laporan terbaru.{" "}
      <b>✕</b> merah = stok BBM habis (terkonfirmasi beberapa pelapor). Bulat = SPBU, kotak = Pertashop. Warna kelompok pin = status terbanyak di dalamnya (abu-abu = belum ada laporan). Pin pudar = SPBU yang sedang tutup menurut jam bukanya.
    </p>
  );
}

const CATEGORY_STYLE: Record<StationCategory, string> = {
  spbu: "bg-primary text-white",
  pertashop: "bg-violet-700 text-white",
  spbuk: "bg-teal-700 text-white",
  spbbk: "bg-orange-700 text-white",
  spbun: "bg-cyan-700 text-white",
  spdn: "bg-sky-700 text-white",
};

/** Station type, always shown as text so it never relies on colour alone. */
export function CategoryBadge({ category }: { category: StationCategory }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-bold ${CATEGORY_STYLE[category]}`}>
      {CATEGORY_LABEL[category]}
    </span>
  );
}

/** Green Energy Station (per the official GES list). */
export function GesBadge() {
  return (
    <span
      title={`Green Energy Station, menurut ${GES_SOURCE}`}
      className="rounded border border-secondary bg-secondary-container/50 px-2 py-0.5 text-xs font-bold text-on-secondary-container"
    >
      GES
    </span>
  );
}

/** Fuels sold (a static fact). Says plainly when the list is unknown, partial or comes from users. */
export function FuelsSold({
  fuels,
  complete,
  fromUsers = [],
  label = true,
}: {
  fuels: Fuel[];
  complete: boolean;
  fromUsers?: Fuel[];
  label?: boolean;
}) {
  const text = soldFuelsText({ fuels });
  if (!text) return <span className="text-slate-600">{label ? "BBM: " : ""}belum diketahui</span>;
  const userText = soldFuelsText({ fuels: fromUsers });
  return (
    <span className="text-slate-800">
      {label && "BBM: "}
      <b>{text}</b>
      {userText && <span className="text-slate-600"> ({userText}: dilaporkan pengguna)</span>}
      {!complete && <span className="text-slate-600"> · daftar mungkin belum lengkap</span>}
    </span>
  );
}

/** Open / closed now (WITA): the opening hours when known and understood, overruled by confirmed reports. */
export function OpenBadge({
  hours,
  is24h,
  report,
}: {
  hours: string | null;
  is24h: boolean;
  report?: OpenReportLike;
}) {
  const o = effectiveOpen({ openingHours: hours, is24h, open: report });
  if (o.state === "unknown") return null;
  const cls = o.state === "open" ? "bg-secondary-container text-on-secondary-container" : "bg-slate-200 text-slate-800";
  return <span className={`rounded px-2 py-0.5 font-bold ${cls}`}>{o.state === "open" ? "✓ " : "✕ "}{o.label}</span>;
}
