"use client";

import { useState } from "react";
import type { OfficialUpdateDTO } from "@/lib/api-types";
import { FUEL_LABEL, FUEL_ORDER } from "@/lib/format";
import { asOfText, FUEL_PRICES, rupiah } from "@/lib/prices";

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
          <section>
            <h3 className="font-bold">Harga BBM di {FUEL_PRICES.region}</h3>
            <ul className="mt-1 divide-y divide-slate-100">
              {FUEL_ORDER.filter((f) => FUEL_PRICES.prices[f] !== undefined).map((f) => (
                <li key={f} className="flex justify-between gap-2 py-0.5">
                  <span>{FUEL_LABEL[f]}</span>
                  <b className="whitespace-nowrap">{rupiah(FUEL_PRICES.prices[f] as number)}</b>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-600">
              Per {asOfText(FUEL_PRICES.asOf)}. Sumber: {FUEL_PRICES.source}. Harga bisa berubah dan berbeda
              di Pertashop.
            </p>
          </section>
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
