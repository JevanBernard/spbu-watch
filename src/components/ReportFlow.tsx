"use client";

import { useCallback, useState } from "react";
import type { StationDTO } from "@/lib/api-types";
import { getDeviceId } from "@/lib/device";
import { FUEL_LABEL, FUEL_ORDER } from "@/lib/format";
import type { Fuel } from "@/lib/status";
import TurnstileWidget, { TURNSTILE_SITE_KEY } from "./TurnstileWidget";

type Kind = "queue" | "stock";
type Step = "locate" | "choose" | "sending" | "done" | "error";

const QUEUE_CHOICES = [
  { level: 0, label: "Sepi", hint: "Tidak antre, langsung dilayani", cls: "bg-green-700" },
  { level: 1, label: "Sedang", hint: "Antre sebentar", cls: "bg-amber-600" },
  { level: 2, label: "Panjang", hint: "Antrean panjang", cls: "bg-red-700" },
];

const COOLDOWN_MIN = 10;

export default function ReportFlow({
  station,
  kind,
  onClose,
  onDone,
}: {
  station: StationDTO;
  kind: Kind;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>("locate");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
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
      className="space-y-3 rounded-lg border-2 border-blue-900 bg-blue-50 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold">{kind === "queue" ? "Laporkan antrean" : "Laporkan stok BBM"}</h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 min-w-11 rounded-md border border-slate-400 bg-white px-2 text-sm font-bold"
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
            (maksimal 300 meter). Lokasi tidak disimpan.
          </p>
          <button
            type="button"
            onClick={askLocation}
            className="min-h-12 w-full rounded-md bg-blue-900 px-4 text-base font-bold text-white"
          >
            Izinkan lokasi dan lanjut
          </button>
          {message && <p className="text-sm font-semibold text-red-800">{message}</p>}
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
              className={`flex min-h-16 w-full flex-col items-start justify-center rounded-md px-4 text-left text-white disabled:opacity-40 ${c.cls}`}
            >
              <span className="text-lg font-bold">{c.label}</span>
              <span className="text-sm">{c.hint}</span>
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
                className={`min-h-12 rounded-md border-2 px-2 text-sm font-bold ${
                  fuel === f
                    ? "border-blue-900 bg-blue-900 text-white"
                    : "border-slate-400 bg-white text-slate-900"
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
              className="min-h-14 rounded-md bg-green-700 text-base font-bold text-white disabled:opacity-40"
            >
              ✓ Ada
            </button>
            <button
              type="button"
              disabled={!fuel || blocked}
              onClick={() => submit({ fuel, stockStatus: "out" })}
              className="min-h-14 rounded-md bg-slate-800 text-base font-bold text-white disabled:opacity-40"
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
          <p className="text-base font-bold text-green-900">Terima kasih, laporan Anda terkirim.</p>
          <p className="text-sm">
            Anda bisa mengirim laporan serupa untuk SPBU ini lagi setelah {COOLDOWN_MIN} menit.
            Peta akan memperbarui statusnya dalam beberapa saat.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 w-full rounded-md border-2 border-blue-900 font-bold text-blue-900"
          >
            Selesai
          </button>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-800">{message}</p>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setStep("locate"); // re-check the location (covers "too far" and denied cases)
            }}
            className="min-h-12 w-full rounded-md border-2 border-blue-900 font-bold text-blue-900"
          >
            Coba lagi
          </button>
        </div>
      )}
    </div>
  );
}
