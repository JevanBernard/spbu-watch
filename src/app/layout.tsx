import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jakarta", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spbu-watch.vercel.app";
const TITLE = "SPBU Watch SARBAGITA";
const DESCRIPTION =
  "Pantau antrean dan ketersediaan BBM di SPBU Denpasar, Badung, Gianyar, dan Tabanan dari laporan warga.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // Link preview (WhatsApp, Telegram, etc.). The image must be an absolute URL, 1200x630.
  openGraph: {
    type: "website",
    url: "/",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    locale: "id_ID",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Logo SPBU Watch SARBAGITA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#006194",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="bg-canvas text-ink antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
