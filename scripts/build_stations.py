#!/usr/bin/env python3
"""Build the station dataset from data/spbu_raw.json (Overpass output).

Outputs (in data/): stations.csv, stations.geojson, review_needed.csv.
Regency boundaries are fetched once from Nominatim and cached in
data/regency_boundaries.json (1 request/second, custom User-Agent).

Stdlib only. Usage: python scripts/build_stations.py
"""
import csv
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
RAW = DATA / "spbu_raw.json"
BOUNDARIES = DATA / "regency_boundaries.json"

REGENCIES = {
    "Denpasar": "Kota Denpasar, Bali, Indonesia",
    "Badung": "Kabupaten Badung, Bali, Indonesia",
    "Gianyar": "Kabupaten Gianyar, Bali, Indonesia",
    "Tabanan": "Kabupaten Tabanan, Bali, Indonesia",
}
# Neighbouring regencies caught by the bounding box; used only to drop stations confidently.
OUTSIDE = {
    "Klungkung": "Kabupaten Klungkung, Bali, Indonesia",
    "Bangli": "Kabupaten Bangli, Bali, Indonesia",
    "Buleleng": "Kabupaten Buleleng, Bali, Indonesia",
    "Jembrana": "Kabupaten Jembrana, Bali, Indonesia",
}
# Rough expectations from SPEC section 3 (third-party, only a sanity check).
EXPECTED = {"Denpasar": (49, 54), "Badung": (38, 38), "Gianyar": (27, 27), "Tabanan": (20, 20)}

# Fallback when point-in-polygon fails: keywords in addr:* tags.
ADDR_KEYWORDS = {
    "Denpasar": ["denpasar"],
    "Badung": ["badung", "kuta", "jimbaran", "ungasan", "darmasaba", "mengwi", "canggu", "seminyak", "nusa dua"],
    "Gianyar": ["gianyar", "ubud", "sukawati", "blahbatuh", "tegallalang"],
    "Tabanan": ["tabanan", "kediri", "penebel", "marga"],
}

UA = "spbu-watch-sarbagita/0.1 (build_stations.py; contact: ifunudsharing@gmail.com)"
MERGE_RADIUS_M = 40
MERGE_RADIUS_UNBRANDED_M = 50
CODE_RE = re.compile(r"\b54\.\d{3}\.\d{2}\b")

FUEL_TAGS = {
    "fuel:octane_90": "pertalite",
    "fuel:octane_92": "pertamax",
    "fuel:octane_98": "pertamax_turbo",
    "fuel:diesel": "solar",
}

NON_STATION_NAME = re.compile(r"nitrogen|pelumas|distributor|minicon|small place", re.I)


# ---------- geometry ----------

