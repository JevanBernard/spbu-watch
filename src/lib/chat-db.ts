import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatDeps, FlagDeps } from "./chat";

/** Real database access for processChatMessage. Uses the service-role client (server only). */
export function createChatDeps(db: SupabaseClient): ChatDeps {
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await q;
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  return {
    async distanceM(stationId, lat, lng) {
      const { data, error } = await db.rpc("station_distance_m", { p_station_id: stationId, p_lat: lat, p_lng: lng });
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : null;
    },
    async recentByDevice(deviceId, stationId, sinceIso) {
      const { data, error } = await db
        .from("chat_messages")
        .select("body,created_at")
        .eq("device_id", deviceId)
        .eq("station_id", stationId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: { body: string; created_at: string }) => ({ body: r.body, createdAt: r.created_at }));
    },
    countDevice(deviceId, sinceIso) {
      return count(
        db.from("chat_messages").select("id", { count: "exact", head: true }).eq("device_id", deviceId).gte("created_at", sinceIso),
      );
    },
    countIp(ipHash, sinceIso) {
      return count(
        db.from("chat_messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", sinceIso),
      );
    },
    async insert(row) {
      const { data, error } = await db.from("chat_messages").insert(row).select("id,created_at").single();
      if (error) throw new Error(error.message);
      return { id: data.id as string, createdAt: data.created_at as string };
    },
    now: () => new Date(),
  };
}

export function createFlagDeps(db: SupabaseClient): FlagDeps {
  return {
    async addFlag(messageId, deviceId) {
      const { data: msg, error: findErr } = await db
        .from("chat_messages")
        .select("id")
        .eq("id", messageId)
        .eq("hidden", false)
        .maybeSingle();
      if (findErr) throw new Error(findErr.message);
      if (!msg) return null;
      // One flag per device and message: a repeat is ignored by the primary key.
      const { error } = await db
        .from("chat_flags")
        .upsert({ message_id: messageId, device_id: deviceId }, { onConflict: "message_id,device_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      const { count, error: countErr } = await db
        .from("chat_flags")
        .select("device_id", { count: "exact", head: true })
        .eq("message_id", messageId);
      if (countErr) throw new Error(countErr.message);
      return count ?? 0;
    },
    async hide(messageId) {
      const { error } = await db.from("chat_messages").update({ hidden: true }).eq("id", messageId);
      if (error) throw new Error(error.message);
    },
  };
}
