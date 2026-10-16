"use client";

import { useEffect, useRef, useState } from "react";

export default function ShareDialog({
  url,
  title,
  text,
  onClose,
}: {
  url: string;
  title: string;
  text: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((m) => m.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M" }))
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMsg("Tautan disalin");
    } catch {
      input.current?.select(); // fallback: the link is selected, the user can copy it by hand
      setMsg("Tautan dipilih. Salin secara manual.");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text, url });
    } catch {
      // cancelled by the user: nothing to do
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bagikan"
        className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="min-h-11 min-w-11 rounded-md border border-slate-400 text-sm font-bold"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-700">{text}</p>

        <div className="mt-3 flex gap-2">
          <input
            ref={input}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Tautan"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-400 px-2 text-sm"
          />
          <button type="button" onClick={copy} className="min-h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-bold text-white">
            Salin
          </button>
        </div>
        {msg && <p className="mt-1 text-sm font-semibold text-green-900">{msg}</p>}

        <div className="mt-4 flex flex-col items-center gap-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Kode QR untuk membuka tautan" width={224} height={224} className="rounded border border-slate-300" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded border border-slate-300 text-sm text-slate-600">Membuat kode QR…</div>
          )}
          <p className="text-center text-xs text-slate-600">Pindai dengan kamera ponsel untuk membuka tautan.</p>
          {qr && (
            <a href={qr} download="spbu-watch-qr.png" className="flex min-h-11 items-center rounded-md border border-slate-400 px-4 text-sm font-bold">
              Unduh gambar QR
            </a>
          )}
        </div>

        {canShare && (
          <button type="button" onClick={nativeShare} className="mt-3 min-h-12 w-full rounded-md border-2 border-primary text-base font-bold text-primary">
            Bagikan lewat aplikasi lain…
          </button>
        )}
      </div>
    </div>
  );
}
