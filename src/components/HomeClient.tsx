"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OfficialUpdateDTO, StationDTO } from "@/lib/api-types";
import { distanceM, matchesFuelFilter, matchesSearch } from "@/lib/format";
import type { Fuel } from "@/lib/status";
import type { StationCategory } from "@/lib/category";
import OfficialPanel from "./OfficialPanel";
import StationDetail from "./StationDetail";
import StationList, { type ListItem } from "./StationList";
import { Legend } from "./StatusBits";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100" />,
});

const REFRESH_MS = 60_000;
const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL;
const REGENCIES = ["Denpasar", "Badung", "Gianyar", "Tabanan"];
export const DISCLAIMER =
  "Data berasal dari laporan warga dan bersifat indikatif. Bukan informasi resmi Pertamina. Cek kanal resmi untuk kepastian.";

function useRefreshing<T>(url: string, pick: (json: never) => T, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      setData(pick((await res.json()) as never));
      setUpdatedAt(new Date());
      setError(false);
    } catch {
      setError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      load();
      timer = setInterval(load, REFRESH_MS);
    };
    const stop = () => clearInterval(timer);
    const onVisibility = () => {
      stop();
      if (document.visibilityState === "visible") start();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  return { data, error, updatedAt, reload: load };
}

export default function HomeClient() {
  const stationsQ = useRefreshing<StationDTO[]>(
    "/api/stations",
    (j: { stations: StationDTO[] }) => j.stations,
    [],
  );
  const officialQ = useRefreshing<OfficialUpdateDTO[]>(
    "/api/official",
    (j: { updates: OfficialUpdateDTO[] }) => j.updates,
    [],
  );
  const stations = stationsQ.data;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [regency, setRegency] = useState("");
  const [only24h, setOnly24h] = useState(false);
  const [fuelFilter, setFuelFilter] = useState<Fuel | "">("");
  const [kind, setKind] = useState<"" | StationCategory | "ges">("");
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoMsg("Peramban ini tidak mendukung lokasi.");
      return;
    }
    setGeoMsg("Mencari lokasi…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Kept in memory only, used to sort the list. Never sent to the server.
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoMsg(null);
      },
      () =>
        setGeoMsg("Lokasi tidak diizinkan. Daftar diurutkan menurut nama. Anda tetap bisa mencari SPBU."),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  // Sorted by distance or name only, never by availability (anti-panic rule).
  const items: ListItem[] = useMemo(() => {
    const list = stations
      .filter((s) => matchesSearch(s, search))
      .filter((s) => !regency || s.regency === regency)
      .filter((s) => !only24h || s.is24h)
      .filter((s) => matchesFuelFilter(s, fuelFilter))
      .filter((s) => !kind || (kind === "ges" ? s.isGes : s.category === kind))
      .map((s) => ({ station: s, distance: me ? distanceM(me, s) : null }));
    list.sort((a, b) =>
      me
        ? (a.distance ?? 0) - (b.distance ?? 0)
        : a.station.name.localeCompare(b.station.name, "id"),
    );
    return list;
  }, [stations, search, regency, only24h, kind, fuelFilter, me]);

  const selected = selectedId ? (stations.find((s) => s.id === selectedId) ?? null) : null;

  const select = (id: string) => {
    scroller.current?.scrollTo({ top: 0 });
    setSelectedId(id);
    setSheetOpen(true);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapView
          stations={stations}
          selectedId={selectedId}
          userLocation={me}
          onSelect={select}
        />
      </div>

      {/* Top: disclaimer + official panel, above the station list */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2 p-2 md:left-4 md:right-auto md:w-96 md:p-4">
        <div className="pointer-events-auto rounded-lg bg-yellow-100 px-3 py-2 text-xs font-semibold text-yellow-950 shadow-md">
          <span className="font-bold">SPBU Watch SARBAGITA.</span> {DISCLAIMER}
        </div>
        <div className="pointer-events-auto">
          <OfficialPanel updates={officialQ.data} />
        </div>
      </div>

      {/* Bottom sheet (mobile) / left panel (desktop) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t border-slate-300 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.2)] transition-[height] duration-200 md:bottom-4 md:left-4 md:right-auto md:w-96 md:rounded-2xl md:border ${
          sheetOpen ? "h-[78dvh] md:h-[calc(100dvh-8rem)]" : "h-[34dvh] md:h-[34dvh]"
        }`}
      >
        <button
          type="button"
          onClick={() => setSheetOpen((o) => !o)}
          aria-label={sheetOpen ? "Perkecil daftar" : "Perbesar daftar"}
          className="flex min-h-11 w-full shrink-0 items-center justify-center"
        >
          <span className="h-1.5 w-12 rounded-full bg-slate-400" />
        </button>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {selected ? (
            <StationDetail
              station={selected}
              onBack={() => setSelectedId(null)}
              onReported={stationsQ.reload}
            />
          ) : (
            <>
              <div className="space-y-2 px-4 pb-2">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSheetOpen(true)}
                  placeholder="Cari nama SPBU atau daerah"
                  aria-label="Cari SPBU"
                  className="min-h-11 w-full rounded-md border border-slate-400 px-3 text-base"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={regency}
                    onChange={(e) => setRegency(e.target.value)}
                    aria-label="Filter kabupaten/kota"
                    className="min-h-11 rounded-md border border-slate-400 bg-white px-2 text-sm"
                  >
                    <option value="">Semua wilayah</option>
                    {REGENCIES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as typeof kind)}
                    aria-label="Filter jenis"
                    className="min-h-11 rounded-md border border-slate-400 bg-white px-2 text-sm"
                  >
                    <option value="">Semua jenis</option>
                    <option value="spbu">SPBU</option>
                    <option value="pertashop">Pertashop</option>
                    <option value="spbuk">SPBUK</option>
                    <option value="spbbk">SPBBK</option>
                    <option value="spbun">SPBUN</option>
                    <option value="ges">GES</option>
                  </select>
                  <select
                    value={fuelFilter}
                    onChange={(e) => setFuelFilter(e.target.value as Fuel | "")}
                    aria-label="Filter jenis BBM yang dijual"
                    className="min-h-11 rounded-md border border-slate-400 bg-white px-2 text-sm"
                  >
                    <option value="">Semua BBM</option>
                    <option value="pertalite">Menjual Pertalite</option>
                    <option value="pertamax">Menjual Pertamax</option>
                    <option value="solar">Menjual Solar</option>
                  </select>
                  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={only24h}
                      onChange={(e) => setOnly24h(e.target.checked)}
                      className="size-5"
                    />
                    24 jam
                  </label>
                  <button
                    type="button"
                    onClick={locate}
                    className="min-h-11 rounded-md border border-blue-900 px-3 text-sm font-bold text-blue-900"
                  >
                    {me ? "Perbarui lokasi" : "Urutkan dari lokasi saya"}
                  </button>
                </div>
                {geoMsg && <p className="text-xs text-slate-700">{geoMsg}</p>}
                {fuelFilter && (
                  <p className="text-xs text-slate-700">
                    Filter BBM memakai data jenis BBM yang dijual SPBU, bukan stok saat ini. SPBU yang
                    jenis BBM-nya belum diketahui tetap ditampilkan.
                  </p>
                )}
                <details className="text-xs text-slate-700">
                  <summary className="min-h-8 cursor-pointer py-1 font-semibold">
                    Keterangan tanda
                  </summary>
                  <div className="space-y-1 pb-1">
                    <p>
                      Diurutkan menurut {me ? "jarak" : "nama"}. Lokasi Anda hanya dipakai di
                      perangkat ini dan tidak disimpan.
                    </p>
                    <Legend />
                  </div>
                </details>
                {stationsQ.error && (
                  <p className="rounded bg-red-100 p-2 text-sm font-semibold text-red-900">
                    Gagal memuat data terbaru. Mencoba lagi otomatis.
                  </p>
                )}
              </div>
              <StationList items={items} onSelect={select} />
            </>
          )}

          <footer className="space-y-1 border-t border-slate-200 px-4 py-4 text-xs text-slate-600">
            <p>{DISCLAIMER}</p>
            <p>
              Peta © MapTiler · © OpenStreetMap contributors. Data SPBU dari OpenStreetMap
              (ODbL).
            </p>
            <p>
              Privasi: aplikasi menyimpan laporan antrean/stok, ID acak perangkat, dan hash IP.
              Tidak menyimpan koordinat lokasi, plat nomor, atau foto.{" "}
              <Link href="/privasi" className="font-bold underline">
                Selengkapnya
              </Link>
              {CONTACT_URL && (
                <>
                  {" · "}
                  <a href={CONTACT_URL} className="font-bold underline" rel="noopener noreferrer">
                    Kontak
                  </a>
                </>
              )}
            </p>
            {stationsQ.updatedAt && (
              <p>
                Diperbarui otomatis tiap 60 detik. Terakhir:{" "}
                {stationsQ.updatedAt.toLocaleTimeString("id-ID", { hour12: false })}
              </p>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
