"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { clearAdminToken, getAdminToken, setAdminToken } from "@/lib/admin-session";
import { FUEL_LABEL, FUEL_ORDER, QUEUE_LABEL, timeAgo } from "@/lib/format";
import type { StationDTO } from "@/lib/api-types";
import type { Fuel } from "@/lib/status";

interface Update {
  id: string;
  title: string;
  body: string;
  source_name: string;
  source_url: string | null;
  published_at: string;
  pinned: boolean;
  active: boolean;
}
interface AdminReport {
  id: string;
  station: string;
  kind: "queue" | "stock";
  queueLevel: number | null;
  fuel: Fuel | null;
  stockStatus: "available" | "out" | null;
  device: string;
  hidden: boolean;
  createdAt: string;
}

interface AdminChat {
  id: string;
  station: string;
  nickname: string;
  body: string;
  hidden: boolean;
  createdAt: string;
}

type AdminStation = Pick<StationDTO, "id" | "name" | "regency" | "pertaminaCode" | "fuels">;

const input = "min-h-11 w-full rounded-md border border-slate-400 px-3 text-base";
const btn = "min-h-11 rounded-md px-3 text-sm font-bold";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = () => ({
  title: "",
  body: "",
  sourceName: "",
  sourceUrl: "",
  publishedAt: toLocalInput(new Date().toISOString()),
  pinned: false,
  active: true,
});

