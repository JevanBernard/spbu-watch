import { CATEGORY_LABEL, type StationCategory } from "@/lib/category";
import type { Fuel, QueueState, StockState } from "@/lib/status";
import { QUEUE_LABEL, STOCK_LABEL, soldFuelsText } from "@/lib/format";
import { openNow } from "@/lib/hours";

const QUEUE_STYLE: Record<QueueState, { cls: string; bars: number }> = {
  sepi: { cls: "bg-green-700 text-white", bars: 1 },
  sedang: { cls: "bg-amber-600 text-white", bars: 2 },
  panjang: { cls: "bg-red-700 text-white", bars: 3 },
  unknown: { cls: "bg-slate-500 text-white", bars: 0 },
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
  available: { cls: "bg-green-100 text-green-900 border-green-700", icon: "✓" },
  out: { cls: "bg-red-700 text-white border-red-900", icon: "✕" },
  unconfirmed: { cls: "bg-slate-100 text-slate-800 border-slate-400", icon: "?" },
  conflicting: { cls: "bg-slate-100 text-slate-800 border-slate-400", icon: "≠" },
  unknown: { cls: "bg-slate-100 text-slate-600 border-slate-300", icon: "–" },
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

export function Legend() {
  return (
    <p className="text-xs leading-relaxed text-slate-700">
      <b>Antrean:</b> 1 batang = sepi, 2 = sedang, 3 = panjang, ? = belum ada laporan terbaru.{" "}
      <b>✕</b> merah = stok BBM habis (terkonfirmasi beberapa pelapor). Bulat = SPBU, kotak = Pertashop.
    </p>
  );
}

const CATEGORY_STYLE: Record<StationCategory, string> = {
  spbu: "bg-blue-900 text-white",
  pertashop: "bg-violet-700 text-white",
  spbuk: "bg-teal-700 text-white",
  spbbk: "bg-orange-700 text-white",
  spbun: "bg-cyan-700 text-white",
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
      title="Green Energy Station"
      className="rounded border border-emerald-700 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900"
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
}: {
  fuels: Fuel[];
  complete: boolean;
  fromUsers?: Fuel[];
}) {
  const text = soldFuelsText({ fuels });
  if (!text) return <span className="text-slate-600">BBM: belum diketahui</span>;
  const userText = soldFuelsText({ fuels: fromUsers });
  return (
    <span className="text-slate-800">
      BBM: <b>{text}</b>
      {userText && <span className="text-slate-600"> ({userText}: dilaporkan pengguna)</span>}
      {!complete && <span className="text-slate-600"> · daftar mungkin belum lengkap</span>}
    </span>
  );
}

/** Open / closed now (WITA), from the opening hours when they are known and understood. */
export function OpenBadge({ hours, is24h }: { hours: string | null; is24h: boolean }) {
  const o = openNow(hours, is24h);
  if (o.state === "unknown") return null;
  const cls = o.state === "open" ? "bg-green-100 text-green-900" : "bg-slate-200 text-slate-800";
  return <span className={`rounded px-2 py-0.5 font-bold ${cls}`}>{o.state === "open" ? "✓ " : "✕ "}{o.label}</span>;
}
