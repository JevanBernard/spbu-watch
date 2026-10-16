"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch, setAdminToken } from "@/lib/admin-session";

/** Asks for the admin token, checks it against the server, and keeps it for this browser session only. */
export default function AdminLoginDialog({
  onLoggedIn,
  onClose,
}: {
  onLoggedIn: (token: string) => void;
  onClose: () => void;
}) {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await adminFetch("/api/admin/official", token.trim());
      if (res.status === 401) {
        setMessage("Token salah.");
      } else if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(data.error ?? "Gagal masuk. Coba lagi.");
      } else {
        setAdminToken(token.trim());
        onLoggedIn(token.trim());
      }
    } catch {
      setMessage("Tidak ada koneksi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-label="Masuk mode admin"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm space-y-3 rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
      >
        <h2 className="text-lg font-bold text-slate-900">Masuk mode admin</h2>
        <p className="text-sm text-slate-700">
          Di mode admin, ketuk pin SPBU di peta untuk langsung mengubah kondisinya. Sesi berakhir saat tab ditutup.
        </p>
        <label className="block text-sm font-semibold">
          Token admin
          <input
            ref={input}
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            className="mt-1 min-h-12 w-full rounded-xl border border-line px-3 text-base"
          />
        </label>
        {message && (
          <p role="alert" className="text-sm font-semibold text-status-critical">
            {message}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-xl border-2 border-line font-bold text-slate-800"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="min-h-12 rounded-xl bg-primary font-bold text-white disabled:opacity-50"
          >
            {busy ? "Memeriksa…" : "Masuk"}
          </button>
        </div>
      </form>
    </div>
  );
}
