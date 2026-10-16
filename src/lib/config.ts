// All tunable constants for the status algorithm and anti-abuse rules.
export const QUEUE_TTL_MIN = 45;
export const STOCK_TTL_MIN = 60;
export const HALF_LIFE_MIN = 20;
export const MIN_DEVICES_FOR_OUT = 3; // distinct devices needed before showing "habis"
/** Reports entered by the admin (e.g. from CCTV) are stored under this device id; "habis" from it needs no extra devices. */
export const ADMIN_DEVICE_ID = "admin-cctv";
/** The admin's latest report per station/kind/fuel stays visible (marked as old) until replaced, for at most this long. Matches the 30-day report retention. */
export const ADMIN_KEEP_DAYS = 30;
/** An admin "habis" report counts as confirmed for this long; after that it shows as "belum terkonfirmasi" (the report time stays visible). */
export const ADMIN_OUT_CONFIRMED_MIN = 6 * 60;
/**
 * Queue level from the admin (watching CCTV) is a direct observation: while it is fresh (within QUEUE_TTL_MIN) and
 * newer than every visitor report, it decides the queue status alone. A newer visitor report goes back to the blend.
 */
/** After this long an admin queue report is no longer shown as a status (queues change in minutes). Only the
 * "last watched by admin X ago" text stays. Stock keeps its own rule (ADMIN_OUT_CONFIRMED_MIN, ADMIN_KEEP_DAYS). */
export const ADMIN_QUEUE_SHOW_MIN = 120;
/**
 * "SPBU buka / tutup" reports. Valid for OPEN_TTL_MIN. A confirmed "tutup" needs MIN_DEVICES_FOR_CLOSED devices
 * (like "habis"), or the admin who watches the station directly. An admin report older than ADMIN_OPEN_SHOW_MIN
 * is no longer shown as a status.
 */
export const OPEN_TTL_MIN = 120;
export const MIN_DEVICES_FOR_CLOSED = 3;
export const ADMIN_OPEN_SHOW_MIN = 6 * 60;
export const DOMINANCE = 0.6; // share of weighted votes needed to call a status
export const GEOFENCE_M = 500;

/** "Pilihan alternatif": other stations within this distance, listed by distance only (never by stock). */
export const ALT_RADIUS_M = 5000;
/** Rough travel-time estimate: motorbike, straight-line distance times a road factor. Not navigation. */
export const TRAVEL_KMH = 25;
export const ROAD_FACTOR = 1.3;

// Report rate limits (SPEC section 8).
export const REPORT_COOLDOWN_MIN = 10; // per device, per (station, kind, fuel)
export const DEVICE_MAX_PER_HOUR = 20;
export const IP_MAX_PER_HOUR = 60;

// A fuel counts as "sold here" when this many distinct devices reported it available within the window.
// Only "available" reports count: a report of "out" must never remove a fuel from the list.
export const FUEL_SOLD_MIN_DEVICES = 2;
export const FUEL_SOLD_WINDOW_DAYS = 30;

// Live chat per station (see lib/chat.ts). Reading is open to everyone; writing needs to be within GEOFENCE_M.
export const CHAT_MAX_LEN = 200;
export const CHAT_VISIBLE_HOURS = 6; // older messages are not shown
export const CHAT_RETENTION_DAYS = 2; // and are deleted after this long
export const CHAT_COOLDOWN_SEC = 10; // between two messages from one device
export const CHAT_DUPLICATE_MIN = 10; // the same text from one device at one station is refused for this long
export const CHAT_DEVICE_MAX_PER_HOUR = 30;
export const CHAT_IP_MAX_PER_HOUR = 120;
export const CHAT_FLAGS_TO_HIDE = 3; // different devices that must flag a message before it is hidden
export const CHAT_POLL_MS = 5_000; // refresh interval while the chat tab is open
