import type { Metadata, Viewport } from "next";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPBU Watch SARBAGITA",
  description:
    "Pantau antrean dan ketersediaan BBM di SPBU Denpasar, Badung, Gianyar, dan Tabanan dari laporan warga.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-white text-slate-900 antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
