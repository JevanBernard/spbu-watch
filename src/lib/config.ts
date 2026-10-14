// All tunable constants for the status algorithm and anti-abuse rules.
export const QUEUE_TTL_MIN = 45;
export const STOCK_TTL_MIN = 60;
export const HALF_LIFE_MIN = 20;
export const MIN_DEVICES_FOR_OUT = 3; // distinct devices needed before showing "habis"
export const DOMINANCE = 0.6; // share of weighted votes needed to call a status
export const GEOFENCE_M = 300;

// Report rate limits (SPEC section 8).
export const REPORT_COOLDOWN_MIN = 10; // per device, per (station, kind, fuel)
export const DEVICE_MAX_PER_HOUR = 20;
export const IP_MAX_PER_HOUR = 60;
