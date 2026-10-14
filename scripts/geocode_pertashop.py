#!/usr/bin/env python3
"""Approximate coordinates for official Pertashop outlets that have only a village in the dealer list.

Reads data/official_to_locate.csv (rows whose kode starts with 5P), asks Nominatim for the village centre
(1 request/second), and writes data/pertashop_geocoded.csv. Pins are village centres, not the outlet itself;
build_stations.py labels them 'Sekitar <desa>'. Stdlib only. Usage: python scripts/geocode_pertashop.py
"""
import csv, json, re, time, urllib.parse, urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
UA = "spbu-watch-sarbagita/0.1 (geocode_pertashop.py; contact: ifunudsharing@gmail.com)"
# Regency follows the code prefix: the dealer list's own kab/kota column is wrong for some rows.
BY_PREFIX = {"801": "Denpasar", "802": "Denpasar", "803": "Badung", "805": "Gianyar", "821": "Tabanan"}
LABEL = {"Denpasar": "Kota Denpasar", "Badung": "Kabupaten Badung", "Gianyar": "Kabupaten Gianyar", "Tabanan": "Kabupaten Tabanan"}


def parse(addr):
    a = re.sub(r"\s+", " ", addr).strip()
    m = re.search(r"(?:Desa|Kel\.?|Lokasi Desa|Kelurahan)\s+([^,]+?)(?:,|\s+Kec|\s+Kel\.|$)", a, re.I)
    desa = m.group(1).strip() if m else ""
    desa = re.sub(r"^(Desa|Kel\.?)\s+", "", desa, flags=re.I)
    k = re.search(r"Kec\.?\s*([A-Za-z ]+?)(?:,|\s+Kab|$)", a, re.I)
    return desa, (k.group(1).strip() if k else "")


def search(q):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 1, "countrycodes": "id"})
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
        res = json.load(r)
    time.sleep(1.1)
    return res[0] if res else None


out = []
for r in csv.DictReader(open(DATA / "official_to_locate.csv", encoding="utf-8-sig")):
    code = r["kode_spbu"]
    if not code.startswith("5P"):
        continue
    reg = BY_PREFIX[code.split(".")[1]]
    desa, kec = parse(r["alamat_resmi"])
    hit = None
    for q in ([f"Desa {desa}, Kecamatan {kec}, {LABEL[reg]}, Bali"] if kec else []) + [f"{desa}, {LABEL[reg]}, Bali, Indonesia"]:
        hit = search(q)
        if hit:
            break
    print(code, reg, desa, "|", kec, "->", (hit["lat"], hit["lon"]) if hit else None)
    out.append([code, reg, desa, kec, hit["lat"] if hit else "", hit["lon"] if hit else "", hit["display_name"] if hit else ""])

with open(DATA / "pertashop_geocoded.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["code", "regency", "desa", "kecamatan", "lat", "lng", "matched"]); w.writerows(out)
