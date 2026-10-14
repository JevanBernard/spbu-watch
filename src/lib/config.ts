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
export const DOMINANCE = 0.6; // share of weighted votes needed to call a status
export const GEOFENCE_M = 300;

// Report rate limits (SPEC section 8).
export const REPORT_COOLDOWN_MIN = 10; // per device, per (station, kind, fuel)
export const DEVICE_MAX_PER_HOUR = 20;
export const IP_MAX_PER_HOUR = 60;

// A fuel counts as "sold here" when this many distinct devices reported it available within the window.
// Only "available" reports count: a report of "out" must never remove a fuel from the list.
export const FUEL_SOLD_MIN_DEVICES = 2;
export const FUEL_SOLD_WINDOW_DAYS = 30;
