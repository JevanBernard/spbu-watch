import type { StationDTO } from "./api-types";
import { CATEGORY_LABEL } from "./category";
import { FUEL_LABEL, QUEUE_LABEL, STOCK_LABEL, reportedText, stationFuels } from "./format";
import { effectiveOpen } from "./hours";
import { DISCLAIMER } from "./text";

/** Colour family of a status on the image. "bad" (red) is only used for a confirmed "habis" or a long queue. */
export type CardTone = "good" | "warn" | "bad" | "neutral";

export interface CardStatus {
  tone: CardTone;
  title: string;
  detail: string;
}

export interface CardRow {
  name: string;
  status: string;
  detail: string;
  tone: CardTone;
}

/**
 * Everything the share image says, as plain data. The drawing code (share-image.ts) only lays this out, so what the
 * image may claim is decided and tested here: the same status rules as the app, always a timestamp and the
 * disclaimer, nothing about who reported (no device ids, no positions).
 */
export interface CardModel {
  kind: "station" | "app";
  eyebrow: string;
  title: string;
  subtitle: string | null;
  badges: string[];
  queue: CardStatus | null;
  open: CardStatus | null;
  /** Fuel rows of a station card, or the checklist of the app card (status left empty). */
  rows: CardRow[];
  bullets: string[];
  stamp: string | null;
  note: string | null;
  disclaimer: string;
  /** What the QR code opens. */
  url: string;
  /** Shown next to the QR code. */
  urlText: string;
  /** Used in the file name. */
  slug: string;
}

const QUEUE_TONE: Record<StationDTO["queue"]["status"], CardTone> = {
  sepi: "good",
  sedang: "warn",
  panjang: "bad",
  unknown: "neutral",
};

const STOCK_TONE: Record<string, CardTone> = {
  available: "good",
  out: "bad", // only reached when "habis" is confirmed (several devices or the admin)
  unconfirmed: "neutral",
  conflicting: "neutral",
  unknown: "neutral",
};

const stampFmt = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Makassar",
});

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "spbu"
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** "Per Kamis, 16 Oktober 2026, pukul 14.32 WITA". Built from the parts so it does not depend on the ICU version. */
export function stampText(now: Date): string {
  const p = Object.fromEntries(stampFmt.formatToParts(now).map((x) => [x.type, x.value]));
  return `Per ${p.weekday}, ${p.day} ${p.month} ${p.year}, pukul ${p.hour}.${p.minute} WITA`;
}

export function buildStationCard(station: StationDTO, now: Date, url: string): CardModel {
  const q = station.queue;
  const queue: CardStatus = {
    tone: QUEUE_TONE[q.status],
    title: QUEUE_LABEL[q.status],
    detail: reportedText(q, now) + (q.confidence === "low" && q.reportCount > 0 && !q.stale ? " (kurang pasti)" : ""),
  };

  const o = effectiveOpen(station, now);
  const open: CardStatus | null =
    o.state === "unknown" ? null : { tone: o.state === "open" ? "good" : "neutral", title: o.label, detail: "" };

  const rows: CardRow[] = stationFuels(station).map((fuel) => {
    const st = station.stock[fuel];
    const status = st?.status ?? "unknown";
    return {
      name: FUEL_LABEL[fuel],
      status: STOCK_LABEL[status],
      detail: st && st.reportCount > 0 ? reportedText(st, now) : "",
      tone: STOCK_TONE[status],
    };
  });

  const badges = [CATEGORY_LABEL[station.category]];
  if (station.isGes) badges.push("GES");

  return {
    kind: "station",
    eyebrow: "Kondisi SPBU",
    title: station.name,
    subtitle: station.address ?? station.regency,
    badges,
    queue,
    open,
    rows,
    bullets: [],
    stamp: stampText(now),
    note: "Gambar ini hanya menunjukkan kondisi saat dibuat. Kondisi bisa berubah dengan cepat: pindai kode QR untuk data terbaru.",
    disclaimer: DISCLAIMER,
    url,
    urlText: hostOf(url),
    slug: slugify(station.name),
  };
}

export function buildAppCard(url: string): CardModel {
  return {
    kind: "app",
    eyebrow: "SPBU Watch SARBAGITA",
    title: "Cek antrean dan stok BBM sebelum berangkat ke SPBU",
    subtitle: "Denpasar, Badung, Gianyar, dan Tabanan",
    badges: [],
    queue: null,
    open: null,
    rows: [],
    bullets: [
      "Dari laporan warga, diperbarui tiap menit",
      "Antrean dan stok BBM per SPBU",
      "Lapor langsung dari SPBU, gratis tanpa akun",
    ],
    stamp: null,
    note: null,
    disclaimer: DISCLAIMER,
    url,
    urlText: hostOf(url),
    slug: "spbu-watch",
  };
}
