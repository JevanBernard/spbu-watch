"use client";

import Link from "next/link";
import type { OfficialUpdateDTO } from "@/lib/api-types";
import {
  DOMINANCE,
  GEOFENCE_M,
  MIN_DEVICES_FOR_CLOSED,
  MIN_DEVICES_FOR_OUT,
  QUEUE_TTL_MIN,
  REPORT_COOLDOWN_MIN,
  STOCK_TTL_MIN,
} from "@/lib/config";
import type { SiteStats } from "@/lib/site-stats";
import { countText, sinceText } from "@/lib/visits-format";
import { OfficialList } from "./OfficialPanel";
import SiteFooter from "./SiteFooter";
import { Legend } from "./StatusBits";
import { PhoneIcon, ShareIcon } from "./ui";

function StatTile({ value, label, tone, sub }: { value: number | null; label: string; tone?: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3 text-center shadow-sm">
      <p className={`tnum text-2xl font-bold ${tone ?? "text-slate-900"}`}>{value === null ? "–" : countText(value)}</p>
      <p className="mt-0.5 text-xs leading-tight font-semibold text-slate-600">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{sub}</p>}
    </div>
  );
}

const h2 = "mb-2 text-base font-bold text-slate-900";

export default function InfoTab({
  updates,
  stats,
  updatedAt,
  onShare,
  adminActive,
  onAdminLogin,
  onAdminLogout,
}: {
  updates: OfficialUpdateDTO[];
  stats: SiteStats;
  updatedAt: Date | null;
  onShare: () => void;
  adminActive: boolean;
  onAdminLogin: () => void;
  onAdminLogout: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 pt-4 pb-8">
      <header>
        <h2 className="text-xl font-bold text-slate-900">Info</h2>
        <p className="text-sm text-slate-700">Pengumuman resmi dan cara membaca data di aplikasi ini.</p>
      </header>

      <a href="tel:135" className="flex min-h-14 items-center gap-3 rounded-2xl bg-primary px-4 text-white shadow-md">
        <PhoneIcon />
        <span className="flex-1">
          <span className="block text-base font-bold">Call Center Pertamina 135</span>
          <span className="block text-xs opacity-90">Kanal resmi untuk kepastian pasokan</span>
        </span>
      </a>

      {(stats.online !== null ||
        stats.today !== null ||
        stats.total !== null ||
        stats.reports24h !== null) && (
        <section aria-label="Statistik">
          <h2 className={h2}>Statistik</h2>
          <div className="grid grid-cols-2 gap-2">
            <StatTile value={stats.online} label="online sekarang" tone="text-status-smooth" />
            <StatTile value={stats.today} label="pengunjung hari ini" />
            {stats.total !== null && (
              <StatTile
                value={stats.total}
                label="total pengunjung"
                sub={stats.since ? `sejak ${sinceText(stats.since)}` : undefined}
              />
            )}
            <StatTile value={stats.reports24h?.total ?? null} label="laporan dalam 24 jam" tone="text-primary" />
          </div>
          {stats.total !== null && (
            <p className="mt-2 text-xs text-slate-600">
              Total pengunjung menjumlahkan pengunjung tiap hari. Orang yang kembali di hari lain dihitung lagi, karena
              kami sengaja tidak melacak pengunjung antarhari demi privasi.
            </p>
          )}
          {stats.reports24h && (
            <p className="tnum mt-2 text-xs text-slate-600">
              Laporan 24 jam terakhir: antrean {countText(stats.reports24h.queue)} · stok{" "}
              {countText(stats.reports24h.stock)} · buka/tutup {countText(stats.reports24h.open)}. Diperbarui
              tiap menit.
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className={h2}>Informasi resmi</h2>
        <OfficialList updates={updates} />
      </section>

      <section>
        <h2 className={h2}>Cara membaca status</h2>
        <div className="space-y-2 rounded-2xl border border-line bg-white p-4 text-sm text-slate-800">
          <Legend />
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Status antrean dihitung dari laporan {QUEUE_TTL_MIN} menit terakhir, stok BBM dari {STOCK_TTL_MIN} menit
              terakhir. Laporan yang lebih baru lebih berpengaruh.
            </li>
            <li>
              &quot;HABIS&quot; (merah) baru tampil jika minimal {MIN_DEVICES_FOR_OUT} perangkat berbeda melaporkannya
              (atau admin memantau langsung) dan mayoritas laporan (minimal {Math.round(DOMINANCE * 100)}%) sepakat.
              Selain itu tampil &quot;Belum terkonfirmasi&quot;, yang bukan berarti BBM habis.
            </li>
            <li>
              Laporan &quot;SPBU tutup&quot; diperlakukan seperti &quot;habis&quot;: baru tampil sebagai tutup setelah minimal{" "}
              {MIN_DEVICES_FOR_CLOSED} perangkat berbeda melaporkannya (atau admin memantau langsung). SPBU yang sedang tutup
              tampak pudar di peta. Jam buka tercatat dipakai bila belum ada laporan.
            </li>
            <li>
              Laporan hanya bisa dikirim dari jarak maksimal {GEOFENCE_M} meter dari SPBU, dengan jeda{" "}
              {REPORT_COOLDOWN_MIN} menit per jenis laporan.
            </li>
            <li>Data tidak diurutkan menurut ketersediaan stok. Daftar hanya diurutkan menurut jarak atau nama.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={h2}>Lainnya</h2>
        <button
          type="button"
          onClick={onShare}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-white font-bold text-primary"
        >
          <ShareIcon />
          Bagikan aplikasi (tautan &amp; QR)
        </button>
      </section>

      <SiteFooter withDisclaimer updatedAt={updatedAt} className="border-t border-line px-0 pt-4" />
      <div className="flex flex-col items-center gap-1 text-xs">
        {adminActive ? (
          <>
            <Link href="/admin" className="inline-flex min-h-11 items-center font-bold text-primary underline">
              Kelola info resmi dan moderasi laporan
            </Link>
            <button type="button" onClick={onAdminLogout} className="min-h-11 text-slate-600 underline">
              Keluar mode admin
            </button>
          </>
        ) : (
          <button type="button" onClick={onAdminLogin} className="min-h-11 text-slate-500 underline">
            Masuk mode admin
          </button>
        )}
      </div>
    </div>
  );
}
