#!/usr/bin/env python3
"""One-off: reverse-geocode every station in data/stations.csv to a street name (Nominatim, 1 req/s).
Results are cached in data/reverse_cache.json so reruns only fetch what is missing."""
import csv, json, time, urllib.request, urllib.parse
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
CACHE = DATA / "reverse_cache.json"
UA = "spbu-watch-sarbagita/0.1 (reverse_streets.py; contact: ifunudsharing@gmail.com)"

cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
rows = list(csv.DictReader(open(DATA / "stations.csv", encoding="utf-8")))
for i, s in enumerate(rows, 1):
    key = f'{s["osm_type"]}/{s["osm_id"]}'
    if key in cache:
        continue
    q = urllib.parse.urlencode({"lat": s["lat"], "lon": s["lng"], "format": "jsonv2", "zoom": 17, "addressdetails": 1})
    req = urllib.request.Request("https://nominatim.openstreetmap.org/reverse?" + q, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            a = json.load(r).get("address", {})
        cache[key] = {"road": a.get("road"), "suburb": a.get("suburb") or a.get("village") or a.get("neighbourhood")}
    except Exception as e:  # noqa: BLE001
        print("fail", key, str(e)[:60], flush=True)
    if i % 20 == 0:
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        print(i, "/", len(rows), flush=True)
    time.sleep(1.1)
CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
print("done", len(cache))
