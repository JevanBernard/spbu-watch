-- Distance in metres between a station and a point, used for the report geofence.
-- Callable by the service role only (route handlers); never exposed to anon.
create function station_distance_m(p_station_id uuid, p_lat double precision, p_lng double precision)
returns double precision
language sql stable
as $$
  select st_distance(geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  from stations
  where id = p_station_id and active
$$;

revoke execute on function station_distance_m(uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function station_distance_m(uuid, double precision, double precision) to service_role;
