"use client";

import { useCallback, useState } from "react";
import type { StationDTO } from "@/lib/api-types";
import { getDeviceId } from "@/lib/device";
import { GEOFENCE_M } from "@/lib/config";
import { FUEL_LABEL, FUEL_ORDER } from "@/lib/format";
import type { Fuel } from "@/lib/status";
import TurnstileWidget, { TURNSTILE_SITE_KEY } from "./TurnstileWidget";

type Kind = "queue" | "stock";
type Step = "locate" | "choose" | "sending" | "done" | "error";

const QUEUE_CHOICES = [
  { level: 0, label: "Sepi", hint: "Tidak antre, langsung dilayani", cls: "bg-status-smooth", bars: 1 },
  { level: 1, label: "Sedang", hint: "Antre sebentar", cls: "bg-status-moderate", bars: 2 },
  { level: 2, label: "Panjang", hint: "Antrean panjang", cls: "bg-status-critical", bars: 3 },
];

const COOLDOWN_MIN = 10;

export default function ReportFlow({
  station,
  kind,
  knownCoords = null,
  onClose,
  onDone,
}: {
  station: StationDTO;
  kind: Kind;
  /** Position the visitor already shared (Lapor tab): skips the location step. Still checked by the server. */
  knownCoords?: { lat: number; lng: number } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>(knownCoords ? "choose" : "locate");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(knownCoords);
  const [fuel, setFuel] = useState<Fuel | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRun, setCaptchaRun] = useState(0); // bump to get a fresh Turnstile token
  const onCaptcha = useCallback((t: string | null) => setCaptcha(t), []);
  // When Turnstile is configured, buttons stay disabled until the check passes.
  const blocked = Boolean(TURNSTILE_SITE_KEY) && !captcha;

  const askLocation = () => {
    setMessage(null);
    if (!navigator.geolocation) {
      setMessage("Peramban ini tidak mendukung lokasi, jadi laporan tidak bisa dikirim.");
      return;
    }
    setMessage("Mencari lokasi…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMessage(null);
        setStep("choose");
      },
      (err) =>
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Tanpa lokasi, laporan tidak bisa dikirim karena kami hanya menerima laporan dari orang yang sedang berada di SPBU. Anda bisa mengizinkan lokasi di pengaturan peramban lalu coba lagi."
            : "Lokasi belum ditemukan. Pastikan GPS aktif lalu coba lagi.",
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  const submit = async (body: Record<string, unknown>) => {
    if (!coords) return;
    setStep("sending");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId: station.id,
          kind,
          ...body,
          ...(captcha ? { turnstileToken: captcha } : {}),
          deviceId: getDeviceId(),
          lat: coords.lat,
          lng: coords.lng,
        }),
      });
      if (res.status === 201) {
        setCoords(null); // coordinates are not kept after sending
        setStep("done");
        onDone();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setMessage(data?.error ?? "Laporan gagal dikirim. Coba lagi.");
    } catch {
      setMessage("Tidak ada koneksi. Laporan belum terkirim, coba lagi.");
    }
    // A Turnstile token works once, so ask for a new one before the next attempt.
    setCaptcha(null);
    setCaptchaRun((n) => n + 1);
    setStep("error");
  };

  return (
    <div
      role="dialog"
      aria-label={kind === "queue" ? "Laporkan antrean" : "Laporkan stok"}
      className="space-y-3 rounded-2xl border-2 border-primary bg-white p-3 shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold">{kind === "queue" ? "Laporkan antrean" : "Laporkan stok BBM"}</h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 min-w-11 rounded-xl border border-line bg-white px-2 text-sm font-bold"
          aria-label="Tutup"
        >
          ✕
        </button>
      </div>
      <p className="text-sm font-semibold">{station.name}</p>

      {step === "locate" && (
        <div className="space-y-2">
          <p className="text-sm">
            Kami meminta lokasi Anda hanya untuk memastikan Anda berada di dekat SPBU ini
            (maksimal {GEOFENCE_M} meter). Lokasi tidak disimpan.
          </p>
          <button
            type="button"
            onClick={askLocation}
            className="min-h-12 w-full rounded-xl bg-primary px-4 text-base font-bold text-white"
          >
            Izinkan lokasi dan lanjut
          </button>
          {message && <p className="text-sm font-semibold text-status-critical">{message}</p>}
        </div>
      )}

      {step === "choose" && TURNSTILE_SITE_KEY && (
        <div>
          <TurnstileWidget key={captchaRun} onToken={onCaptcha} />
          {blocked && <p className="text-xs text-slate-700">Menunggu verifikasi keamanan…</p>}
        </div>
      )}

      {step === "choose" && kind === "queue" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Seberapa panjang antreannya sekarang?</p>
          {QUEUE_CHOICES.map((c) => (
            <button
              key={c.level}
              type="button"
              disabled={blocked}
              onClick={() => submit({ queueLevel: c.level })}
              className={`flex min-h-16 w-full items-center gap-3 rounded-xl px-4 text-left text-white disabled:opacity-40 ${c.cls}`}
            >
              <span aria-hidden className="flex items-end gap-0.5">
                {Array.from({ length: c.bars }, (_, i) => (
                  <span key={i} className="w-1.5 rounded-sm bg-white" style={{ height: 8 + i * 6 }} />
                ))}
              </span>
              <span>
                <span className="block text-lg font-bold">{c.label}</span>
                <span className="block text-sm">{c.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {step === "choose" && kind === "stock" && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">1. Pilih jenis BBM</p>
          <div className="grid grid-cols-2 gap-2">
            {FUEL_ORDER.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFuel(f)}
                aria-pressed={fuel === f}
                className={`min-h-12 rounded-xl border-2 px-2 text-sm font-bold ${
                  fuel === f
                    ? "border-primary bg-primary text-white"
                    : "border-line bg-white text-slate-900"
                }`}
              >
                {FUEL_LABEL[f]}
              </button>
            ))}
          </div>
          <p className="text-sm font-semibold">2. Apakah tersedia?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!fuel || blocked}
              onClick={() => submit({ fuel, stockStatus: "available" })}
              className="min-h-14 rounded-xl bg-status-smooth text-base font-bold text-white disabled:opacity-40"
            >
              ✓ Ada
            </button>
            <button
              type="button"
              disabled={!fuel || blocked}
              onClick={() => submit({ fuel, stockStatus: "out" })}
              className="min-h-14 rounded-xl bg-slate-800 text-base font-bold text-white disabled:opacity-40"
            >
              ✕ Habis
            </button>
          </div>
          <p className="text-xs text-slate-700">
            Laporkan &quot;Habis&quot; hanya jika Anda melihat sendiri BBM itu tidak tersedia di SPBU
            ini. Status &quot;habis&quot; baru ditampilkan setelah beberapa orang melapor.
          </p>
        </div>
      )}

      {step === "sending" && <p className="text-sm font-semibold">Mengirim laporan…</p>}

      {step === "done" && (
        <div className="space-y-2">
          <p className="text-base font-bold text-status-smooth">Terima kasih, laporan Anda terkirim.</p>
          <p className="text-sm">
            Anda bisa mengirim laporan serupa untuk SPBU ini lagi setelah {COOLDOWN_MIN} menit.
            Peta akan memperbarui statusnya dalam beberapa saat.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 w-full rounded-xl border-2 border-primary font-bold text-primary"
          >
            Selesai
          </button>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-status-critical">{message}</p>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setStep("locate"); // re-check the location (covers "too far" and denied cases)
            }}
            className="min-h-12 w-full rounded-xl border-2 border-primary font-bold text-primary"
          >
            Coba lagi
          </button>
        </div>
      )}
    </div>
  );
}
