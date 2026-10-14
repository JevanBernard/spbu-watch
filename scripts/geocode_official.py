#!/usr/bin/env python3
"""Approximate coordinates for official SPBU (not Pertashop) that have no point yet.

Reads data/official_to_locate.csv, geocodes the dealer-list address with Nominatim (1 request/second):
street + village first, then village/kecamatan only. Writes data/official_geocoded.csv with the query tier
that matched ('alamat', 'desa' or 'kecamatan'); the pins are approximate, not the station itself.
Stdlib only. Usage: python scripts/geocode_official.py
"""
import csv, json, re, time, urllib.parse, urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
UA = "spbu-watch-sarbagita/0.1 (geocode_official.py; contact: ifunudsharing@gmail.com)"
BY_PREFIX = {"801": "Denpasar", "802": "Denpasar", "803": "Badung", "805": "Gianyar", "821": "Tabanan"}
LABEL = {"Denpasar": "Kota Denpasar", "Badung": "Kabupaten Badung", "Gianyar": "Kabupaten Gianyar", "Tabanan": "Kabupaten Tabanan"}
SKIP = {"59.803.01"}  # SPBUN Tanjung Benoa: already on the map as 58.803.01 (user-verified)


def search(q):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 1, "countrycodes": "id"})
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
        res = json.load(r)
    time.sleep(1.1)
    return res[0] if res else None


def pieces(addr):
    a = re.sub(r"\s+", " ", addr).strip(" ,")
    desa = re.search(r"(?:Desa|Ds\.?|Kel\.?|Lokasi Kel\.?|Kelurahan)\s+([A-Z][\w']*(?: [A-Z][\w']*)?)", a)
    kec = re.search(r"(?:Kec\.?|Kecamatan)\s*([A-Z][\w]*(?: [A-Z][\w]*)?)", a)
    return (desa.group(1) if desa else ""), (kec.group(1) if kec else "")


out = []
for r in csv.DictReader(open(DATA / "official_to_locate.csv", encoding="utf-8-sig")):
    code = r["kode_spbu"]
    if code.startswith("5P") or code in SKIP:
        continue
    reg = BY_PREFIX.get(code.split(".")[1]) or r["regency"]
    desa, kec = pieces(r["alamat_resmi"])
    tiers = [("alamat", f'{r["alamat_resmi"]}, {LABEL[reg]}, Bali')]
    if desa:
        tiers.append(("desa", f"{desa}, {LABEL[reg]}, Bali"))
    if kec:
        tiers.append(("kecamatan", f"Kecamatan {kec}, {LABEL[reg]}, Bali"))
    hit, tier = None, ""
    for tier, q in tiers:
        hit = search(q)
        if hit:
            break
    print(code, reg, "|", r["alamat_resmi"], "->", tier if hit else None, (hit["lat"], hit["lon"]) if hit else "")
    out.append([code, reg, r["alamat_resmi"], desa, kec, tier if hit else "", hit["lat"] if hit else "", hit["lon"] if hit else "", hit["display_name"] if hit else ""])

with open(DATA / "official_geocoded.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["code", "regency", "alamat", "desa", "kecamatan", "tier", "lat", "lng", "matched"]); w.writerows(out)
