"use client";

import { useState } from "react";
import type { OfficialUpdateDTO } from "@/lib/api-types";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Makassar",
});

export default function OfficialPanel({ updates }: { updates: OfficialUpdateDTO[] }) {
  const [open, setOpen] = useState(false);
  const latest = updates.slice(0, 3);
  return (
    <section className="rounded-lg border border-slate-300 bg-white shadow-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm font-bold"
      >
        <span>Informasi resmi</span>
        <span className="text-xs font-normal text-slate-600">
          Call Center Pertamina <b>135</b> {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-200 px-3 py-3 text-sm">
          {latest.length === 0 && (
            <p className="text-slate-700">
              Belum ada informasi resmi yang dipublikasikan di sini. Untuk kepastian, hubungi
              Call Center Pertamina <b>135</b>.
            </p>
          )}
          {latest.map((u) => (
            <article key={u.id}>
              <h3 className="font-bold">{u.title}</h3>
              <p className="whitespace-pre-line text-slate-800">{u.body}</p>
              <p className="mt-1 text-xs text-slate-600">
                {dateFmt.format(new Date(u.publishedAt))} WITA ·{" "}
                {u.sourceUrl ? (
                  <a
                    href={u.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {u.sourceName}
                  </a>
                ) : (
                  u.sourceName
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