def haversine_m(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def ring_contains(ring, x, y):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def polygon_contains(poly, x, y):
    """poly = [outer, hole1, ...] (GeoJSON order, lng/lat)."""
    if not ring_contains(poly[0], x, y):
        return False
    return not any(ring_contains(h, x, y) for h in poly[1:])


def geom_contains(geom, lng, lat):
    if geom["type"] == "Polygon":
        return polygon_contains(geom["coordinates"], lng, lat)
    if geom["type"] == "MultiPolygon":
        return any(polygon_contains(p, lng, lat) for p in geom["coordinates"])
    return False


# ---------- boundaries ----------

def fetch_boundaries():
    if BOUNDARIES.exists():
        return json.loads(BOUNDARIES.read_text(encoding="utf-8"))
    out = {}
    for name, query in {**REGENCIES, **OUTSIDE}.items():
        params = urllib.parse.urlencode(
            {"q": query, "format": "jsonv2", "polygon_geojson": 1, "limit": 5, "countrycodes": "id"}
        )
        req = urllib.request.Request(
            "https://nominatim.openstreetmap.org/search?" + params, headers={"User-Agent": UA}
        )
        print(f"Nominatim: {query}")
        with urllib.request.urlopen(req, timeout=60) as resp:
            results = json.load(resp)
        geom = next(
            (
                r["geojson"]
                for r in results
                if r.get("category") == "boundary" and r["geojson"]["type"] in ("Polygon", "MultiPolygon")
            ),
            None,
        )
        if geom is None:
            sys.exit(f"No polygon boundary found for {query}. Got: {[r.get('display_name') for r in results]}")
        out[name] = geom
        time.sleep(1.1)  # Nominatim policy: max 1 request/second
    BOUNDARIES.write_text(json.dumps(out), encoding="utf-8")
    return out


# ---------- normalization ----------

def centroid(el):
    if "lat" in el:
        return el["lat"], el["lon"]
    c = el["center"]
    return c["lat"], c["lon"]


def norm_brand(tags):
    text = " ".join(tags.get(k, "") for k in ("brand", "operator", "name")).lower()
    for key, label in (
        ("shell", "Shell"),
        ("bp", "BP"),
        ("vivo", "Vivo"),
        ("pertashop", "Pertashop"),
        ("pertamini", "Pertamini"),
        ("pertamina", "Pertamina"),
        ("spbu", "Pertamina"),
    ):
        if re.search(rf"\b{key}\b", text) or (key == "pertamina" and key in text):
            return label
    return tags.get("brand") or None


def norm_operator(tags):
    op = tags.get("operator")
    if not op:
        return None
    return "Pertamina" if "pertamina" in op.lower() else op


def parse_fuels(tags):
    fuels = []
    for tag, fuel in FUEL_TAGS.items():
        if tags.get(tag) == "yes" and fuel not in fuels:
            fuels.append(fuel)
    return fuels


def is_24h(oh):
    if not oh:
        return False
    oh = oh.strip()
    return oh in ("24/7", "Mo-Su 00:00-24:00", "00:00-24:00")


def pertamina_code(tags):
    for v in tags.values():
        m = CODE_RE.search(str(v))
        if m:
            return m.group(0)
    return None


def address(tags):
    parts = [tags.get("addr:street"), tags.get("addr:housenumber"), tags.get("addr:neighbourhood"), tags.get("addr:city")]
    return ", ".join(p for p in parts if p) or None



# ---------- manual additions and code overrides ----------

OVERRIDES = DATA / "code_overrides.csv"  # osm_type,osm_id,pertamina_code,source
MANUAL = DATA / "manual_stations.csv"  # stations missing from OSM, added by hand


def apply_overrides(kept):
    """Fill pertamina_code for stations that have none. Never overwrites an existing code."""
    if not OVERRIDES.exists():
        return 0
    by_key = {(s["osm_type"], str(s["osm_id"])): s for s in kept}
    n = 0
    for row in csv.DictReader(open(OVERRIDES, encoding="utf-8")):
        s = by_key.get((row["osm_type"], row["osm_id"]))
        if s and not s["pertamina_code"]:
            s["pertamina_code"] = row["pertamina_code"]
            n += 1
    return n


def add_manual(kept, boundaries):
    """Append hand-entered stations (osm_type 'manual', ids 1..n in file order)."""
    if not MANUAL.exists():
        return 0
    n = 0
    for i, row in enumerate(csv.DictReader(open(MANUAL, encoding="utf-8")), 1):
        lat, lng = float(row["lat"]), float(row["lng"])
        regency = next((r for r in REGENCIES if geom_contains(boundaries[r], lng, lat)), None)
        if regency is None:
            sys.exit(f"manual station {row['name']!r} is outside the four regencies")
        near = [s for s in kept if haversine_m((lat, lng), (s["lat"], s["lng"])) <= 60]
        if near:
            print(f"WARNING: manual station {row['name']!r} is within 60 m of {near[0]['name']!r} ({near[0]['osm_id']})")
        oh = row.get("opening_hours", "")
        kept.append(
            {
                "osm_type": "manual",
                "osm_id": i,
                "pertamina_code": row["pertamina_code"],
                "name": row["name"],
                "brand": row["brand"],
                "operator": "Pertamina",
                "regency": regency,
                "lat": round(lat, 7),
                "lng": round(lng, 7),
                "address": row["address"],
                "opening_hours": oh,
                "is_24h": str(is_24h(oh)).lower(),
                "fuels": "[]",
                "has_ev_charging": "false",
                "google_place_id": "",
                "active": "true",
            }
        )
        n += 1
    return n


# ---------- main ----------

def merge_duplicates(elements):
    """Cluster elements of the same brand within MERGE_RADIUS_M; keep the richest tags."""
    items = []
    for el in elements:
        tags = el.get("tags", {})
        items.append({"el": el, "pos": centroid(el), "brand": norm_brand(tags)})
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            bi, bj = items[i]["brand"], items[j]["brand"]
            # An unbranded element (often a bare building outline) next to a branded one is
            # treated as the same station, with a slightly larger radius.
            if bi == bj:
                radius = MERGE_RADIUS_M
            elif bi is None or bj is None:
                radius = MERGE_RADIUS_UNBRANDED_M
            else:
                continue
            if haversine_m(items[i]["pos"], items[j]["pos"]) <= radius:
                parent[find(i)] = find(j)

    groups = {}
    for i, it in enumerate(items):
        groups.setdefault(find(i), []).append(it)

    merged = []
    for members in groups.values():
        # Prefer the element with most tags as primary; fill gaps from the others.
        members.sort(key=lambda m: -len(m["el"].get("tags", {})))
        tags = {}
        for m in reversed(members):
            tags.update(m["el"].get("tags", {}))
        tags.update(members[0]["el"].get("tags", {}))
        primary = members[0]
        merged.append(
            {
                "osm_type": primary["el"]["type"],
                "osm_id": primary["el"]["id"],
                "pos": primary["pos"],
                "tags": tags,
                "merged_from": [f'{m["el"]["type"]}/{m["el"]["id"]}' for m in members[1:]],
            }
        )
    return merged


def assign_regency(rec, boundaries):
    lat, lng = rec["pos"]
    hits = [name for name, g in boundaries.items() if geom_contains(g, lng, lat)]
    if len(hits) == 1:
        return (hits[0], "polygon") if hits[0] in REGENCIES else ("OUTSIDE", hits[0])
    text = " ".join(str(v) for k, v in rec["tags"].items() if k.startswith("addr:")).lower()
    for name, words in ADDR_KEYWORDS.items():
        if any(w in text for w in words):
            return name, "addr"
    return None, "none"


def main():
    if not RAW.exists():
        sys.exit(f"{RAW} not found. Run: python scripts/fetch_spbu.py and move spbu_raw.json into data/")
    raw = json.loads(RAW.read_text(encoding="utf-8"))["elements"]

    # 1. dedupe by (type, id), then merge node/way duplicates.
    unique = {(e["type"], e["id"]): e for e in raw}
    merged = merge_duplicates(list(unique.values()))
    print(f"raw elements: {len(raw)} | unique: {len(unique)} | after merge: {len(merged)}")

    boundaries = fetch_boundaries()

    kept, review, dropped = [], [], 0
    for rec in merged:
        tags = rec["tags"]
        name_tag = tags.get("name", "")
        brand = norm_brand(tags)
        reasons = []
        if brand == "Pertamini" or NON_STATION_NAME.search(name_tag):
            reasons.append("not an official SPBU (Pertamini / non-fuel business) - excluded")
        regency, how = assign_regency(rec, boundaries)
        if regency == "OUTSIDE":
            dropped += 1
            continue
        if regency is None:
            if reasons:
                pass
            else:
                reasons.append("outside polygons and no usable addr:* tag - assign manually")
        elif how == "addr":
            reasons.append(f"regency {regency} guessed from addr:* tag (point outside polygon)")

        base = {
            "osm_type": rec["osm_type"],
            "osm_id": rec["osm_id"],
            "lat": rec["pos"][0],
            "lng": rec["pos"][1],
            "name": name_tag,
            "brand": brand,
        }
        excluded = any("excluded" in r for r in reasons)
        if regency is None and not excluded:
            review.append({**base, "reason": "; ".join(reasons)})
            continue
        if excluded:
            review.append({**base, "reason": "; ".join(reasons)})
            continue
        if regency is None:
            dropped += 1
            continue

        if not name_tag:
            reasons.append("no name tag - generic name generated")
        oh = tags.get("opening_hours")
        name = name_tag or f'SPBU {brand or ""}'.strip() + (f' - {tags["addr:street"]}' if tags.get("addr:street") else "")
        kept.append(
            {
                "osm_type": rec["osm_type"],
                "osm_id": rec["osm_id"],
                "pertamina_code": pertamina_code(tags) or "",
                "name": name,
                "brand": brand or "",
                "operator": norm_operator(tags) or "",
                "regency": regency,
                "lat": round(rec["pos"][0], 7),
                "lng": round(rec["pos"][1], 7),
                "address": address(tags) or "",
                "opening_hours": oh or "",
                "is_24h": str(is_24h(oh)).lower(),
                "fuels": json.dumps(parse_fuels(tags)),
                "has_ev_charging": str(tags.get("amenity") == "charging_station" or tags.get("socket:type2") is not None).lower(),
                "google_place_id": "",
                "active": "true",
            }
        )
        if reasons:
            review.append({**base, "reason": "; ".join(reasons)})

    # Points outside all four regencies are expected (bounding box overlaps neighbours).
    filled = apply_overrides(kept)
    added = add_manual(kept, boundaries)
    print(f"codes filled from overrides: {filled} | manual stations added: {added}")
    kept.sort(key=lambda s: (s["regency"], s["name"]))
    fields = list(kept[0].keys())
    with open(DATA / "stations.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(kept)
    with open(DATA / "review_needed.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["osm_type", "osm_id", "name", "brand", "lat", "lng", "reason"])
        w.writeheader()
        w.writerows(review)
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [s["lng"], s["lat"]]},
            "properties": {k: v for k, v in s.items() if k not in ("lat", "lng")},
        }
        for s in kept
    ]
    (DATA / "stations.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False), encoding="utf-8"
    )

    # validation
    ids = {(s["osm_type"], s["osm_id"]) for s in kept}
    assert len(ids) == len(kept), "duplicate (osm_type, osm_id)"
    assert all(s["regency"] in REGENCIES for s in kept)
    assert all(-9.0 < s["lat"] < -8.0 and 114.0 < s["lng"] < 116.0 for s in kept)

    print(f"\nstations written: {len(kept)} | review rows: {len(review)} | dropped as outside the four regencies: {dropped}")
    print("\nregency        found   expected (SPEC s.3, unverified)")
    counts = {r: sum(1 for s in kept if s["regency"] == r) for r in REGENCIES}
    for r, c in counts.items():
        lo, hi = EXPECTED[r]
        exp = f"{lo}" if lo == hi else f"{lo}-{hi}"
        print(f"{r:<14} {c:>5}   {exp}")
    print(f"{'TOTAL':<14} {len(kept):>5}   ~139")
    print(f"24h stations: {sum(1 for s in kept if s['is_24h']=='true')} | with Pertamina code: {sum(1 for s in kept if s['pertamina_code'])}")
    print(f"unnamed (generic name): {sum(1 for r in review if 'no name tag' in r['reason'])}")


if __name__ == "__main__":
    main()
