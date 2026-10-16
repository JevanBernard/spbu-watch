"use client";

import type { OfficialUpdateDTO } from "@/lib/api-types";
import { ChevronRightIcon, MegaphoneIcon } from "./ui";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Makassar",
});

/** One-line strip on the map: latest official announcement. Tapping it opens the Info tab. */
export default function OfficialPanel({
  updates,
  onOpen,
}: {
  updates: OfficialUpdateDTO[];
  onOpen: () => void;
}) {
  const latest = updates[0];
  return (
    <button type="button" onClick={onOpen} className="flex min-h-11 w-full items-center gap-2 px-3 text-left">
      <span className="text-primary">
        <MegaphoneIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-slate-900">Info resmi</span>
        <span className="block truncate text-xs text-slate-700">
          {latest ? latest.title : "Belum ada pengumuman. Untuk kepastian hubungi Call Center 135."}
        </span>
      </span>
      <span className="text-slate-500">
        <ChevronRightIcon />
      </span>
    </button>
  );
}

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
