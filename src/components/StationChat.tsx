"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StationDTO } from "@/lib/api-types";
import type { PublicChatMessage } from "@/lib/chat";
import { blockedReason } from "@/lib/chat-rules";
import { adminFetch } from "@/lib/admin-session";
import { CHAT_MAX_LEN, CHAT_POLL_MS, CHAT_VISIBLE_HOURS, GEOFENCE_M } from "@/lib/config";
import { getDeviceId } from "@/lib/device";
import { timeAgo } from "@/lib/format";
import TurnstileWidget, { TURNSTILE_SITE_KEY } from "./TurnstileWidget";
import { LocateIcon } from "./ui";

type Coords = { lat: number; lng: number };

/**
 * Live chat of one station. Everyone can read; only people within GEOFENCE_M of the station can write.
 * It never changes the queue or stock status: those come from reports only (anti-panic rule).
 */
export default function StationChat({
  station,
  distance,
  me,
  geoMsg,
  onLocate,
  adminToken,
}: {
  station: StationDTO;
  distance: number | null;
  me: Coords | null;
  geoMsg: string | null;
  onLocate: () => void;
  adminToken: string | null;
}) {
  const [messages, setMessages] = useState<PublicChatMessage[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRun, setCaptchaRun] = useState(0);
  const onCaptcha = useCallback((t: string | null) => setCaptcha(t), []);
  const list = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Poll while this tab is open and the page is visible. No-store: the answer is personalised and must be current.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/stations/${station.id}/chat`, { cache: "no-store", headers: { "x-device-id": getDeviceId() } })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json() as Promise<{ messages: PublicChatMessage[] }>;
        })
        .then((json) => {
          if (cancelled) return;
          setMessages(json.messages);
          setLoadError(false);
        })
        .catch(() => {
          if (!cancelled) setLoadError(true);
        });
    };
    refresh();
    const timer = setInterval(refresh, CHAT_POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [station.id, reloadKey]);

  // Follow new messages only while the reader is at the bottom, so reading older ones is not interrupted.
  useEffect(() => {
    const el = list.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const inRange = distance !== null && distance <= GEOFENCE_M;
  const blocked = Boolean(TURNSTILE_SITE_KEY) && !captcha;
  const problem = text.trim() ? blockedReason(text) : null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || sending || blockedReason(text) !== null) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/stations/${station.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          body: text,
          lat: me.lat,
          lng: me.lng,
          ...(captcha ? { turnstileToken: captcha } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: PublicChatMessage; error?: string };
      if (res.status === 201 && data.message) {
        stickToBottom.current = true;
        setMessages((cur) => [...(cur ?? []), data.message!]);
        setText("");
        setReloadKey((k) => k + 1);
      } else {
        setNotice({ kind: "error", text: data.error ?? "Pesan gagal dikirim. Coba lagi." });
      }
    } catch {
      setNotice({ kind: "error", text: "Tidak ada koneksi. Pesan belum terkirim." });
    }
    // A Turnstile token works once.
    setCaptcha(null);
    setCaptchaRun((n) => n + 1);
    setSending(false);
  };

  const flag = async (m: PublicChatMessage) => {
    if (!confirm("Laporkan pesan ini sebagai tidak pantas atau menyesatkan?")) return;
    try {
      const res = await fetch(`/api/stations/${station.id}/chat/${m.id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setMessages((cur) => (cur ?? []).filter((x) => x.id !== m.id)); // gone from this reader's view at once
      setNotice({ kind: "info", text: "Terima kasih, pesan dilaporkan." });
    } catch {
      setNotice({ kind: "error", text: "Gagal melaporkan pesan. Coba lagi." });
    }
  };

  const hideAsAdmin = async (m: PublicChatMessage) => {
    if (!adminToken) return;
    try {
      const res = await adminFetch(`/api/admin/chat/${m.id}/hide`, adminToken, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setMessages((cur) => (cur ?? []).filter((x) => x.id !== m.id));
    } catch {
      setNotice({ kind: "error", text: "Gagal menyembunyikan pesan." });
    }
  };

  return (
    <section aria-label="Obrolan SPBU" className="flex min-h-0 flex-col gap-3">
      <p className="rounded-xl bg-disclaimer-bg p-3 text-xs leading-relaxed font-semibold text-disclaimer-amber">
        Obrolan sesama pengguna. <b>Belum diverifikasi</b>, bukan informasi resmi, dan <b>tidak mengubah</b> status
        antrean atau stok. Jangan menyebarkan kabar yang belum Anda lihat sendiri. Pesan hilang setelah{" "}
        {CHAT_VISIBLE_HOURS} jam.
      </p>

      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="max-h-80 min-h-40 space-y-2 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-canvas p-3"
        aria-live="polite"
      >
        {messages === null && !loadError && <p className="text-sm text-slate-600">Memuat obrolan…</p>}
        {loadError && messages === null && (
          <p className="text-sm text-slate-700">Obrolan belum bisa dimuat. Coba lagi nanti.</p>
        )}
        {messages !== null && messages.length === 0 && (
          <p className="text-sm text-slate-700">
            Belum ada pesan dalam {CHAT_VISIBLE_HOURS} jam terakhir. Jadilah yang pertama, jika Anda sedang di SPBU ini.
          </p>
        )}
        {messages?.map((m) => (
          <article
            key={m.id}
            className={`rounded-xl p-2.5 text-sm ${m.mine ? "ml-6 bg-primary-fixed" : "mr-6 bg-white"} shadow-sm`}
          >
            <p className="flex items-baseline justify-between gap-2 text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">{m.mine ? "Anda" : m.nickname}</span>
              <span className="tnum">{timeAgo(m.createdAt)}</span>
            </p>
            <p className="mt-0.5 break-words whitespace-pre-line text-slate-900">{m.body}</p>
            <div className="mt-1 flex gap-3">
              {!m.mine && (
                <button type="button" onClick={() => flag(m)} className="min-h-9 text-[11px] font-semibold text-slate-600 underline">
                  Laporkan
                </button>
              )}
              {adminToken && (
                <button
                  type="button"
                  onClick={() => hideAsAdmin(m)}
                  className="min-h-9 text-[11px] font-bold text-status-critical underline"
                >
                  Sembunyikan (admin)
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {inRange ? (
        <form onSubmit={send} className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Tulis pesan untuk pengguna di SPBU ini
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={CHAT_MAX_LEN + 50}
              rows={2}
              placeholder="Contoh: antrean motor sekitar 10, mobil sepi"
              className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-base"
            />
          </label>
          {TURNSTILE_SITE_KEY && <TurnstileWidget key={captchaRun} onToken={onCaptcha} />}
          {problem && <p className="text-xs font-semibold text-status-critical">{problem}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className={`tnum text-xs ${text.length > CHAT_MAX_LEN ? "font-bold text-status-critical" : "text-slate-600"}`}>
              {text.trim().length}/{CHAT_MAX_LEN}
            </span>
            <button
              type="submit"
              disabled={sending || blocked || !text.trim() || problem !== null}
              className="min-h-12 rounded-xl bg-primary px-6 text-base font-bold text-white disabled:opacity-50"
            >
              {sending ? "Mengirim…" : "Kirim"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2 rounded-2xl border border-line bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">
            Hanya pengguna dalam radius {GEOFENCE_M} meter dari SPBU ini yang bisa mengirim pesan.
          </p>
          {me && distance !== null ? (
            <p className="text-sm text-slate-700">Anda sekitar {Math.round(distance)} meter dari SPBU ini. Anda tetap bisa membaca obrolan.</p>
          ) : (
            <>
              <p className="text-sm text-slate-700">Izinkan lokasi supaya kami bisa memeriksa jarak Anda. Lokasi tidak disimpan.</p>
              <button
                type="button"
                onClick={onLocate}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-white"
              >
                <LocateIcon />
                Izinkan lokasi
              </button>
              {geoMsg && <p className="text-xs text-slate-700">{geoMsg}</p>}
            </>
          )}
        </div>
      )}

      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} className={`text-sm font-semibold ${notice.kind === "error" ? "text-status-critical" : "text-status-smooth"}`}>
          {notice.text}
        </p>
      )}
    </section>
  );
}
