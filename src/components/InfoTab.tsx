"use client";

import Link from "next/link";
import type { OfficialUpdateDTO } from "@/lib/api-types";
import {
  DOMINANCE,
  GEOFENCE_M,
  MIN_DEVICES_FOR_OUT,
  QUEUE_TTL_MIN,
  REPORT_COOLDOWN_MIN,
  STOCK_TTL_MIN,
} from "@/lib/config";
import { useRefreshing } from "@/lib/use-refreshing";
import { countText } from "@/lib/visits-format";
import { OfficialList } from "./OfficialPanel";
import SiteFooter from "./SiteFooter";
import { Legend } from "./StatusBits";
import { PhoneIcon, ShareIcon } from "./ui";

const h2 = "mb-2 text-base font-bold text-slate-900";

export default function InfoTab({
  updates,
  updatedAt,
  onShare,
}: {
  updates: OfficialUpdateDTO[];
  updatedAt: Date | null;
  onShare: () => void;
}) {
  const stats = useRefreshing<{ today: number | null; online: number | null }>(
    "/api/stats",
    (j: { today: number | null; online: number | null }) => j,
    { today: null, online: null },
  );
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
        {stats.data.online !== null && stats.data.today !== null && (
          <p className="tnum text-sm text-slate-700">
            <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-status-smooth" />
            <b>{countText(stats.data.online)}</b> online · <b>{countText(stats.data.today)}</b> pengunjung hari ini
          </p>
        )}
      </section>

      <SiteFooter withDisclaimer updatedAt={updatedAt} className="border-t border-line px-0 pt-4" />
      <p className="text-center">
        <Link href="/admin" className="inline-flex min-h-11 items-center text-xs text-slate-500 underline">
          Masuk admin
        </Link>
      </p>
    </div>
  );
}
