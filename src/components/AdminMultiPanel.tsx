"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-session";
import { QUEUE_LABEL } from "@/lib/format";
import type { QueueState } from "@/lib/status";
import { queueTone } from "./StatusBits";

const OPTIONS: { level: number; state: Exclude<QueueState, "unknown">; short: string }[] = [
  { level: 0, state: "sepi", short: "Sepi" },
  { level: 1, state: "sedang", short: "Sedang" },
  { level: 2, state: "panjang", short: "Panjang" },
];

/**
 * Admin, several stations at once: set one queue level for all the stations picked on the map. Same rules as the
 * single-station block (admin observation, no geofence, can be undone); only the queue level, not stock, because
 * a stock "habis" must always be confirmed station by station.
 */
export default function AdminMultiPanel({
  token,
  ids,
  names,
  onSaved,
  onAuthFail,
  onClear,
}: {
  token: string;
  ids: string[];
  names: string[];
  onSaved: () => void;
  onAuthFail: () => void;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ reportIds: string[]; label: string; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async (level: number, state: Exclude<QueueState, "unknown">) => {
    setBusy(true);
    setError(null);
    const reportIds: string[] = [];
    let failed = 0;
    try {
      for (const stationId of ids) {
        const res = await adminFetch("/api/admin/reports", token, {
          method: "POST",
          body: JSON.stringify({ stationId, kind: "queue", queueLevel: level }),
        });
        if (res.status === 401) {
          onAuthFail();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        if (res.ok && data.id) reportIds.push(data.id);
        else failed++;
      }
      if (reportIds.length === 0) {
        setError("Tidak ada yang tersimpan. Coba lagi.");
      } else {
        setSaved({ reportIds, label: QUEUE_LABEL[state], failed });
        onSaved();
      }
    } catch {
      setError("Tidak ada koneksi. Sebagian mungkin belum tersimpan.");
      if (reportIds.length > 0) {
        setSaved({ reportIds, label: QUEUE_LABEL[state], failed: ids.length - reportIds.length });
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!saved) return;
    setBusy(true);
    setError(null);
    let failed = 0;
    try {
      for (const id of saved.reportIds) {
        const res = await adminFetch(`/api/admin/reports/${id}/hide`, token, { method: "POST" });
        if (res.status === 401) {
          onAuthFail();
          return;
        }
        if (!res.ok) failed++;
      }
      if (failed > 0) setError(`${failed} laporan gagal dibatalkan. Sembunyikan lewat halaman Moderasi.`);
      setSaved(null);
      onSaved();
    } catch {
      setError("Tidak ada koneksi. Belum dibatalkan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Edit banyak SPBU (admin)"
      className="space-y-2.5 rounded-2xl border-2 border-dashed border-primary bg-primary-fixed/30 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-primary">
            {ids.length === 0 ? "Pilih SPBU di peta" : `${ids.length} SPBU dipilih`}
          </h3>
          <p className="truncate text-xs text-slate-700">
            {ids.length === 0
              ? "Ketuk pin atau kartu untuk memilih. Ketuk lagi untuk membatalkan pilihan."
              : names.slice(0, 3).join(", ") + (names.length > 3 ? `, +${names.length - 3} lagi` : "")}
          </p>
        </div>
        {ids.length > 0 && (
          <button type="button" onClick={onClear} className="min-h-9 shrink-0 text-xs font-bold text-slate-700 underline">
            Kosongkan
          </button>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-bold text-slate-900">Antrean untuk semua yang dipilih</p>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.state}
              type="button"
              disabled={busy || ids.length === 0}
              onClick={() => apply(o.level, o.state)}
              className={`min-h-12 rounded-xl border-2 border-transparent px-1 text-sm font-bold disabled:opacity-40 ${queueTone(o.state).tile}`}
            >
              {o.short}
            </button>
          ))}
        </div>
      </div>

      {saved && (
        <p role="status" className="flex items-center justify-between gap-2 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white">
          <span>
            Tersimpan: {saved.label} untuk {saved.reportIds.length} SPBU
            {saved.failed > 0 ? `, ${saved.failed} gagal` : ""}
          </span>
          <button type="button" onClick={undo} disabled={busy} className="min-h-11 shrink-0 rounded-lg px-2 font-bold underline disabled:opacity-50">
            Urungkan
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-status-critical">
          {error}
        </p>
      )}
    </section>
  );
}
