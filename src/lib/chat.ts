import { createHash } from "node:crypto";
import { z } from "zod";
import { blockedReason, normalizeBody } from "./chat-rules";
import {
  CHAT_COOLDOWN_SEC,
  CHAT_DEVICE_MAX_PER_HOUR,
  CHAT_DUPLICATE_MIN,
  CHAT_FLAGS_TO_HIDE,
  CHAT_IP_MAX_PER_HOUR,
  GEOFENCE_M,
} from "./config";

export const chatSchema = z
  .object({
    deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    body: z.string().max(2_000), // cut-off for abuse only; the real limit is checked after normalising
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    turnstileToken: z.string().max(2048).optional(), // checked in the route, never stored
  })
  .strict();

/** The only shape of a chat message that leaves the server (a whitelist, like anonymizeReports). */
export interface PublicChatMessage {
  id: string;
  nickname: string;
  body: string;
  createdAt: string;
  /** True when it was sent from the device that is asking. Computed server-side, the device id is never sent out. */
  mine: boolean;
}

interface ChatRowLike {
  id: string;
  nickname: string;
  body: string;
  created_at: string;
  device_id: string;
}

export function toPublicMessages(rows: ChatRowLike[], askingDeviceId: string | null): PublicChatMessage[] {
  return rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    body: r.body,
    createdAt: r.created_at,
    mine: askingDeviceId !== null && r.device_id === askingDeviceId,
  }));
}

/** "Pengendara 4F2A": stable for one device at one station, and different at every other station. */
export function nicknameFor(deviceId: string, stationId: string, salt: string): string {
  const h = createHash("sha256").update(`${salt}:chat:${stationId}:${deviceId}`).digest("hex");
  return `Pengendara ${h.slice(0, 4).toUpperCase()}`;
}

export interface NewChatRow {
  station_id: string;
  device_id: string;
  ip_hash: string;
  nickname: string;
  body: string;
}

/** Database access, injected so the rules below can be tested without a database. */
export interface ChatDeps {
  distanceM(stationId: string, lat: number, lng: number): Promise<number | null>;
  /** This device's messages at this station since `sinceIso`, newest first. */
  recentByDevice(deviceId: string, stationId: string, sinceIso: string): Promise<{ body: string; createdAt: string }[]>;
  countDevice(deviceId: string, sinceIso: string): Promise<number>;
  countIp(ipHash: string, sinceIso: string): Promise<number>;
  insert(row: NewChatRow): Promise<{ id: string; createdAt: string }>;
  now(): Date;
}

export interface ChatResult {
  status: 201 | 400 | 403 | 404 | 429;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

const minutesAgo = (now: Date, m: number) => new Date(now.getTime() - m * 60_000).toISOString();

export async function processChatMessage(
  raw: unknown,
  stationId: string,
  ipHash: string,
  salt: string,
  deps: ChatDeps,
): Promise<ChatResult> {
  const parsed = chatSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "Data pesan tidak valid." } };
  const m = parsed.data;

  const body = normalizeBody(m.body);
  const blocked = blockedReason(body);
  if (blocked) return { status: 400, body: { error: blocked } };

  // Same geofence as reports. The coordinates are used only for this check and are never stored.
  const distance = await deps.distanceM(stationId, m.lat, m.lng);
  if (distance === null) return { status: 404, body: { error: "SPBU tidak ditemukan." } };
  if (distance > GEOFENCE_M) {
    return {
      status: 403,
      body: {
        error: `Obrolan hanya bisa dikirim dari dekat SPBU (maksimal ${GEOFENCE_M} meter). Anda sekitar ${Math.round(distance)} meter dari SPBU ini.`,
      },
    };
  }

  const now = deps.now();
  const recent = await deps.recentByDevice(m.deviceId, stationId, minutesAgo(now, CHAT_DUPLICATE_MIN));
  const newest = recent[0];
  if (newest && now.getTime() - new Date(newest.createdAt).getTime() < CHAT_COOLDOWN_SEC * 1000) {
    return {
      status: 429,
      body: { error: `Tunggu ${CHAT_COOLDOWN_SEC} detik sebelum mengirim pesan lagi.` },
      headers: { "Retry-After": String(CHAT_COOLDOWN_SEC) },
    };
  }
  if (recent.some((r) => r.body.toLowerCase() === body.toLowerCase())) {
    return {
      status: 429,
      body: { error: "Pesan yang sama baru saja Anda kirim." },
      headers: { "Retry-After": String(CHAT_DUPLICATE_MIN * 60) },
    };
  }
  const hourSince = minutesAgo(now, 60);
  if ((await deps.countDevice(m.deviceId, hourSince)) >= CHAT_DEVICE_MAX_PER_HOUR) {
    return {
      status: 429,
      body: { error: "Terlalu banyak pesan dari perangkat ini. Coba lagi dalam satu jam." },
      headers: { "Retry-After": "3600" },
    };
  }
  if ((await deps.countIp(ipHash, hourSince)) >= CHAT_IP_MAX_PER_HOUR) {
    return {
      status: 429,
      body: { error: "Terlalu banyak pesan dari jaringan ini. Coba lagi dalam satu jam." },
      headers: { "Retry-After": "3600" },
    };
  }

  const nickname = nicknameFor(m.deviceId, stationId, salt);
  const saved = await deps.insert({
    station_id: stationId,
    device_id: m.deviceId,
    ip_hash: ipHash,
    nickname,
    body,
  });
  const message: PublicChatMessage = { id: saved.id, nickname, body, createdAt: saved.createdAt, mine: true };
  return { status: 201, body: { ok: true, message } };
}

// ---- "Laporkan pesan" ----

export const flagSchema = z.object({ deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }).strict();

export interface FlagDeps {
  /** Records the flag (one per device and message) and returns how many different devices flagged it. null: no such message. */
  addFlag(messageId: string, deviceId: string): Promise<number | null>;
  hide(messageId: string): Promise<void>;
}

export async function processChatFlag(raw: unknown, messageId: string, deps: FlagDeps) {
  const parsed = flagSchema.safeParse(raw);
  if (!parsed.success) return { status: 400 as const, body: { error: "Data tidak valid." } };
  const flags = await deps.addFlag(messageId, parsed.data.deviceId);
  if (flags === null) return { status: 404 as const, body: { error: "Pesan tidak ditemukan." } };
  if (flags >= CHAT_FLAGS_TO_HIDE) await deps.hide(messageId);
  return { status: 200 as const, body: { ok: true } };
}