export default function AdminClient() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [chat, setChat] = useState<AdminChat[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [stations, setStations] = useState<AdminStation[]>([]);
  const [stationQuery, setStationQuery] = useState("");
  const [stationId, setStationId] = useState("");
  const [sendingReport, setSendingReport] = useState(false);

  const api = useCallback(
    async (path: string, tok: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", "x-admin-token": tok },
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    [],
  );

  const load = useCallback(
    async (tok: string) => {
      const [u, r, c] = await Promise.all([
        api("/api/admin/official", tok),
        api("/api/admin/reports", tok),
        api("/api/admin/chat", tok),
      ]);
      if (u.status === 401) {
        setAuthed(false);
        setMsg("Token salah.");
        return false;
      }
      if (!u.ok) {
        setAuthed(false);
        setMsg(u.data.error ?? "Gagal memuat.");
        return false;
      }
      setUpdates(u.data.updates);
      setReports(r.ok ? r.data.reports : []);
      setChat(c.ok ? c.data.messages : []); // empty until migration 0006 (chat) has been run
      if (stations.length === 0) {
        const s = await fetch("/api/stations")
          .then((x) => x.json())
          .catch(() => null);
        if (s?.stations) setStations(s.stations);
      }
      setAuthed(true);
      setMsg(null);
      return true;
    },
    [api, stations.length],
  );

  // Reuse the session started in the map's admin mode, so the token is typed once per browser tab.
  useEffect(() => {
    const saved = getAdminToken();
    if (!saved) return;
    queueMicrotask(() => {
      setToken(saved);
      void load(saved);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await load(token)) setAdminToken(token);
  };

  const logout = () => {
    clearAdminToken();
    setToken("");
    setAuthed(false);
    setUpdates([]);
    setReports([]);
    setChat([]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      body: form.body,
      sourceName: form.sourceName,
      sourceUrl: form.sourceUrl.trim() || null,
      publishedAt: new Date(form.publishedAt).toISOString(),
      pinned: form.pinned,
      active: form.active,
    };
    const res = editingId
      ? await api("/api/admin/official", token, {
          method: "PATCH",
          body: JSON.stringify({ id: editingId, ...payload }),
        })
      : await api("/api/admin/official", token, { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) {
      setMsg(res.data.error ?? "Gagal menyimpan.");
      return;
    }
    const done = editingId ? "Perubahan disimpan." : "Informasi diterbitkan.";
    setEditingId(null);
    setForm(emptyForm());
    await load(token);
    setMsg(done);
  };

  const edit = (u: Update) => {
    setEditingId(u.id);
    setForm({
      title: u.title,
      body: u.body,
      sourceName: u.source_name,
      sourceUrl: u.source_url ?? "",
      publishedAt: toLocalInput(u.published_at),
      pinned: u.pinned,
      active: u.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggle = async (u: Update, key: "active" | "pinned") => {
    const res = await api("/api/admin/official", token, {
      method: "PATCH",
      body: JSON.stringify({ id: u.id, [key]: !u[key] }),
    });
    await load(token);
    if (!res.ok) setMsg(res.data.error ?? "Gagal mengubah.");
  };

  const sendReport = async (body: Record<string, unknown>, label: string) => {
    if (!stationId) {
      setMsg("Pilih SPBU dulu.");
      return;
    }
    setSendingReport(true);
    const res = await api("/api/admin/reports", token, {
      method: "POST",
      body: JSON.stringify({ stationId, ...body }),
    });
    setSendingReport(false);
    if (!res.ok) {
      setMsg(res.data.error ?? "Gagal mengirim laporan.");
      return;
    }
    await load(token);
    setMsg(`Laporan terkirim: ${label}.`);
  };

  const hideChat = async (m: AdminChat) => {
    if (!confirm("Sembunyikan pesan obrolan ini?")) return;
    const res = await api(`/api/admin/chat/${m.id}/hide`, token, { method: "POST" });
    await load(token);
    setMsg(res.ok ? "Pesan disembunyikan." : (res.data.error ?? "Gagal."));
  };

  const hide = async (r: AdminReport) => {
    if (!confirm("Sembunyikan laporan ini? Laporan tidak akan dihitung lagi.")) return;
    const res = await api(`/api/admin/reports/${r.id}/hide`, token, { method: "POST" });
    await load(token);
    setMsg(res.ok ? "Laporan disembunyikan." : (res.data.error ?? "Gagal."));
  };

  if (!authed) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-4">
        <h1 className="text-xl font-bold">Admin SPBU Watch</h1>
        <form onSubmit={login} className="space-y-3">
          <label className="block text-sm font-semibold">
            Token admin
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              className={`${input} mt-1`}
            />
          </label>
          <button type="submit" className={`${btn} w-full bg-primary text-white`}>
            Masuk
          </button>
          {msg && <p className="text-sm font-semibold text-red-800">{msg}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-4 pb-16">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Admin SPBU Watch</h1>
          <Link href="/" className="text-sm font-bold text-primary underline">
            Ubah kondisi SPBU lewat peta
          </Link>
        </div>
        <button onClick={logout} className={`${btn} border border-slate-400`}>
          Keluar
        </button>
      </header>
      {msg && <p className="rounded bg-primary-fixed p-2 text-sm font-semibold">{msg}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{editingId ? "Ubah informasi resmi" : "Informasi resmi baru"}</h2>
        <p className="text-sm text-slate-700">
          Hanya terbitkan informasi yang punya sumber jelas. Isi nama sumber dan tautan asli.
        </p>
        <form onSubmit={save} className="space-y-3">
          <input
            required
            maxLength={200}
            placeholder="Judul"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={input}
          />
          <textarea
            required
            maxLength={2000}
            rows={4}
            placeholder="Isi informasi"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className={`${input} py-2`}
          />
          <input
            required
            maxLength={100}
            placeholder="Nama sumber (mis. Pertamina Patra Niaga)"
            value={form.sourceName}
            onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
            className={input}
          />
          <input
            type="url"
            maxLength={500}
            placeholder="Tautan sumber (https://…)"
            value={form.sourceUrl}
            onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
            className={input}
          />
          <label className="block text-sm font-semibold">
            Tanggal terbit (waktu perangkat ini)
            <input
              required
              type="datetime-local"
              value={form.publishedAt}
              onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
              className={`${input} mt-1`}
            />
          </label>
          <div className="flex gap-6">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="size-5"
              />
              Sematkan di atas
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="size-5"
              />
              Tampil
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={`${btn} bg-primary text-white`}>
              {editingId ? "Simpan perubahan" : "Terbitkan"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm());
                }}
                className={`${btn} border border-slate-400`}
              >
                Batal
              </button>
            )}
          </div>
        </form>

        <ul className="divide-y divide-slate-200 rounded-md border border-slate-300">
          {updates.length === 0 && <li className="p-3 text-sm text-slate-600">Belum ada.</li>}
          {updates.map((u) => (
            <li key={u.id} className="space-y-1 p-3">
              <p className="font-bold">
                {u.title}{" "}
                {u.pinned && <span className="text-xs text-primary">[disematkan]</span>}{" "}
                {!u.active && <span className="text-xs text-red-800">[disembunyikan]</span>}
              </p>
              <p className="text-xs text-slate-600">
                {new Date(u.published_at).toLocaleString("id-ID")} · {u.source_name}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => edit(u)} className={`${btn} border border-slate-400`}>
                  Ubah
                </button>
                <button onClick={() => toggle(u, "active")} className={`${btn} border border-slate-400`}>
                  {u.active ? "Sembunyikan" : "Tampilkan"}
                </button>
                <button onClick={() => toggle(u, "pinned")} className={`${btn} border border-slate-400`}>
                  {u.pinned ? "Lepas sematan" : "Sematkan"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Lapor kondisi SPBU (admin)</h2>
        <p className="text-sm text-slate-700">
          Untuk laporan dari pantauan jarak jauh, mis. CCTV. Tidak dibatasi jarak. Laporan &quot;habis&quot; dari admin langsung
          tampil sebagai habis. Laporkan hanya yang benar-benar Anda lihat.
        </p>
        <input
          placeholder="Cari SPBU (nama atau kode)"
          value={stationQuery}
          onChange={(e) => setStationQuery(e.target.value)}
          className={input}
        />
        <select
          aria-label="Pilih SPBU"
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          className={input}
          size={6}
        >
          {stations
            .filter((s) =>
              `${s.name} ${s.pertaminaCode ?? ""} ${s.regency}`.toLowerCase().includes(stationQuery.trim().toLowerCase()),
            )
            .slice(0, 60)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.regency})
              </option>
            ))}
        </select>
        {stationId && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Antrean</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(["sepi", "sedang", "panjang"] as const).map((k, level) => (
                  <button
                    key={k}
                    disabled={sendingReport}
                    onClick={() => sendReport({ kind: "queue", queueLevel: level }, QUEUE_LABEL[k])}
                    className={`${btn} border border-slate-400`}
                  >
                    {QUEUE_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Stok BBM</p>
              <ul className="space-y-2 pt-1">
                {FUEL_ORDER.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-32 text-sm">{FUEL_LABEL[f]}</span>
                    <button
                      disabled={sendingReport}
                      onClick={() => sendReport({ kind: "stock", fuel: f, stockStatus: "available" }, `${FUEL_LABEL[f]} ada`)}
                      className={`${btn} border border-slate-400`}
                    >
                      Ada
                    </button>
                    <button
                      disabled={sendingReport}
                      onClick={() => sendReport({ kind: "stock", fuel: f, stockStatus: "out" }, `${FUEL_LABEL[f]} habis`)}
                      className={`${btn} border border-red-800 text-red-800`}
                    >
                      Habis
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Moderasi laporan (24 jam terakhir)</h2>
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-300">
          {reports.length === 0 && <li className="p-3 text-sm text-slate-600">Belum ada laporan.</li>}
          {reports.map((r) => (
            <li key={r.id} className={`space-y-1 p-3 ${r.hidden ? "bg-slate-100 opacity-60" : ""}`}>
              <p className="text-sm font-bold">{r.station}</p>
              <p className="text-sm">
                {r.kind === "queue"
                  ? QUEUE_LABEL[(["sepi", "sedang", "panjang"] as const)[r.queueLevel ?? 0]]
                  : `${FUEL_LABEL[r.fuel!]}: ${r.stockStatus === "out" ? "HABIS" : "ada"}`}
              </p>
              <p className="text-xs text-slate-600">
                {timeAgo(r.createdAt)} · {r.device.startsWith("admin") ? "admin (CCTV)" : `perangkat ${r.device}`}
              </p>
              {r.hidden ? (
                <p className="text-xs font-bold">Disembunyikan</p>
              ) : (
                <button onClick={() => hide(r)} className={`${btn} border border-red-800 text-red-800`}>
                  Sembunyikan
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Moderasi obrolan (24 jam terakhir)</h2>
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-300">
          {chat.length === 0 && <li className="p-3 text-sm text-slate-600">Belum ada pesan.</li>}
          {chat.map((m) => (
            <li key={m.id} className={`space-y-1 p-3 ${m.hidden ? "bg-slate-100 opacity-60" : ""}`}>
              <p className="text-sm font-bold">{m.station}</p>
              <p className="text-sm break-words">{m.body}</p>
              <p className="text-xs text-slate-600">
                {timeAgo(m.createdAt)} · {m.nickname}
              </p>
              {m.hidden ? (
                <p className="text-xs font-bold">Disembunyikan</p>
              ) : (
                <button onClick={() => hideChat(m)} className={`${btn} border border-red-800 text-red-800`}>
                  Sembunyikan
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
