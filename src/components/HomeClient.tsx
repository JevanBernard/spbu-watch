"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OfficialUpdateDTO, StationDTO } from "@/lib/api-types";
import type { StationCategory } from "@/lib/category";
import { getDeviceId } from "@/lib/device";
import { distanceM, matchesFuelFilter, matchesSearch } from "@/lib/format";
import type { Fuel } from "@/lib/status";
import { countText } from "@/lib/visits-format";
import OfficialPanel from "./OfficialPanel";
import ShareDialog from "./ShareDialog";
import StationCard from "./StationCard";
import StationDetail from "./StationDetail";
import StationList, { type ListItem } from "./StationList";
import { Legend } from "./StatusBits";
import { Chip, IconButton, LocateIcon, SearchIcon, ShareIcon, SlidersIcon } from "./ui";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100" />,
});

const REFRESH_MS = 60_000;
const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL;
const REGENCIES = ["Denpasar", "Badung", "Gianyar", "Tabanan"];
const CAROUSEL_COUNT = 10;
export const DISCLAIMER =
  "Data berasal dari laporan warga dan bersifat indikatif. Bukan informasi resmi Pertamina. Cek kanal resmi untuk kepastian.";

type Kind = "" | StationCategory | "ges";

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

const selectCls = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm";

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
  const statsQ = useRefreshing<{ today: number | null; online: number | null }>(
    "/api/stats",
    (j: { today: number | null; online: number | null }) => j,
    { today: null, online: null },
  );
  const [shareApp, setShareApp] = useState(false);

  // Anonymous visitor heartbeat: once on load, then every 2 minutes while the tab is visible.
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId() }),
        keepalive: true,
      }).catch(() => {});
    };
    beat();
    const t = setInterval(beat, 120_000);
    return () => clearInterval(t);
  }, []);

  // A shared link (?spbu=<id>) opens that station. Read lazily so there is no extra render.
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("spbu"),
  );
  // "peek": map first with the nearest stations as a carousel. "full": list or station detail.
  const [full, setFull] = useState(() =>
    typeof window === "undefined" ? false : new URLSearchParams(window.location.search).has("spbu"),
  );
  const [search, setSearch] = useState("");
  const [regency, setRegency] = useState("");
  const [only24h, setOnly24h] = useState(false);
  const [fuelFilter, setFuelFilter] = useState<Fuel | "">("");
  const [kind, setKind] = useState<Kind>("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);

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
  const selectedDistance = selected && me ? distanceM(me, selected) : null;
  const activeFilters =
    (kind ? 1 : 0) + (only24h ? 1 : 0) + (fuelFilter ? 1 : 0) + (regency ? 1 : 0);

  const select = (id: string | null) => {
    scroller.current?.scrollTo({ top: 0 });
    setSelectedId(id);
    if (id) setFull(true);
    // Keep the address bar in step so the page URL itself is shareable.
    window.history.replaceState(null, "", id ? `/?spbu=${id}` : "/");
  };

  const clearFilters = () => {
    setKind("");
    setOnly24h(false);
    setFuelFilter("");
    setRegency("");
  };

  const toggleKind = (k: Kind) => setKind((cur) => (cur === k ? "" : k));
  const toggleFuel = (f: Fuel) => setFuelFilter((cur) => (cur === f ? "" : f));

  const chips = (
    <div
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      role="group"
      aria-label="Filter cepat"
    >
      <Chip active={!activeFilters} onClick={clearFilters}>
        Semua
      </Chip>
      <Chip active={kind === "spbu"} onClick={() => toggleKind("spbu")}>
        SPBU
      </Chip>
      <Chip active={kind === "pertashop"} onClick={() => toggleKind("pertashop")}>
        Pertashop
      </Chip>
      <Chip active={kind === "ges"} onClick={() => toggleKind("ges")}>
        GES
      </Chip>
      <Chip active={only24h} onClick={() => setOnly24h((v) => !v)}>
        24 jam
      </Chip>
      <Chip active={fuelFilter === "pertalite"} onClick={() => toggleFuel("pertalite")}>
        Pertalite
      </Chip>
      <Chip active={fuelFilter === "pertamax"} onClick={() => toggleFuel("pertamax")}>
        Pertamax
      </Chip>
      <Chip active={fuelFilter === "solar"} onClick={() => toggleFuel("solar")}>
        Solar
      </Chip>
    </div>
  );

  const nearest = items.slice(0, CAROUSEL_COUNT);

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

      {/* Top: disclaimer and official information (always above the station list) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:left-4 md:right-auto md:w-96 md:p-4">
        <div className="pointer-events-auto overflow-hidden rounded-2xl bg-white/95 shadow-lg backdrop-blur">
          <p className="bg-amber-50 px-3 py-1.5 text-[11px] leading-snug font-semibold text-amber-950">
            <span className="font-bold">SPBU Watch SARBAGITA.</span> {DISCLAIMER}
          </p>
          <OfficialPanel updates={officialQ.data} />
        </div>
      </div>

      {/* Bottom sheet (mobile) / left panel (desktop) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl bg-gradient-to-b from-white to-slate-50 shadow-[0_-6px_24px_rgba(15,23,42,0.22)] transition-[height] duration-200 md:bottom-4 md:left-4 md:right-auto md:w-96 md:rounded-3xl ${
          full ? "h-[84dvh] md:h-[calc(100dvh-9rem)]" : "h-[46dvh] md:h-[46dvh]"
        }`}
      >
        {!full && !selected && (
          <div className="absolute -top-14 right-3">
            <IconButton label="Gunakan lokasi saya" onClick={locate}>
              <LocateIcon />
            </IconButton>
          </div>
        )}

        <button
          type="button"
          onClick={() => setFull((o) => !o)}
          aria-label={full ? "Perkecil daftar" : "Perbesar daftar"}
          className="flex min-h-9 w-full shrink-0 items-center justify-center"
        >
          <span className="h-1.5 w-12 rounded-full bg-slate-300" />
        </button>

        {selected ? (
          <StationDetail
            key={selected.id}
            station={selected}
            distance={selectedDistance}
            onBack={() => select(null)}
            onReported={stationsQ.reload}
          />
        ) : full ? (
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
            <div className="space-y-3 px-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Daftar SPBU</h2>
                  <p className="text-xs text-slate-600">
                    {items.length} dari {stations.length} SPBU · diurutkan menurut {me ? "jarak" : "nama"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <IconButton label="Gunakan lokasi saya" onClick={locate}>
                    <LocateIcon />
                  </IconButton>
                  <IconButton label="Bagikan (tautan & QR)" onClick={() => setShareApp(true)}>
                    <ShareIcon />
                  </IconButton>
                </div>
              </div>

              {statsQ.data.online !== null && statsQ.data.today !== null && (
                <p className="text-xs text-slate-700">
                  <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-green-600" />
                  <b>{countText(statsQ.data.online)}</b> online · <b>{countText(statsQ.data.today)}</b>{" "}
                  pengunjung hari ini
                </p>
              )}

              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500">
                  <SearchIcon />
                </span>
                <input
                  ref={searchBox}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, kode, atau daerah"
                  aria-label="Cari SPBU"
                  className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white pr-3 pl-11 text-base shadow-sm"
                />
              </div>

              {chips}

              <button
                type="button"
                onClick={() => setMoreFilters((v) => !v)}
                aria-expanded={moreFilters}
                className="flex min-h-11 items-center gap-2 text-sm font-bold text-blue-900"
              >
                <SlidersIcon />
                Filter lainnya{activeFilters ? ` (${activeFilters} aktif)` : ""}
              </button>
              {moreFilters && (
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                  <label className="block text-xs font-semibold text-slate-600">
                    Wilayah
                    <select value={regency} onChange={(e) => setRegency(e.target.value)} className={`${selectCls} mt-1`}>
                      <option value="">Semua wilayah</option>
                      {REGENCIES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Jenis
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as Kind)}
                      aria-label="Filter jenis"
                      className={`${selectCls} mt-1`}
                    >
                      <option value="">Semua jenis</option>
                      <option value="spbu">SPBU</option>
                      <option value="pertashop">Pertashop</option>
                      <option value="spbuk">SPBUK</option>
                      <option value="spbbk">SPBBK</option>
                      <option value="spbun">SPBUN</option>
                      <option value="ges">GES</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    BBM yang dijual
                    <select
                      value={fuelFilter}
                      onChange={(e) => setFuelFilter(e.target.value as Fuel | "")}
                      aria-label="Filter jenis BBM yang dijual"
                      className={`${selectCls} mt-1`}
                    >
                      <option value="">Semua BBM</option>
                      <option value="pertalite">Menjual Pertalite</option>
                      <option value="pertamax">Menjual Pertamax</option>
                      <option value="solar">Menjual Solar</option>
                      <option value="pertamax_turbo">Menjual Pertamax Turbo</option>
                      <option value="dexlite">Menjual Dexlite</option>
                      <option value="pertamina_dex">Menjual Pertamina Dex</option>
                    </select>
                  </label>
                </div>
              )}
              {fuelFilter && (
                <p className="text-xs text-slate-700">
                  Filter BBM memakai data jenis BBM yang dijual SPBU, bukan stok saat ini. SPBU yang jenis
                  BBM-nya belum diketahui tetap ditampilkan.
                </p>
              )}
              {geoMsg && <p className="text-xs text-slate-700">{geoMsg}</p>}
              {stationsQ.error && (
                <p className="rounded-xl bg-red-100 p-2 text-sm font-semibold text-red-900">
                  Gagal memuat data terbaru. Mencoba lagi otomatis.
                </p>
              )}
              <details className="text-xs text-slate-700">
                <summary className="min-h-9 cursor-pointer py-1 font-semibold">Keterangan tanda</summary>
                <div className="space-y-1 pb-1">
                  <p>Lokasi Anda hanya dipakai di perangkat ini dan tidak disimpan.</p>
                  <Legend />
                </div>
              </details>
            </div>

            <StationList items={items} onSelect={select} />

            <footer className="mt-4 space-y-1 border-t border-slate-200 px-4 pt-4 text-xs text-slate-600">
              <p>{DISCLAIMER}</p>
              <p>
                Peta © MapTiler · © OpenStreetMap contributors. Data SPBU dari OpenStreetMap (ODbL).
              </p>
              <p>
                Privasi: aplikasi menyimpan laporan antrean/stok, ID acak perangkat, hash IP, dan hash harian
                anonim untuk penghitung pengunjung. Tidak menyimpan koordinat lokasi, plat nomor, atau foto.{" "}
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
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
            <div className="flex items-center justify-between gap-2 px-4">
              <h2 className="text-lg font-bold text-slate-900">{me ? "SPBU terdekat" : "SPBU di Bali"}</h2>
              <div className="flex items-center gap-2">
                <IconButton label="Bagikan (tautan & QR)" onClick={() => setShareApp(true)}>
                  <ShareIcon />
                </IconButton>
                <button
                  type="button"
                  onClick={() => setFull(true)}
                  className="min-h-11 rounded-full px-3 text-sm font-bold text-blue-900"
                >
                  Lihat daftar
                </button>
              </div>
            </div>

            <div className="mt-1 px-4">{chips}</div>

            {me ? (
              nearest.length > 0 ? (
                <ul className="no-scrollbar mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
                  {nearest.map(({ station, distance }) => (
                    <li key={station.id} className="w-[86%] max-w-sm shrink-0 snap-center">
                      <StationCard station={station} distance={distance} onSelect={select} className="h-full" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mx-4 mt-2 rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">
                  Tidak ada SPBU yang cocok dengan filter ini.
                </p>
              )
            ) : (
              <div className="mx-4 mt-2 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Lihat SPBU terdekat dari Anda</p>
                <p className="text-xs text-slate-600">
                  Lokasi hanya dipakai di perangkat ini untuk mengurutkan jarak, dan tidak disimpan.
                </p>
                <button
                  type="button"
                  onClick={locate}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-900 text-base font-bold text-white"
                >
                  <LocateIcon />
                  Gunakan lokasi saya
                </button>
                {geoMsg && <p className="text-xs text-slate-700">{geoMsg}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {shareApp && (
        <ShareDialog
          url={window.location.origin}
          title="Bagikan SPBU Watch"
          text="Pantau antrean dan stok BBM di SPBU Denpasar, Badung, Gianyar, dan Tabanan dari laporan warga."
          onClose={() => setShareApp(false)}
        />
      )}
    </div>
  );
}
