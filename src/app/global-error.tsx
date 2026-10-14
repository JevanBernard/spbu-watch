"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: "sans-serif", padding: 24, textAlign: "center" }}>
        <h1>Terjadi kesalahan</h1>
        <p>Aplikasi tidak dapat dimuat. Coba lagi sebentar lagi.</p>
        <button onClick={reset} style={{ minHeight: 48, padding: "0 24px", fontWeight: 700 }}>
          Coba lagi
        </button>
      </body>
    </html>
  );
}
