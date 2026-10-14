/** OpenFreeMap: free OpenStreetMap vector tiles, no API key, no registration, no request limits. */
export const DEFAULT_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/** NEXT_PUBLIC_MAP_STYLE_URL overrides the default; leave it empty to use OpenFreeMap. */
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE;
