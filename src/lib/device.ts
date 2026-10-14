const KEY = "spbu-watch-device-id";
let memoryId: string | null = null;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join("-");
}

/**
 * Random per-browser ID (not personal data). Falls back to a per-visit ID when
 * localStorage is unavailable, so reporting still works.
 */
export function getDeviceId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const id = randomId();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    memoryId ??= randomId();
    return memoryId;
  }
}
