import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spbu-watch.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE}/privasi`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
