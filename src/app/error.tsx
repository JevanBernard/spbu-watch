"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-xl font-bold">Terjadi kesalahan</h1>
      <p className="text-sm text-slate-700">
        Halaman tidak dapat ditampilkan. Coba lagi sebentar lagi.
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-12 rounded-md bg-blue-900 px-6 font-bold text-white"
      >
        Coba lagi
      </button>
    </main>
  );
}
