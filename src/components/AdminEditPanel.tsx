"use client";

import { useState } from "react";
import type { StationDTO } from "@/lib/api-types";
import { adminFetch } from "@/lib/admin-session";
import { FUEL_LABEL, FUEL_ORDER, QUEUE_LABEL, STOCK_LABEL } from "@/lib/format";
import type { Fuel, QueueState } from "@/lib/status";
import { queueTone } from "./StatusBits";

const QUEUE_OPTIONS: { level: number; state: Exclude<QueueState, "unknown">; short: string }[] = [
  { level: 0, state: "sepi", short: "Sepi" },
  { level: 1, state: "sedang", short: "Sedang" },
  { level: 2, state: "panjang", short: "Panjang" },
];

type Stock = "available" | "out";

interface Saved {
  id: string;
  label: string;
  /** What this report set, so "Urungkan" can take the highlight away again. */
  queue?: QueueState;
  fuel?: Fuel;
}

/**
 * Admin-only block on a station: set the queue level or a fuel's stock straight from the station you tapped on
 * the map. Reports are stored as admin observations (e.g. from CCTV), skip the geofence, and can be undone.
 * "Habis" asks for one more tap because an admin "habis" shows up red immediately.
 */
export default function AdminEditPanel({
  station,
  token,
  onSaved,
  onAuthFail,
}: {
  station: StationDTO;
  token: string;
  onSaved: () => void;
  onAuthFail: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState<Fuel | null>(null);
  // What the admin just set. Shown at once (the list refresh takes a moment); the server state is the fallback.
  const [mineQueue, setMineQueue] = useState<QueueState | null>(null);
  const [mineStock, setMineStock] = useState<Partial<Record<Fuel, Stock>>>({});

  const send = async (
    body: Record<string, unknown>,
    label: string,
    mark: { queue?: QueueState; fuel?: Fuel; stock?: Stock },
  ) => {
    setBusy(true);
    setError(null);
    setConfirmOut(null);
    try {
      const res = await adminFetch("/api/admin/reports", token, {
        method: "POST",
        body: JSON.stringify({ stationId: station.id, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.status === 401) {
        onAuthFail();
        return;
      }
      if (!res.ok || !data.id) {
        setError(data.error ?? "Gagal menyimpan. Coba lagi.");
        return;
      }
      setSaved({ id: data.id, label, queue: mark.queue, fuel: mark.fuel });
      if (mark.queue) setMineQueue(mark.queue);
      if (mark.fuel && mark.stock) setMineStock((m) => ({ ...m, [mark.fuel!]: mark.stock }));
      onSaved();
    } catch {
      setError("Tidak ada koneksi. Belum tersimpan.");
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!saved) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/reports/${saved.id}/hide`, token, { method: "POST" });
      if (res.status === 401) {
        onAuthFail();
        return;
      }
      if (!res.ok) {
        setError("Gagal membatalkan. Sembunyikan lewat halaman Moderasi.");
        return;
      }
      if (saved.queue) setMineQueue(null);
      const undoneFuel = saved.fuel;
      if (undoneFuel) {
        setMineStock((m) => {
          const next = { ...m };
          delete next[undoneFuel];
          return next;
        });
      }
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
      aria-label="Edit kondisi (admin)"
      className="space-y-3 rounded-2xl border-2 border-dashed border-primary bg-primary-fixed/30 p-3"
    >
      <div>
        <h3 className="text-sm font-bold text-primary">Edit kondisi (admin)</h3>
        <p className="text-xs text-slate-700">
          Tampil sebagai pengamatan admin dan tidak dibatasi jarak. Laporkan hanya yang benar-benar Anda lihat.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-900">Antrean sekarang</p>
        <div className="grid grid-cols-3 gap-2">
          {QUEUE_OPTIONS.map((o) => {
            const tone = queueTone(o.state);
            const active = (mineQueue ?? station.queue.status) === o.state;
            return (
              <button
                key={o.state}
                type="button"
                disabled={busy}
                aria-pressed={active}
                onClick={() => send({ kind: "queue", queueLevel: o.level }, QUEUE_LABEL[o.state], { queue: o.state })}
                className={`min-h-12 rounded-xl border-2 px-1 text-sm font-bold disabled:opacity-50 ${
                  active ? `${tone.dot} border-slate-900 text-white` : `${tone.tile} border-transparent`
                }`}
              >
                {active && "✓ "}
                {o.short}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setStockOpen((v) => !v)}
          aria-expanded={stockOpen}
          className="min-h-11 text-sm font-bold text-primary"
        >
          {stockOpen ? "Tutup stok BBM" : "Ubah stok BBM"}
        </button>
        {stockOpen && (
          <ul className="space-y-2">
            {FUEL_ORDER.map((fuel) => {
              const status = station.stock[fuel]?.status ?? "unknown";
              // Highlight: what the admin just set, else what the server currently shows as ada / habis.
              const current: Stock | null = mineStock[fuel] ?? (status === "available" || status === "out" ? status : null);
              return (
                <li key={fuel} className="rounded-xl bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900">{FUEL_LABEL[fuel]}</span>
                      <span className="block text-[11px] text-slate-600">
                        {mineStock[fuel] ? `Anda: ${mineStock[fuel] === "out" ? "habis" : "ada"} · ` : ""}
                        Sekarang: {STOCK_LABEL[status]}
                      </span>
                    </span>
                    {confirmOut !== fuel && (
                      <span className="flex shrink-0 gap-1.5" role="group" aria-label={`Stok ${FUEL_LABEL[fuel]}`}>
                        <button
                          type="button"
                          disabled={busy}
                          aria-pressed={current === "available"}
                          onClick={() =>
                            send({ kind: "stock", fuel, stockStatus: "available" }, `${FUEL_LABEL[fuel]} ada`, {
                              fuel,
                              stock: "available",
                            })
                          }
                          className={`min-h-11 min-w-16 rounded-lg border-2 px-3 text-sm font-bold disabled:opacity-50 ${
                            current === "available"
                              ? "border-slate-900 bg-status-smooth text-white"
                              : "border-status-smooth/50 bg-status-smooth-bg text-status-smooth"
                          }`}
                        >
                          {current === "available" && "✓ "}Ada
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          aria-pressed={current === "out"}
                          onClick={() => setConfirmOut(fuel)}
                          className={`min-h-11 min-w-16 rounded-lg border-2 px-3 text-sm font-bold disabled:opacity-50 ${
                            current === "out"
                              ? "border-slate-900 bg-status-critical text-white"
                              : "border-status-critical/50 bg-status-critical-bg text-status-critical"
                          }`}
                        >
                          {current === "out" && "✕ "}Habis
                        </button>
                      </span>
                    )}
                  </div>
                  {confirmOut === fuel && (
                    <div className="mt-2 space-y-2 rounded-lg bg-status-critical-bg p-2">
                      <p className="text-xs font-semibold text-status-critical">
                        Tandai {FUEL_LABEL[fuel]} HABIS? Ini langsung tampil merah untuk semua pengunjung.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            send({ kind: "stock", fuel, stockStatus: "out" }, `${FUEL_LABEL[fuel]} habis`, {
                              fuel,
                              stock: "out",
                            })
                          }
                          className="min-h-11 rounded-lg bg-status-critical text-sm font-bold text-white disabled:opacity-50"
                        >
                          Ya, habis
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmOut(null)}
                          className="min-h-11 rounded-lg border border-line bg-white text-sm font-bold text-slate-800"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {saved && (
        <p role="status" className="flex items-center justify-between gap-2 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white">
          <span>Tersimpan: {saved.label}</span>
          <button
            type="button"
            onClick={undo}
            disabled={busy}
            className="min-h-11 shrink-0 rounded-lg px-2 font-bold underline disabled:opacity-50"
          >
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
