#!/usr/bin/env python3
"""One-off comparison of data/stations.csv (OSM) with the MyPertamina list (data/mypertamina_sarbagita.json).

1. Match by Pertamina code (exact).
2. Match the rest within the same regency by street name (reverse-geocoded road + OSM address),
   one-to-one, best score first. Scores are heuristic: street names are not unique.
Writes data/official_comparison.csv. Official data is for comparison only, not for the app.
"""
import csv, json, re
from difflib import SequenceMatcher
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
off = json.loads((DATA / "mypertamina_sarbagita.json").read_text(encoding="utf-8"))
cache = json.loads((DATA / "reverse_cache.json").read_text(encoding="utf-8"))
ours = list(csv.DictReader(open(DATA / "stations.csv", encoding="utf-8")))

STOP = {"jl", "jalan", "raya", "no", "nomor", "km", "dan", "di", "denpasar", "badung", "gianyar", "tabanan",
        "kabupaten", "bali", "indonesia", "kota", "spbu", "pertamina", "gas", "station", "x", "a", "b"}
ALIAS = [(r"\bby ?pass\b|\bbay ?pass\b|\bbypass\b", "bypass"), (r"ngurah ?rai|ngurahrai", "ngurahrai"),
         (r"\bgatsu\b|gatot ?subroto|gatotsubroto", "gatotsubroto"), (r"\bahmad yani\b|\ba\.? ?yani\b", "ahmadyani"),
         (r"imam ?bonjol", "imambonjol"), (r"sunset ?road", "sunsetroad"), (r"hayam ?wuruk", "hayamwuruk")]


def tokens(text: str) -> set[str]:
    t = (text or "").lower()
    t = re.sub(r"[().,/\\-]", " ", t)
    for pat, rep in ALIAS:
        t = re.sub(pat, rep, t)
    return {w for w in t.split() if w not in STOP and not w.isdigit() and not re.fullmatch(r"\d+\w?", w)}


def sim(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    hit = sum(1 for x in a if any(SequenceMatcher(None, x, y).ratio() >= 0.85 for y in b))
    return hit / max(len(a), len(b))


def fmt(n: str) -> str:
    return f"{n[:2]}.{n[2:5]}.{n[5:]}"


for o in off:
    o["code"] = fmt(o["no"])
    o["regency"] = o["city"].split(" ")[0]
    o["tok"] = tokens(o["address"])
for s in ours:
    c = cache.get(f'{s["osm_type"]}/{s["osm_id"]}', {})
    s["tok"] = tokens(" ".join(filter(None, [c.get("road"), s["address"]])))
    s["road"] = c.get("road") or ""

pairs = {}  # osm index -> (official index, method, score)
used_off = set()

# 1. exact code
by_code = {o["code"]: i for i, o in enumerate(off)}
for i, s in enumerate(ours):
    j = by_code.get(s["pertamina_code"])
    if j is not None:
        pairs[i] = (j, "kode", 1.0)
        used_off.add(j)

# 2. street name, same regency, greedy best-first
cands = []
for i, s in enumerate(ours):
    if i in pairs:
        continue
    for j, o in enumerate(off):
        if j in used_off or o["regency"] != s["regency"]:
            continue
        sc = sim(s["tok"], o["tok"])
        if sc >= 0.5:
            cands.append((sc, i, j))
for sc, i, j in sorted(cands, reverse=True):
    if i in pairs or j in used_off:
        continue
    pairs[i] = (j, "jalan", sc)
    used_off.add(j)

rows = []
for i, s in enumerate(ours):
    if i in pairs:
        j, how, sc = pairs[i]
        o = off[j]
        level = "pasti" if how == "kode" else ("kemungkinan" if sc >= 0.8 else "lemah")
        rows.append([s["regency"], s["osm_type"] + "/" + s["osm_id"], s["name"], s["road"], o["code"], o["address"], how, f"{sc:.2f}", level])
    else:
        rows.append([s["regency"], s["osm_type"] + "/" + s["osm_id"], s["name"], s["road"], "", "", "", "", "tidak ada di daftar resmi"])
for j, o in enumerate(off):
    if j not in used_off:
        rows.append([o["regency"], "", "", "", o["code"], o["address"], "", "", "resmi tanpa pasangan di data kita"])

with open(DATA / "official_comparison.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["regency", "osm", "osm_name", "osm_road", "official_code", "official_address", "method", "score", "status"])
    w.writerows(rows)

from collections import Counter

print("status by regency:")
for reg in ["Denpasar", "Badung", "Gianyar", "Tabanan"]:
    c = Counter(r[8] for r in rows if r[0] == reg)
    print(f"  {reg:<9}", dict(c))
tot = Counter(r[8] for r in rows)
print("TOTAL", dict(tot))
