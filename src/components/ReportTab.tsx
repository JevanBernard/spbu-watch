"use client";

import { useMemo, useState } from "react";
import type { StationDTO } from "@/lib/api-types";
import { GEOFENCE_M } from "@/lib/config";
import { distanceM, formatDistance } from "@/lib/format";
import ReportFlow from "./ReportFlow";
import { CategoryBadge, QueueBadge } from "./StatusBits";
import { LocateIcon } from "./ui";

type Kind = "queue" | "stock";
type Coords = { lat: number; lng: number };

/**
 * "Lapor" tab: shows only the stations within the report radius of the visitor (the server rejects anything
 * farther anyway), so reporting is two taps: pick the station you are at, then the kind of report.
 */
export default function ReportTab({
  stations,
  me,
  geoMsg,
  onLocate,
  onReported,
  onGoMap,
}: {
  stations: StationDTO[];
  me: Coords | null;
  geoMsg: string | null;
  onLocate: () => void;
  onReported: () => void;
  onGoMap: () => void;
}) {
  const [stationId, setStationId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);

  const nearby = useMemo(
    () =>
      me
        ? stations
            .map((s) => ({ station: s, distance: distanceM(me, s) }))
            .filter((x) => x.distance <= GEOFENCE_M)
            .sort((a, b) => a.distance - b.distance)
        : [],
    [stations, me],
  );
  const picked = stationId ? (stations.find((s) => s.id === stationId) ?? null) : null;
  const pickedDistance = picked && me ? distanceM(me, picked) : null;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pt-4 pb-8">
      <header>
        <h2 className="text-xl font-bold text-slate-900">Lapor kondisi SPBU</h2>
        <p className="text-sm text-slate-700">
          Pilih SPBU tempat Anda berada sekarang. Hanya SPBU dalam radius {GEOFENCE_M} meter yang bisa dilaporkan.
        </p>
      </header>

      {!me && (
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Kami perlu tahu SPBU mana yang dekat dengan Anda</p>
          <p className="text-xs text-slate-600">
            Lokasi hanya dipakai sementara untuk mencari SPBU terdekat dan memeriksa jarak. Tidak disimpan.
          </p>
          <button
            type="button"
            onClick={onLocate}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white"
          >
            <LocateIcon />
            Izinkan lokasi
          </button>
          {geoMsg && <p className="text-xs text-slate-700">{geoMsg}</p>}
        </div>
      )}

      {me && !picked && (
        <>
          {nearby.length > 0 ? (
            <ul className="space-y-3" aria-label={`SPBU dalam radius ${GEOFENCE_M} meter`}>
              {nearby.map(({ station: s, distance }) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setStationId(s.id)}
                    className="w-full space-y-1.5 rounded-2xl border border-line bg-white p-3 text-left shadow-sm active:bg-slate-50"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-base leading-snug font-bold text-slate-900">{s.name}</span>
                      <span className="tnum shrink-0 rounded bg-primary-fixed px-2 py-0.5 text-xs font-bold text-primary">
                        {formatDistance(distance)}
                      </span>
                    </span>
                    <span className="block text-sm text-slate-600">{s.address ?? s.regency}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <CategoryBadge category={s.category} />
                      <QueueBadge status={s.queue.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Belum ada SPBU dalam radius {GEOFENCE_M} meter</p>
              <p className="text-sm text-slate-700">
                Laporan hanya diterima dari orang yang berada di dekat SPBU. Jika Anda sudah di SPBU, tunggu GPS
                menemukan posisi lalu perbarui lokasi.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onLocate}
                  className="min-h-12 rounded-2xl bg-primary px-2 text-sm font-bold text-white"
                >
                  Perbarui lokasi
                </button>
                <button
                  type="button"
                  onClick={onGoMap}
                  className="min-h-12 rounded-2xl border-2 border-primary px-2 text-sm font-bold text-primary"
                >
                  Lihat peta
                </button>
              </div>
              {geoMsg && <p className="text-xs text-slate-700">{geoMsg}</p>}
            </div>
          )}
          {nearby.length > 0 && (
            <button type="button" onClick={onLocate} className="min-h-11 text-sm font-bold text-primary">
              Perbarui lokasi
            </button>
          )}
        </>
      )}

      {picked && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-line bg-white p-3 shadow-sm">
            <p className="text-base font-bold text-slate-900">{picked.name}</p>
            <p className="text-sm text-slate-600">
              {picked.address ?? picked.regency}
              {pickedDistance !== null && ` · ${formatDistance(pickedDistance)} dari Anda`}
            </p>
            <button
              type="button"
              onClick={() => {
                setStationId(null);
                setKind(null);
              }}
              className="mt-1 min-h-11 text-sm font-bold text-primary"
            >
              Ganti SPBU
            </button>
          </div>

          {kind && me ? (
            <ReportFlow
              key={`${picked.id}-${kind}`}
              station={picked}
              kind={kind}
              knownCoords={me}
              onClose={() => setKind(null)}
              onDone={onReported}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind("queue")}
                className="min-h-16 rounded-2xl bg-primary px-2 text-base font-bold text-white"
              >
                Laporkan antrean
              </button>
              <button
                type="button"
                onClick={() => setKind("stock")}
                className="min-h-16 rounded-2xl border-2 border-primary bg-white px-2 text-base font-bold text-primary"
              >
                Laporkan stok
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
