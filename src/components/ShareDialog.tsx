"use client";

import { useEffect, useRef, useState } from "react";
import type { CardModel } from "@/lib/share-card";
import { CARD_SIZE, renderCardImage, type CardFormat } from "@/lib/share-image";

export default function ShareDialog({
  url,
  title,
  text,
  card,
  onClose,
}: {
  url: string;
  title: string;
  text: string;
  /** When given, the dialog also offers a picture of this card to post as a Story or on other social media. */
  card?: CardModel;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // The picture: drawn in the browser, nothing is uploaded anywhere.
  const [format, setFormat] = useState<CardFormat>("story");
  const [img, setImg] = useState<{ url: string; blob: Blob; format: CardFormat; canShareFile: boolean } | null>(null);
  const [imgError, setImgError] = useState(false);
  const fileName = card ? `spbu-watch-${card.slug}-${format}.png` : "spbu-watch.png";

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    renderCardImage(card, format)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const file = new File([blob], `spbu-watch-${card.slug}-${format}.png`, { type: "image/png" });
        const canShareFile = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
        setImg({ url: objectUrl, blob, format, canShareFile });
        setImgError(false);
      })
      .catch(() => {
        if (!cancelled) setImgError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [card, format]);

  const shareImage = async () => {
    if (!img) return;
    try {
      const file = new File([img.blob], fileName, { type: "image/png" });
      await navigator.share({ files: [file], title, text: `${title}
${url}` });
    } catch {
      // cancelled by the user: nothing to do
    }
  };

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

        {card && (
          <section aria-label="Gambar untuk media sosial" className="mt-3 space-y-2 rounded-xl border border-slate-300 p-3">
            <h3 className="text-sm font-bold">Gambar untuk Story dan media sosial</h3>
            <div role="group" aria-label="Ukuran gambar" className="grid grid-cols-2 gap-2">
              {(
                [
                  ["story", "Story (9:16)"],
                  ["square", "Persegi (1:1)"],
                ] as const
              ).map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                  className={`min-h-11 rounded-lg border-2 text-sm font-bold ${
                    format === f ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex justify-center rounded-lg bg-slate-100 p-2">
              {img && img.format === format ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt={`Pratinjau gambar ${card.title}`}
                  width={CARD_SIZE[format].w}
                  height={CARD_SIZE[format].h}
                  className="max-h-80 w-auto max-w-full rounded-md shadow"
                />
              ) : imgError ? (
                <p className="p-6 text-center text-sm text-slate-700">Gambar tidak bisa dibuat di perangkat ini. Gunakan tautan atau kode QR di bawah.</p>
              ) : (
                <p className="p-10 text-sm text-slate-600">Membuat gambar…</p>
              )}
            </div>
            {img && img.format === format && (
              <div className="grid gap-2">
                {img.canShareFile && (
                  <button type="button" onClick={shareImage} className="min-h-12 rounded-lg bg-primary text-base font-bold text-white">
                    Bagikan gambar (Instagram, WhatsApp, …)
                  </button>
                )}
                <a
                  href={img.url}
                  download={fileName}
                  className="flex min-h-12 items-center justify-center rounded-lg border-2 border-primary text-base font-bold text-primary"
                >
                  Unduh gambar (PNG)
                </a>
              </div>
            )}
            <p className="text-xs text-slate-600">
              Instagram tidak bisa diposting langsung dari web. Di HP, pilih Instagram di menu bagikan; atau unduh gambarnya lalu
              unggah sebagai Story. Gambar menunjukkan kondisi saat dibuat, lengkap dengan waktunya.
            </p>
          </section>
        )}

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
