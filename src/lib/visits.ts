import { createHash } from "node:crypto";

/** Day (YYYY-MM-DD) in WITA, UTC+8, matching the database functions. */
export function witaDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Anonymous visitor key: salted hash of (day, ip, device id). Changes every day, so visits cannot be
 * linked across days, and the ip and device id cannot be recovered from it.
 */
export function visitorHash(ip: string, deviceId: string, salt: string, day: string): string {
  return createHash("sha256").update(`${salt}:visit:${day}:${ip}:${deviceId}`).digest("hex");
}
