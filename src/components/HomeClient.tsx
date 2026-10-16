"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { OfficialUpdateDTO, StationDTO } from "@/lib/api-types";
import type { StationCategory } from "@/lib/category";
import { getDeviceId } from "@/lib/device";
import { clearAdminToken, getAdminToken } from "@/lib/admin-session";
import { ALT_RADIUS_M } from "@/lib/config";
import { distanceM, matchesFuelFilter, matchesSearch } from "@/lib/format";
import type { Fuel } from "@/lib/status";
import { useRefreshing } from "@/lib/use-refreshing";
import AdminEditPanel from "./AdminEditPanel";
import AdminLoginDialog from "./AdminLoginDialog";
import BottomNav, { type AppTab } from "./BottomNav";
import FeaturedStation from "./FeaturedStation";
import InfoTab from "./InfoTab";
import OfficialPanel from "./OfficialPanel";
import ReportTab from "./ReportTab";
import ShareDialog from "./ShareDialog";
import SiteFooter from "./SiteFooter";
import { StationMini } from "./StationCard";
import StationDetail from "./StationDetail";
import StationList, { type ListItem } from "./StationList";
import { Legend } from "./StatusBits";
import {
  BoltIcon,
  Chip,
  ChevronDownIcon,
  ClockIcon,
  GasIcon,
  IconButton,
  InfoIcon,
  LocateIcon,
  PhoneIcon,
  SearchIcon,
  ShareIcon,
  ShieldIcon,
  SlidersIcon,
  StoreIcon,
} from "./ui";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100" />,
});

const REGENCIES = ["Denpasar", "Badung", "Gianyar", "Tabanan"];
const ALT_SHOWN = 5;

type Kind = "" | StationCategory | "ges";

