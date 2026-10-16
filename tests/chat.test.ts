import { describe, expect, it } from "vitest";
import { blockedReason, normalizeBody } from "@/lib/chat-rules";
import {
  nicknameFor,
  processChatFlag,
  processChatMessage,
  toPublicMessages,
  type ChatDeps,
  type FlagDeps,
  type NewChatRow,
} from "@/lib/chat";
import { CHAT_COOLDOWN_SEC, CHAT_DEVICE_MAX_PER_HOUR, CHAT_DUPLICATE_MIN, CHAT_FLAGS_TO_HIDE, CHAT_IP_MAX_PER_HOUR, CHAT_MAX_LEN, GEOFENCE_M } from "@/lib/config";

const STATION = "11111111-1111-4111-8111-111111111111";
const DEVICE = "device-abcdef12";
const NOW = new Date("2026-10-14T12:00:00Z");
const ago = (sec: number) => new Date(NOW.getTime() - sec * 1000).toISOString();
const msg = (body: string, over: object = {}) => ({ deviceId: DEVICE, body, lat: -8.65, lng: 115.2, ...over });

function makeDeps(over: Partial<ChatDeps> = {}) {
  const inserted: NewChatRow[] = [];
  const deps: ChatDeps = {
    distanceM: async () => 10,
    recentByDevice: async () => [],
    countDevice: async () => 0,
    countIp: async () => 0,
    insert: async (row) => {
      inserted.push(row);
      return { id: "msg-1", createdAt: NOW.toISOString() };
    },
    now: () => NOW,
    ...over,
  };
  return { deps, inserted };
}
const send = (raw: unknown, over: Partial<ChatDeps> = {}) => {
  const { deps, inserted } = makeDeps(over);
  return processChatMessage(raw, STATION, "iphash", "salt", deps).then((res) => ({ res, inserted }));
};

describe("message content rules", () => {
  it("normalises whitespace", () => {
    expect(normalizeBody("  antre   panjang \n sekali ")).toBe("antre panjang sekali");
  });
  it.each([
    "Antrean sepi, Pertalite ada",
    "Pertamax 12.500 per liter",
    "Sudah 20 motor di depan saya",
    "Kode SPBU 54.801.60 ramai",
  ])("allows: %s", (t) => expect(blockedReason(t)).toBeNull());
  it.each([
    "cek https://contoh.com/info",
    "lihat www.contoh.id",
    "jual bensin di bensinmurah.com",
    "hubungi 081234567890",
    "wa 0812 3456 7890",
    "telp 0812-3456-7890",
    "dm @tukangbensin",
  ])("blocks links, numbers and handles: %s", (t) => expect(blockedReason(t)).not.toBeNull());
  it("blocks empty and too long messages", () => {
    expect(blockedReason("   ")).not.toBeNull();
    expect(blockedReason("a".repeat(CHAT_MAX_LEN))).toBeNull();
    expect(blockedReason("a".repeat(CHAT_MAX_LEN + 1))).not.toBeNull();
  });
});

