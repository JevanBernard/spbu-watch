import Link from "next/link";
import { DISCLAIMER } from "@/lib/text";

const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL;

/** Visible address for a mailto: link, so people can copy it even without a mail app. */
export function contactLabel(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("mailto:") ? url.slice(7).split("?")[0] : "Kontak";
}

export default function SiteFooter({
  withDisclaimer = false,
  updatedAt = null,
  className = "",
}: {
  withDisclaimer?: boolean;
  updatedAt?: Date | null;
  className?: string;
}) {
  const label = contactLabel(CONTACT_URL);
  return (
    <footer className={`space-y-1 px-4 text-xs text-slate-600 ${className}`}>
      {withDisclaimer && <p>{DISCLAIMER}</p>}
      <p>
        Peta: OpenFreeMap © OpenMapTiles, data © OpenStreetMap contributors. Lokasi SPBU dari OpenStreetMap (ODbL).
      </p>
      <p>
        Tidak menyimpan koordinat lokasi, plat nomor, atau foto.{" "}
        <Link href="/privasi" className="font-bold underline">
          Kebijakan privasi
        </Link>
        {CONTACT_URL && label && (
          <>
            {" · "}
            <a href={CONTACT_URL} className="font-bold underline" rel="noopener noreferrer">
              {label}
            </a>
          </>
        )}
      </p>
      {updatedAt && (
        <p>
          Diperbarui otomatis tiap 60 detik. Terakhir: {updatedAt.toLocaleTimeString("id-ID", { hour12: false })}
        </p>
      )}
    </footer>
  );
}
