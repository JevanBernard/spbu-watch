import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privasi · SPBU Watch SARBAGITA",
  description: "Data apa yang disimpan dan tidak disimpan oleh SPBU Watch SARBAGITA.",
};

const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL;

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 pb-16 leading-relaxed">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-900 underline">
        ← Kembali ke peta
      </Link>
      <h1 className="text-2xl font-bold">Privasi</h1>
      <p className="rounded-lg bg-yellow-100 p-3 text-sm font-semibold text-yellow-950">
        SPBU Watch SARBAGITA bukan produk resmi Pertamina. Data berasal dari laporan warga dan
        bersifat indikatif. Cek kanal resmi untuk kepastian.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Yang kami simpan</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Isi laporan:</b> SPBU yang dilaporkan, tingkat antrean atau status stok (jenis BBM,
            ada atau habis), dan waktu laporan.
          </li>
          <li>
            <b>ID perangkat acak:</b> kode acak yang dibuat di peramban Anda dan disimpan di
            penyimpanan lokal peramban. Kode ini bukan nama, nomor telepon, atau akun, dan hanya
            dipakai untuk membatasi laporan ganda dan menghitung berapa perangkat berbeda yang
            melapor.
          </li>
          <li>
            <b>Hash IP:</b> alamat IP Anda diubah menjadi kode hash bergaram sebelum disimpan,
            hanya untuk membatasi penyalahgunaan. Alamat IP aslinya tidak disimpan.
          </li>
          <li>
            <b>Penghitung pengunjung:</b> untuk menampilkan jumlah pengunjung, kami menyimpan kode hash
            acak yang berubah tiap hari (dibuat dari alamat IP, ID perangkat, dan garam rahasia) beserta
            waktu terakhir terlihat. Kode ini tidak bisa dikembalikan menjadi IP atau ID perangkat dan
            tidak bisa dihubungkan antarhari. Data ini dihapus otomatis setelah 7 hari.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Yang tidak kami simpan</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Lokasi persis Anda.</b> Koordinat dikirim saat melapor hanya untuk memastikan Anda
            berada dalam 300 meter dari SPBU, lalu dibuang. Urutan daftar berdasarkan jarak
            dihitung di perangkat Anda dan tidak dikirim ke server.
          </li>
          <li>Plat nomor, wajah, foto, atau video. Aplikasi ini tidak menerima unggahan foto.</li>
          <li>Nama, email, nomor telepon, atau akun. Tidak ada login.</li>
          <li>Tidak ada cookie pelacak dan tidak ada analitik iklan.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Berapa lama</h2>
        <p>
          Laporan dihapus otomatis setelah 30 hari. Status di peta hanya memakai laporan terbaru
          (antrean 45 menit, stok 60 menit); laporan yang lebih lama tidak lagi memengaruhi
          tampilan.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Pihak ketiga</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>OpenFreeMap</b> menyajikan gambar peta (data OpenStreetMap), sehingga peramban Anda terhubung ke
            server mereka saat peta dimuat. Mereka menyatakan tidak memakai cookie dan tidak meminta pendaftaran.
          </li>
          <li>
            <b>Supabase</b> dan <b>Vercel</b> menjadi tempat database dan hosting aplikasi ini.
          </li>
          <li>
            <b>Cloudflare Turnstile</b> dapat dipakai untuk mencegah laporan otomatis (bot) saat
            fitur itu aktif.
          </li>
          <li>
            Data lokasi SPBU berasal dari <b>OpenStreetMap</b> © OpenStreetMap contributors
            (lisensi ODbL).
          </li>
          <li>
            Tombol &quot;Rute&quot; hanya membuka tautan Google Maps di tab baru; tidak ada data
            dikirim ke Google dari aplikasi ini sebelum Anda mengekliknya.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Kontak</h2>
        <p>
          Untuk pertanyaan privasi atau permintaan penghapusan laporan:{" "}
          {CONTACT_URL ? (
            <a href={CONTACT_URL} className="font-bold text-blue-900 underline" rel="noopener noreferrer">
              hubungi kami
            </a>
          ) : (
            <b>(kontak belum diatur oleh pengelola)</b>
          )}
          .
        </p>
      </section>
    </main>
  );
}