describe("processChatMessage", () => {
  it("stores a valid message and returns it with a station-specific nickname", async () => {
    const { res, inserted } = await send(msg("Antrean sepi"));
    expect(res.status).toBe(201);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ station_id: STATION, device_id: DEVICE, ip_hash: "iphash", body: "Antrean sepi" });
    expect(inserted[0].nickname).toMatch(/^Pengendara [0-9A-F]{4}$/);
    expect((res.body.message as { mine: boolean }).mine).toBe(true);
  });

  it("never stores coordinates", async () => {
    const { inserted } = await send(msg("halo"));
    expect(Object.keys(inserted[0]).sort()).toEqual(["body", "device_id", "ip_hash", "nickname", "station_id"]);
  });

  it("rejects bad bodies (400) and blocked content (400)", async () => {
    expect((await send({ nope: true })).res.status).toBe(400);
    expect((await send(msg("hubungi 081234567890"))).res.status).toBe(400);
    expect((await send({ ...msg("ok"), extra: 1 })).res.status).toBe(400); // strict schema
  });

  describe("geofence", () => {
    it.each([
      [0, 201],
      [GEOFENCE_M, 201],
      [GEOFENCE_M + 0.5, 403],
      [5000, 403],
    ])("distance %s m -> %s", async (distance, status) => {
      const { res, inserted } = await send(msg("halo"), { distanceM: async () => distance });
      expect(res.status).toBe(status);
      expect(inserted.length).toBe(status === 201 ? 1 : 0);
    });
    it("404 for an unknown station", async () => {
      expect((await send(msg("halo"), { distanceM: async () => null })).res.status).toBe(404);
    });
  });

  describe("rate limits (429)", () => {
    it("cooldown between two messages", async () => {
      const recent = [{ body: "lain", createdAt: ago(CHAT_COOLDOWN_SEC - 1) }];
      const { res } = await send(msg("pesan baru"), { recentByDevice: async () => recent });
      expect(res.status).toBe(429);
      expect(res.headers?.["Retry-After"]).toBe(String(CHAT_COOLDOWN_SEC));
      const ok = await send(msg("pesan baru"), { recentByDevice: async () => [{ body: "lain", createdAt: ago(CHAT_COOLDOWN_SEC + 1) }] });
      expect(ok.res.status).toBe(201);
    });
    it("the same text again within the window", async () => {
      const recent = [{ body: "Antrean SEPI", createdAt: ago(60) }];
      const { res } = await send(msg("antrean sepi"), { recentByDevice: async () => recent });
      expect(res.status).toBe(429);
      expect(res.headers?.["Retry-After"]).toBe(String(CHAT_DUPLICATE_MIN * 60));
    });
    it("per device per hour", async () => {
      expect((await send(msg("a"), { countDevice: async () => CHAT_DEVICE_MAX_PER_HOUR - 1 })).res.status).toBe(201);
      const { res } = await send(msg("a"), { countDevice: async () => CHAT_DEVICE_MAX_PER_HOUR });
      expect(res.status).toBe(429);
      expect(String(res.body.error)).toMatch(/perangkat/);
    });
    it("per network per hour", async () => {
      const { res } = await send(msg("a"), { countIp: async () => CHAT_IP_MAX_PER_HOUR });
      expect(res.status).toBe(429);
      expect(String(res.body.error)).toMatch(/jaringan/);
    });
  });
});

describe("nickname", () => {
  it("is stable per device and station, and differs between stations", () => {
    const a = nicknameFor(DEVICE, STATION, "salt");
    expect(nicknameFor(DEVICE, STATION, "salt")).toBe(a);
    expect(nicknameFor(DEVICE, "22222222-2222-4222-8222-222222222222", "salt")).not.toBe(a);
    expect(a).not.toContain(DEVICE);
  });
});

describe("what leaves the server", () => {
  const rows = [
    { id: "m1", nickname: "Pengendara AAAA", body: "halo", created_at: "2026-10-14T11:59:00Z", device_id: "secret-device-1", ip_hash: "f".repeat(64), hidden: false },
    { id: "m2", nickname: "Pengendara BBBB", body: "hai", created_at: "2026-10-14T11:58:00Z", device_id: "secret-device-2", ip_hash: "e".repeat(64), hidden: false },
  ];
  it("exposes only id, nickname, body, time and a mine flag, never device id or IP hash", () => {
    const out = toPublicMessages(rows, "secret-device-1");
    for (const m of out) expect(Object.keys(m).sort()).toEqual(["body", "createdAt", "id", "mine", "nickname"]);
    const json = JSON.stringify(out);
    for (const secret of ["secret-device", "ffffffff", "eeeeeeee", "device_id", "ip_hash", "hidden"]) expect(json).not.toContain(secret);
    expect(out.map((m) => m.mine)).toEqual([true, false]);
  });
  it("marks nothing as mine when the asking device is unknown", () => {
    expect(toPublicMessages(rows, null).every((m) => !m.mine)).toBe(true);
  });
});

describe("flagging a message", () => {
  const flagDeps = (flags: number | null) => {
    const hidden: string[] = [];
    const deps: FlagDeps = { addFlag: async () => flags, hide: async (id) => void hidden.push(id) };
    return { deps, hidden };
  };
  it("hides it once enough different devices flagged it", async () => {
    const few = flagDeps(CHAT_FLAGS_TO_HIDE - 1);
    expect((await processChatFlag({ deviceId: DEVICE }, "m1", few.deps)).status).toBe(200);
    expect(few.hidden).toEqual([]);
    const enough = flagDeps(CHAT_FLAGS_TO_HIDE);
    await processChatFlag({ deviceId: DEVICE }, "m1", enough.deps);
    expect(enough.hidden).toEqual(["m1"]);
  });
  it("400 for a bad body and 404 for an unknown message", async () => {
    expect((await processChatFlag({}, "m1", flagDeps(1).deps)).status).toBe(400);
    expect((await processChatFlag({ deviceId: DEVICE }, "m1", flagDeps(null).deps)).status).toBe(404);
  });
});