const selectCls =
  "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm";

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
  const [shareApp, setShareApp] = useState(false);
  const [tab, setTab] = useState<AppTab>("peta");
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  // Admin mode: the token is kept for this browser session only. Read after mount so server and client markup match.
  const [adminToken, setAdminTokenState] = useState<string | null>(null);
  const [adminLogin, setAdminLogin] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setAdminTokenState(getAdminToken()));
  }, []);
  const logoutAdmin = () => {
    clearAdminToken();
    setAdminTokenState(null);
  };

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

  // A shared link (?spbu=<id>) opens that station's detail. Read lazily so there is no extra render.
  // selectedId: station in focus on the map and shown as the main card. detailOpen: full detail with tabs.
  // All of this starts from the same values on the server and in the browser (so hydration matches); a shared link
  // (?spbu=<id>) and the wide-screen layout are applied right after mount.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [startReport, setStartReport] = useState(false);
  // "peek": map first with the main card. "full": list or station detail.
  const [full, setFull] = useState(false);
  const returnFull = useRef(false); // whether the full list was open before the detail
  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("spbu");
    const wide = window.matchMedia("(min-width: 768px)").matches;
    queueMicrotask(() => {
      if (sharedId) {
        setSelectedId(sharedId);
        setDetailOpen(true);
        setFull(true);
      } else if (wide) {
        setFull(true); // the left pane starts as the full list (there is no peeking sheet to pull up)
      }
    });
  }, []);
  const [search, setSearch] = useState("");
  const [regency, setRegency] = useState("");
  const [only24h, setOnly24h] = useState(false);
  const [fuelFilter, setFuelFilter] = useState<Fuel | "">("");
  const [kind, setKind] = useState<Kind>("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const pendingRecenter = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);

  const locate = (precise = false, recenter = false) => {
    if (!navigator.geolocation) {
      setGeoMsg("Peramban ini tidak mendukung lokasi.");
      return;
    }
    setGeoMsg("Mencari lokasi…");
    if (recenter) pendingRecenter.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Kept in memory only, used to sort the list and to find the stations in reporting range.
        // It reaches the server only inside a report, where it is checked and thrown away.
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoMsg(null);
        if (pendingRecenter.current) {
          pendingRecenter.current = false;
          setRecenterKey((k) => k + 1);
        }
      },
      () => {
        pendingRecenter.current = false;
        setGeoMsg(
          "Lokasi tidak diizinkan. Daftar diurutkan menurut nama. Anda tetap bisa mencari SPBU.",
        );
      },
      {
        enableHighAccuracy: precise,
        timeout: 15_000,
        maximumAge: precise ? 10_000 : 60_000,
      },
    );
  };

  // Opening the Lapor tab refreshes the position when it was already shared, so the nearby list is current.
  const changeTab = (next: AppTab) => {
    setTab(next);
    if (next === "lapor" && me) locate(true);
  };

  const filtered = useMemo(
    () =>
      stations
        .filter((s) => matchesSearch(s, search))
        .filter((s) => !regency || s.regency === regency)
        .filter((s) => !only24h || s.is24h)
        .filter((s) => matchesFuelFilter(s, fuelFilter))
        .filter(
          (s) => !kind || (kind === "ges" ? s.isGes : s.category === kind),
        ),
    [stations, search, regency, only24h, kind, fuelFilter],
  );

  // Sorted by distance or name only, never by availability (anti-panic rule).
  const items: ListItem[] = useMemo(() => {
    const list = filtered.map((s) => ({
      station: s,
      distance: me ? distanceM(me, s) : null,
    }));
    list.sort((a, b) =>
      me
        ? (a.distance ?? 0) - (b.distance ?? 0)
        : a.station.name.localeCompare(b.station.name, "id"),
    );
    return list;
  }, [filtered, me]);

  const selected = selectedId
    ? (stations.find((s) => s.id === selectedId) ?? null)
    : null;
  // Main card: the station in focus, else the nearest one (only when the position is known).
  const featured = selected ?? (me ? (items[0]?.station ?? null) : null);
  const featuredDistance = featured && me ? distanceM(me, featured) : null;
  // "Pilihan alternatif": other stations within ALT_RADIUS_M of the visitor (or of the chosen station when the
  // position is unknown), nearest first. Distance only: never ordered or labelled by stock.
  const altFrom = me ?? selected;
  const alternatives = useMemo(() => {
    if (!altFrom || !featured) return [];
    return filtered
      .filter((s) => s.id !== featured.id)
      .map((s) => ({ station: s, distance: distanceM(altFrom, s) }))
      .filter((x) => x.distance <= ALT_RADIUS_M)
      .sort((a, b) => a.distance - b.distance);
  }, [filtered, altFrom, featured]);
  // The map shows exactly the stations the filters and search leave in the list (plus the open station).
  const mapStations = useMemo(() => {
    const open = selectedId ? stations.find((s) => s.id === selectedId) : null;
    return open && !filtered.includes(open) ? [...filtered, open] : filtered;
  }, [filtered, stations, selectedId]);
  const filtersOn = Boolean(kind || only24h || fuelFilter || regency);
  const fitKey = filtersOn
    ? [kind, only24h, fuelFilter, regency].join("|")
    : null;
  const selectedDistance = selected && me ? distanceM(me, selected) : null;
  const activeFilters =
    (kind ? 1 : 0) +
    (only24h ? 1 : 0) +
    (fuelFilter ? 1 : 0) +
    (regency ? 1 : 0);

  const syncUrl = (id: string | null) =>
    window.history.replaceState(null, "", id ? `/?spbu=${id}` : "/");

  /** Pin or alternative tapped: show it as the main card and centre the map on it. */
  const focus = (id: string | null) => {
    scroller.current?.scrollTo({ top: 0 });
    setSelectedId(id);
    setDetailOpen(false);
    setFull(false);
    syncUrl(id);
  };

  /** Full detail with tabs (list tap, or "Lihat detail" / "Lapor kondisi" on the main card). */
  const openDetail = (id: string, report = false) => {
    returnFull.current = full && !detailOpen;
    setSelectedId(id);
    setStartReport(report);
    setDetailOpen(true);
    setFull(true);
    syncUrl(id);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setFull(returnFull.current);
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
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1"
      role="group"
      aria-label="Filter cepat"
    >
      <Chip active={!activeFilters} onClick={clearFilters}>
        <GasIcon />
        Semua
      </Chip>
      <Chip active={kind === "spbu"} onClick={() => toggleKind("spbu")}>
        SPBU
      </Chip>
      <Chip
        active={kind === "pertashop"}
        onClick={() => toggleKind("pertashop")}
      >
        <StoreIcon />
        Pertashop
      </Chip>
      <Chip active={kind === "ges"} onClick={() => toggleKind("ges")}>
        <BoltIcon />
        GES
      </Chip>
      <Chip active={only24h} onClick={() => setOnly24h((v) => !v)}>
        <ClockIcon />
        24 jam
      </Chip>
      <Chip
        active={fuelFilter === "pertalite"}
        onClick={() => toggleFuel("pertalite")}
      >
        Pertalite
      </Chip>
      <Chip
        active={fuelFilter === "pertamax"}
        onClick={() => toggleFuel("pertamax")}
      >
        Pertamax
      </Chip>
      <Chip active={fuelFilter === "solar"} onClick={() => toggleFuel("solar")}>
        Solar
      </Chip>
    </div>
  );

  const knownSellers = fuelFilter
    ? items.filter((i) => i.station.fuels.includes(fuelFilter)).length
    : 0;
  const hoursKnown = stations.filter((s) => s.is24h || s.openingHours).length;
  const stations24h = stations.filter((s) => s.is24h).length;

  return (
    <div className="bg-canvas relative h-dvh w-full overflow-hidden">
      {/* Everything above the bottom navigation */}
      <div className="absolute inset-x-0 top-[var(--head-h)] bottom-[var(--nav-h)] md:bottom-0">
        <div
          className="absolute inset-0 md:left-[440px]"
          data-testid="map"
          data-station-count={mapStations.length}
        >
          <MapView
            stations={mapStations}
            fitKey={fitKey}
            selectedId={selectedId}
            userLocation={me}
            recenterKey={recenterKey}
            onSelect={focus}
          />
        </div>

        {/* Top: disclaimer, official information and quick filters (always above the station list) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-1 p-2 md:right-auto md:left-[440px] md:w-96 md:p-4">
          <div className="border-line/70 pointer-events-auto overflow-hidden rounded-2xl border bg-white shadow-lg">
            <div className="bg-disclaimer-bg text-disclaimer-amber flex items-center gap-2 px-3 py-2">
              <span className="shrink-0">
                <ShieldIcon />
              </span>
              <p className="min-w-0 flex-1 text-[11px] leading-snug font-semibold">
                Data indikatif laporan warga · Bukan informasi resmi Pertamina
              </p>
              <a
                href="tel:135"
                aria-label="Telepon Call Center Pertamina 135"
                className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-bold shadow-sm"
              >
                <PhoneIcon />
                135
              </a>
              <button
                type="button"
                onClick={() => setDisclaimerOpen((o) => !o)}
                aria-expanded={disclaimerOpen}
                aria-label="Detail disclaimer"
                className={`flex size-11 shrink-0 items-center justify-center rounded-lg transition-transform ${
                  disclaimerOpen ? "rotate-180" : ""
                }`}
              >
                <ChevronDownIcon />
              </button>
            </div>
            {disclaimerOpen && (
              <div className="border-line flex items-start gap-2 border-t bg-white px-3 py-2.5 text-xs text-slate-800">
                <span className="text-primary mt-0.5 shrink-0">
                  <InfoIcon />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">
                    Transparansi data
                  </p>
                  <p>
                    Data berasal dari laporan warga dan diperbarui tiap menit,
                    jadi bisa saja belum sesuai kondisi terkini. Cek kanal resmi
                    untuk kepastian. Aplikasi ini bukan produk Pertamina dan
                    tidak memakai merek Pertamina.
                  </p>
                  <p className="text-status-smooth font-semibold">
                    Lokasi Anda tidak disimpan di server.
                  </p>
                </div>
              </div>
            )}
            {/* While the list or a station is open the sheet covers most of the map: keep only the disclaimer on top. */}
            <div className={full ? "hidden md:block" : ""}>
              <OfficialPanel
                updates={officialQ.data}
                onOpen={() => setTab("info")}
              />
            </div>
          </div>
          {adminToken && (
            <div
              data-testid="admin-banner"
              className="bg-ink pointer-events-auto flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-white shadow-md"
            >
              <p className="min-w-0 text-xs font-bold">
                MODE ADMIN
                <span className="font-normal opacity-90">
                  {" "}
                  · ketuk pin SPBU untuk mengubah kondisinya
                </span>
              </p>
              <button
                type="button"
                onClick={logoutAdmin}
                className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-bold underline"
              >
                Keluar
              </button>
            </div>
          )}
          <div className={`space-y-1 ${full ? "hidden md:block" : ""}`}>
            <div className="pointer-events-auto">{chips}</div>
            <div className="flex items-start justify-between gap-2">
              <span className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold tracking-wide text-slate-900 uppercase shadow-sm">
                <span className="bg-status-smooth size-2 animate-pulse rounded-full" />
                Koridor SARBAGITA
              </span>
              <div className="pointer-events-auto">
                <IconButton
                  label="Pusatkan ke lokasi saya"
                  onClick={() =>
                    me ? setRecenterKey((k) => k + 1) : locate(false, true)
                  }
                >
                  <LocateIcon />
                </IconButton>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom sheet (mobile) / left panel (desktop) */}
        <div
          className={`border-line absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl border-t bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.14)] transition-[height] duration-200 md:top-0 md:right-auto md:bottom-[var(--nav-h)] md:left-0 md:h-auto md:w-[440px] md:rounded-none md:border-t-0 md:border-r md:pt-4 md:shadow-lg ${
            full ? "h-[88%]" : "h-[50%]"
          }`}
        >
          <button
            type="button"
            onClick={() => setFull((o) => !o)}
            aria-label={full ? "Perkecil daftar" : "Perbesar daftar"}
            className="flex min-h-9 w-full shrink-0 items-center justify-center md:hidden"
          >
            <span className="bg-line h-1.5 w-12 rounded-full" />
          </button>

          {detailOpen && selected ? (
            <StationDetail
              key={selected.id}
              station={selected}
              distance={selectedDistance}
              startReporting={startReport}
              adminToken={adminToken}
              me={me}
              geoMsg={geoMsg}
              onLocate={() => locate(true)}
              adminPanel={
                adminToken
                  ? (onSaved) => (
                      <AdminEditPanel
                        station={selected}
                        token={adminToken}
                        onSaved={onSaved}
                        onAuthFail={logoutAdmin}
                      />
                    )
                  : null
              }
              onBack={closeDetail}
              onReported={stationsQ.reload}
            />
          ) : full ? (
            <div
              ref={scroller}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4"
            >
              <div className="space-y-3 px-4 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Daftar SPBU
                    </h2>
                    <p className="tnum text-xs text-slate-600">
                      {items.length} dari {stations.length} SPBU · diurutkan
                      menurut {me ? "jarak" : "nama"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <IconButton
                      label="Gunakan lokasi saya"
                      onClick={() => locate()}
                    >
                      <LocateIcon />
                    </IconButton>
                    <IconButton
                      label="Bagikan (tautan & QR)"
                      onClick={() => setShareApp(true)}
                    >
                      <ShareIcon />
                    </IconButton>
                  </div>
                </div>

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
                    className="border-line min-h-12 w-full rounded-2xl border bg-white pr-3 pl-11 text-base shadow-sm"
                  />
                </div>

                <div className="md:hidden">{chips}</div>

                <button
                  type="button"
                  onClick={() => setMoreFilters((v) => !v)}
                  aria-expanded={moreFilters}
                  className="text-primary flex min-h-11 items-center gap-2 text-sm font-bold"
                >
                  <SlidersIcon />
                  Filter lainnya
                  {activeFilters ? ` (${activeFilters} aktif)` : ""}
                </button>
                {moreFilters && (
                  <div className="border-line bg-canvas space-y-2 rounded-2xl border p-3">
                    <label className="block text-xs font-semibold text-slate-600">
                      Wilayah
                      <select
                        value={regency}
                        onChange={(e) => setRegency(e.target.value)}
                        className={`${selectCls} mt-1`}
                      >
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
                        <option value="spdn">SPDN</option>
                        <option value="ges">GES</option>
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">
                      BBM yang dijual
                      <select
                        value={fuelFilter}
                        onChange={(e) =>
                          setFuelFilter(e.target.value as Fuel | "")
                        }
                        aria-label="Filter jenis BBM yang dijual"
                        className={`${selectCls} mt-1`}
                      >
                        <option value="">Semua BBM</option>
                        <option value="pertalite">Menjual Pertalite</option>
                        <option value="pertamax">Menjual Pertamax</option>
                        <option value="solar">Menjual Solar</option>
                        <option value="pertamax_turbo">
                          Menjual Pertamax Turbo
                        </option>
                        <option value="dexlite">Menjual Dexlite</option>
                        <option value="pertamina_dex">
                          Menjual Pertamina Dex
                        </option>
                      </select>
                    </label>
                  </div>
                )}
                {fuelFilter && (
                  <p className="text-xs text-slate-700">
                    Filter BBM memakai data jenis BBM yang dijual SPBU, bukan
                    stok saat ini. {knownSellers} SPBU diketahui menjual jenis
                    ini; {items.length - knownSellers} lainnya belum diketahui
                    jenis BBM-nya dan tetap ditampilkan.
                  </p>
                )}
                {only24h && (
                  <p className="text-xs text-slate-700">
                    Data 24 jam belum lengkap: baru {stations24h} SPBU tercatat
                    24 jam, dari {hoursKnown} SPBU yang jam bukanya diketahui
                    (total {stations.length}). SPBU lain bisa saja 24 jam. Cek
                    pengumuman resmi.
                  </p>
                )}
                {geoMsg && <p className="text-xs text-slate-700">{geoMsg}</p>}
                {stationsQ.error && (
                  <p className="bg-status-critical-bg text-status-critical rounded-xl p-2 text-sm font-semibold">
                    Gagal memuat data terbaru. Mencoba lagi otomatis.
                  </p>
                )}
                <details className="text-xs text-slate-700">
                  <summary className="min-h-9 cursor-pointer py-1 font-semibold">
                    Keterangan tanda
                  </summary>
                  <div className="space-y-1 pb-1">
                    <p>
                      Lokasi Anda hanya dipakai di perangkat ini untuk
                      mengurutkan jarak dan tidak disimpan.
                    </p>
                    <Legend />
                  </div>
                </details>
              </div>

              <StationList items={items} onSelect={(id) => openDetail(id)} />

              <SiteFooter
                withDisclaimer
                updatedAt={stationsQ.updatedAt}
                className="border-line mt-4 border-t pt-4"
              />
            </div>
          ) : (
            <div
              ref={scroller}
              className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain px-4 pb-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">
                    {selected
                      ? "SPBU terpilih"
                      : me
                        ? "SPBU terdekat dari Anda"
                        : "SPBU di Bali"}
                  </h2>
                  <p className="text-xs text-slate-600">
                    {me
                      ? "Jarak dihitung di perangkat Anda dan tidak disimpan"
                      : "Aktifkan lokasi untuk melihat jarak"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {selected ? (
                    <button
                      type="button"
                      onClick={() => focus(null)}
                      className="bg-primary-fixed/60 text-primary min-h-11 rounded-xl px-3 text-xs font-bold"
                    >
                      Lepas pilihan
                    </button>
                  ) : me ? (
                    <span className="bg-primary-fixed/60 text-primary flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold">
                      <LocateIcon />
                      GPS aktif
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setFull(true)}
                    className="border-line text-primary hidden min-h-11 rounded-xl border bg-white px-3 text-xs font-bold md:block"
                  >
                    Daftar SPBU
                  </button>
                </div>
              </div>

              {featured ? (
                <FeaturedStation
                  key={featured.id}
                  station={featured}
                  distance={featuredDistance}
                  onDetail={() => openDetail(featured.id)}
                  onReport={() => openDetail(featured.id, true)}
                  adminSlot={
                    adminToken && (
                      <AdminEditPanel
                        key={featured.id}
                        station={featured}
                        token={adminToken}
                        onSaved={stationsQ.reload}
                        onAuthFail={logoutAdmin}
                      />
                    )
                  }
                />
              ) : (
                <div className="border-line bg-canvas space-y-2 rounded-2xl border p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Lihat SPBU terdekat dari Anda
                  </p>
                  <p className="text-xs text-slate-600">
                    Lokasi hanya dipakai di perangkat ini untuk mengurutkan
                    jarak, dan tidak disimpan. Atau ketuk salah satu pin di
                    peta.
                  </p>
                  <button
                    type="button"
                    onClick={() => locate(false, true)}
                    className="bg-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white"
                  >
                    <LocateIcon />
                    Gunakan lokasi saya
                  </button>
                  {geoMsg && <p className="text-xs text-slate-700">{geoMsg}</p>}
                </div>
              )}

              {featured && altFrom && (
                <section className="space-y-2" aria-label="Pilihan alternatif">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold tracking-wider text-slate-600 uppercase">
                      Pilihan alternatif lain
                    </h3>
                    <button
                      type="button"
                      onClick={() => setFull(true)}
                      className="text-primary min-h-11 text-xs font-bold"
                    >
                      Lihat semua ({alternatives.length})
                    </button>
                  </div>
                  {alternatives.length > 0 ? (
                    <>
                      <ul className="space-y-2">
                        {alternatives
                          .slice(0, ALT_SHOWN)
                          .map(({ station, distance }) => (
                            <li key={station.id}>
                              <StationMini
                                station={station}
                                distance={distance}
                                onSelect={focus}
                              />
                            </li>
                          ))}
                      </ul>
                      <p className="text-[11px] text-slate-600">
                        SPBU lain dalam {ALT_RADIUS_M / 1000} km{" "}
                        {me ? "dari Anda" : "dari SPBU ini"}, diurutkan menurut
                        jarak. Bukan peringkat ketersediaan BBM.
                      </p>
                    </>
                  ) : (
                    <p className="bg-canvas rounded-xl p-3 text-sm text-slate-700">
                      Tidak ada SPBU lain dalam {ALT_RADIUS_M / 1000} km
                      {filtersOn ? " yang cocok dengan filter" : ""}.
                    </p>
                  )}
                </section>
              )}
              <SiteFooter className="px-0" />
            </div>
          )}
        </div>

        {/* Lapor and Info screens cover the map (which stays mounted underneath) */}
        {tab === "lapor" && (
          <div className="bg-canvas md:border-line absolute inset-0 z-40 overflow-y-auto overscroll-contain md:right-auto md:bottom-[var(--nav-h)] md:w-[440px] md:border-r">
            <ReportTab
              stations={stations}
              me={me}
              geoMsg={geoMsg}
              onLocate={() => locate(true)}
              onReported={stationsQ.reload}
              onGoMap={() => setTab("peta")}
            />
          </div>
        )}
        {tab === "info" && (
          <div className="bg-canvas md:border-line absolute inset-0 z-40 overflow-y-auto overscroll-contain md:right-auto md:bottom-[var(--nav-h)] md:w-[440px] md:border-r">
            <InfoTab
              updates={officialQ.data}
              updatedAt={officialQ.updatedAt}
              onShare={() => setShareApp(true)}
              adminActive={Boolean(adminToken)}
              onAdminLogin={() => setAdminLogin(true)}
              onAdminLogout={logoutAdmin}
            />
          </div>
        )}
      </div>

      <BottomNav tab={tab} onChange={changeTab} />

      {adminLogin && (
        <AdminLoginDialog
          onClose={() => setAdminLogin(false)}
          onLoggedIn={(t) => {
            setAdminTokenState(t);
            setAdminLogin(false);
            setTab("peta");
          }}
        />
      )}

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
