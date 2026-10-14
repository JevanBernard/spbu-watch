"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StationDTO } from "@/lib/api-types";
import { hasConfirmedOut } from "@/lib/format";

const DENPASAR: [number, number] = [115.2166, -8.65];
const CLUSTER_MAX_ZOOM = 11; // clusters below zoom 12
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL;

// The bundler breaks MapLibre's own worker URL; serve a copy from /public (scripts/copy_maplibre_worker.mjs).
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const COLORS = {
  sepi: "#15803d",
  sedang: "#d97706",
  panjang: "#b91c1c",
  unknown: "#64748b",
} as const;

/** Marker icons: a coloured disc with 1/2/3 bars (queue length) or "?" so colour is never the only cue. */
function drawIcon(status: keyof typeof COLORS): ImageData {
  const size = 56;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
  g.fillStyle = COLORS[status];
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = "#ffffff";
  g.stroke();
  g.fillStyle = "#ffffff";
  const bars = status === "sepi" ? 1 : status === "sedang" ? 2 : status === "panjang" ? 3 : 0;
  if (bars === 0) {
    g.font = "bold 30px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("?", size / 2, size / 2 + 2);
  } else {
    const w = 7;
    const gap = 4;
    const total = bars * w + (bars - 1) * gap;
    for (let i = 0; i < bars; i++) {
      const h = 10 + i * 6;
      g.fillRect((size - total) / 2 + i * (w + gap), size / 2 + 12 - h, w, h);
    }
  }
  return g.getImageData(0, 0, size, size);
}

function drawStockOutIcon(): ImageData {
  const size = 40;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  g.fillStyle = "#7f1d1d";
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = "#ffffff";
  g.stroke();
  g.strokeStyle = "#ffffff";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(13, 13);
  g.lineTo(27, 27);
  g.moveTo(27, 13);
  g.lineTo(13, 27);
  g.stroke();
  return g.getImageData(0, 0, size, size);
}

function toGeoJSON(stations: StationDTO[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { id: s.id, status: s.queue.status, out: hasConfirmedOut(s) },
    })),
  };
}

interface Props {
  stations: StationDTO[];
  selectedId: string | null;
  userLocation: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
}

export default function MapView({ stations, selectedId, userLocation, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  const stationsRef = useRef(stations);

  useEffect(() => {
    onSelectRef.current = onSelect;
    stationsRef.current = stations;
  });

  // Create the map once.
  useEffect(() => {
    if (!STYLE_URL || !container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: DENPASAR,
      zoom: 11,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
      }),
      "bottom-right",
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      (["sepi", "sedang", "panjang", "unknown"] as const).forEach((s) =>
        map.addImage(`q-${s}`, drawIcon(s), { pixelRatio: 2 }),
      );
      map.addImage("stock-out", drawStockOutIcon(), { pixelRatio: 2 });

      map.addSource("stations", {
        type: "geojson",
        data: toGeoJSON(stationsRef.current),
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: 50,
      });
      map.addSource("me", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "stations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1e3a8a",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 22, 30, 28],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "stations",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 14,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "selected-ring",
        type: "circle",
        source: "stations",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": 22,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-width": 4,
          "circle-stroke-color": "#0f172a",
        },
      });
      map.addLayer({
        id: "stations",
        type: "symbol",
        source: "stations",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["concat", "q-", ["get", "status"]],
          "icon-allow-overlap": true,
          "icon-size": 1,
        },
      });
      map.addLayer({
        id: "stock-out",
        type: "symbol",
        source: "stations",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "out"], true]],
        layout: {
          "icon-image": "stock-out",
          "icon-allow-overlap": true,
          "icon-offset": [12, -12],
          "icon-size": 0.8,
        },
      });
      map.addLayer({
        id: "me",
        type: "circle",
        source: "me",
        paint: {
          "circle-radius": 8,
          "circle-color": "#2563eb",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "clusters", async (e) => {
        const f = e.features?.[0] as MapGeoJSONFeature | undefined;
        if (!f) return;
        const src = map.getSource("stations") as GeoJSONSource;
        const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id as number);
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      map.on("click", "stations", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onSelectRef.current(id);
      });
      for (const layer of ["clusters", "stations"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Push new data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("stations") as GeoJSONSource).setData(toGeoJSON(stations));
  }, [stations, ready]);

  // Highlight and fly to the selected station.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter("selected-ring", ["==", ["get", "id"], selectedId ?? ""]);
    const s = selectedId ? stationsRef.current.find((x) => x.id === selectedId) : null;
    if (s) map.easeTo({ center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 14), duration: 600 });
  }, [selectedId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("me") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: userLocation
        ? [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [userLocation.lng, userLocation.lat] },
              properties: {},
            },
          ]
        : [],
    });
  }, [userLocation, ready]);

  if (!STYLE_URL) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-700">
        Peta belum dikonfigurasi. Isi NEXT_PUBLIC_MAP_STYLE_URL di .env. Daftar SPBU tetap dapat
        dipakai.
      </div>
    );
  }
  return <div ref={container} className="h-full w-full" />;
}
