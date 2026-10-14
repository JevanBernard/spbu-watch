// MapLibre 6 spawns its web worker from a URL that bundlers (Turbopack) break.
// Serve the worker files from /public/maplibre instead and point MapLibre at them (see MapView).
import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.join(path.dirname(require.resolve("maplibre-gl/package.json")), "dist");
const out = path.join(import.meta.dirname, "..", "public", "maplibre");
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(path.join(dist, f), path.join(out, f));
}
console.log("Copied MapLibre worker files to public/maplibre");
