"use client";

import type { OfficialUpdateDTO } from "@/lib/api-types";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Makassar",
});

/** Full list of official updates (Info tab). */
export function OfficialList({ updates }: { updates: OfficialUpdateDTO[] }) {
  if (updates.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-white p-4 text-sm text-slate-700">
        Belum ada informasi resmi yang dipublikasikan di sini. Untuk kepastian, hubungi Call Center Pertamina{" "}
        <b>135</b>.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {updates.map((u) => (
        <li key={u.id}>
          <article className="rounded-2xl border border-line bg-white p-4">
            <h3 className="font-bold text-slate-900">
              {u.pinned && (
                <span className="mr-1.5 rounded bg-primary-fixed px-1.5 py-0.5 text-xs text-primary">Disematkan</span>
              )}
              {u.title}
            </h3>
            <p className="mt-1 text-sm whitespace-pre-line text-slate-800">{u.body}</p>
            <p className="tnum mt-2 text-xs text-slate-600">
              {(u.sourceUrl || !u.pinned) && `${dateFmt.format(new Date(u.publishedAt))} WITA · `}
              {u.sourceUrl ? (
                <a href={u.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  {u.sourceName}
                </a>
              ) : (
                u.sourceName
              )}
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}
