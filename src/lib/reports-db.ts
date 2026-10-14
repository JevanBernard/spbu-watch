import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportDeps } from "./reports";

/** Real database access for processReport. Uses the service-role client (server only). */
export function createReportDeps(db: SupabaseClient): ReportDeps {
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await q;
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  return {
    async distanceM(stationId, lat, lng) {
      const { data, error } = await db.rpc("station_distance_m", {
        p_station_id: stationId,
        p_lat: lat,
        p_lng: lng,
      });
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : null;
    },
    countDeviceSame(input, sinceIso) {
      let q = db
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("device_id", input.deviceId)
        .eq("station_id", input.stationId)
        .eq("kind", input.kind)
        .gte("created_at", sinceIso);
      q = input.kind === "stock" ? q.eq("fuel", input.fuel!) : q.is("fuel", null);
      return count(q);
    },
    countDevice(deviceId, sinceIso) {
      return count(
        db
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("device_id", deviceId)
          .gte("created_at", sinceIso),
      );
    },
    countIp(ipHash, sinceIso) {
      return count(
        db
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", sinceIso),
      );
    },
    async insert(row) {
      const { error } = await db.from("reports").insert(row);
      if (error) throw new Error(error.message);
    },
    now: () => new Date(),
  };
}
