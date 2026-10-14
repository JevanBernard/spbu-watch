#!/usr/bin/env python3
"""Reconcile data/stations.csv with the official dealer list data/penyalur_bali.csv.

1. Match by official code (exact), then uncoded stations by street name (same regency, one-to-one).
2. Writes data/official_addresses.csv (code,address,source): official address for every matched station.
   build_stations.py applies it. A richer hand-verified address is kept when it agrees with the official one.
3. Strong street matches (score >= 0.9) are appended to data/code_overrides.csv; weaker ones go to
   data/official_review.csv for manual checking.
4. Official stations with no counterpart go to data/official_to_locate.csv. They have no coordinates in the
   source, so fill lat,lng there (or add them to data/manual_stations.csv) to put them on the map.

Stdlib only. Usage: python scripts/reconcile_penyalur.py   (run build_stations.py afterwards)
"""
import csv, json, re, urllib.parse
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
from difflib import SequenceMatcher

REG = {"Kota Denpasar": "Denpasar", "Kab Badung": "Badung", "Kab Gianyar": "Gianyar", "Kab Tabanan": "Tabanan"}
LABEL = {"Denpasar": "Kota Denpasar", "Badung": "Kabupaten Badung", "Gianyar": "Kabupaten Gianyar", "Tabanan": "Kabupaten Tabanan"}
STRONG = 0.9

# Street tokenizer/similarity, same as compare_official.py.
STOP = {"jl", "jalan", "raya", "no", "nomor", "km", "dan", "di", "denpasar", "badung", "gianyar", "tabanan",
        "kabupaten", "bali", "indonesia", "kota", "spbu", "pertamina", "gas", "station", "x", "a", "b"}
ALIAS = [(r"by ?pass|bay ?pass|bypass", "bypass"), (r"ngurah ?rai|ngurahrai", "ngurahrai"),
         (r"gatsu|gatot ?subroto|gatotsubroto", "gatotsubroto"), (r"ahmad yani|a\.? ?yani", "ahmadyani"),
         (r"imam ?bonjol", "imambonjol"), (r"sunset ?road", "sunsetroad"), (r"hayam ?wuruk", "hayamwuruk")]


def tokens(text):
    t = re.sub(r"[().,/\-]", " ", (text or "").lower())
    for pat, rep in ALIAS:
        t = re.sub(pat, rep, t)
    return {w for w in t.split() if w not in STOP and not w.isdigit() and not re.fullmatch(r"\d+\w?", w)}


def sim(a, b):
    if not a or not b:
        return 0.0
    return sum(1 for x in a if any(SequenceMatcher(None, x, y).ratio() >= 0.85 for y in b)) / max(len(a), len(b))


def pretty(addr: str) -> str:
    a = re.sub(r"\s+", " ", addr.strip().strip(",")).lower()
    a = re.sub(r"\bjl\.?\s*", "Jl. ", a)
    a = re.sub(r"\bds\.\s*", "Desa ", a)
    a = re.sub(r"\bkec\.\s*", "Kec. ", a)
    a = re.sub(r"\bkel\.\s*", "Kel. ", a)
    a = re.sub(r"\bno\.\s*", "No. ", a)
    return re.sub(r"(^|[\s(.\-/])([a-z])", lambda m: m.group(1) + m.group(2).upper(), a).replace("By Pass", "Bypass")


rows = [r for r in csv.DictReader(open(DATA / "penyalur_bali.csv", encoding="utf-8")) if r["kode_format_osm"] and r["kab_kota"] in REG]
off = [dict(code=r["kode_format_osm"], regency=REG[r["kab_kota"]], address=r["alamat"], kind=r["bentuk_penyalur"]) for r in rows]
for o in off:
    o["tok"] = tokens(o["address"])
ours = list(csv.DictReader(open(DATA / "stations.csv", encoding="utf-8")))
cache = json.loads((DATA / "reverse_cache.json").read_text(encoding="utf-8"))
for s in ours:
    c = cache.get(f'{s["osm_type"]}/{s["osm_id"]}', {})
    s["tok"] = tokens(" ".join(filter(None, [c.get("road"), s["address"]])))

by_code = {o["code"]: j for j, o in enumerate(off)}
pairs, used = {}, set()
for i, s in enumerate(ours):
    j = by_code.get(s["pertamina_code"])
    if j is not None:
        pairs[i] = (j, "kode", 1.0)
        used.add(j)
cands = [(sim(s["tok"], o["tok"]), i, j) for i, s in enumerate(ours) if i not in pairs and not s["pertamina_code"]
         for j, o in enumerate(off) if j not in used and o["regency"] == s["regency"]]
for sc, i, j in sorted((c for c in cands if c[0] >= 0.5), reverse=True):
    if i not in pairs and j not in used:
        pairs[i] = (j, "jalan", sc)
        used.add(j)

# Codes whose override row carries a hand-verified address keep it (never replaced by the official one).
with open(DATA / "code_overrides.csv", newline="", encoding="utf-8") as f:
    verified_addr = {r["pertamina_code"] for r in csv.DictReader(f) if r.get("address")}

addr_rows, review, new_codes = [], [], []
for i, (j, how, sc) in sorted(pairs.items()):
    s, o = ours[i], off[j]
    if o["code"] in verified_addr:
        continue
    if how == "jalan":
        if sc < STRONG:
            review.append([s["regency"], f'{s["osm_type"]}/{s["osm_id"]}', s["address"], o["code"], o["address"], f"{sc:.2f}"])
            continue
        new_codes.append(["code", s, o, sc])
    official = f'{pretty(o["address"])}, {LABEL[o["regency"]]}'
    cur = s["address"] or ""
    full = bool(re.search(r"Kec\.|Bali \d{5}|Bali, Indonesia|No\.", cur)) and not cur.startswith(("Dekat", "Sekitar"))
    keep = full and how == "kode" and sim(tokens(cur), o["tok"]) >= 0.5
    addr_rows.append([o["code"], cur if keep else official, f"penyalur_bali.csv {'(kept verified)' if keep else ''}".strip()])

with open(DATA / "official_addresses.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["pertamina_code", "address", "source"]); w.writerows(addr_rows)

with open(DATA / "code_overrides.csv", newline="", encoding="utf-8") as f:
    existing = list(csv.DictReader(f))
have = {(r["osm_type"], r["osm_id"]) for r in existing}
with open(DATA / "code_overrides.csv", "a", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    for _, s, o, sc in new_codes:
        if (s["osm_type"], s["osm_id"]) not in have:
            w.writerow([s["osm_type"], s["osm_id"], o["code"], f"penyalur-street-match score={sc:.2f}", "", ""])

with open(DATA / "official_review.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["regency", "osm", "our_address", "official_code", "official_address", "score"]); w.writerows(review)

unmatched = [o for j, o in enumerate(off) if j not in used]
with open(DATA / "official_to_locate.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["regency", "kode_spbu", "jenis", "alamat_resmi", "cari_di_google_maps", "lat", "lng"])
    for o in sorted(unmatched, key=lambda o: o["code"]):
        q = urllib.parse.quote(f'SPBU Pertamina {o["code"].replace(".", "")} {pretty(o["address"])} {o["regency"]} Bali')
        w.writerow([o["regency"], o["code"], o["kind"], pretty(o["address"]), f"https://www.google.com/maps/search/?api=1&query={q}", "", ""])

print(f"official {len(off)}, matched {len(pairs)} (kode {sum(1 for p in pairs.values() if p[1]=='kode')}), "
      f"new codes {len(new_codes)}, review {len(review)}, to locate {len(unmatched)}")
