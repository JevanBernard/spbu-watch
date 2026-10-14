#!/usr/bin/env python3
"""Ambil semua amenity=fuel (SPBU) di area SARBAGITA dari OpenStreetMap.

Cara pakai:  python fetch_spbu.py
Hasil:       spbu_raw.json  (unggah file ini ke chat)

Hanya memakai pustaka standar Python 3. Area dipecah jadi beberapa kotak kecil
supaya server Overpass tidak timeout, dan tiap kotak dicoba ke beberapa mirror
dengan jeda yang makin lama bila gagal.
"""
import json
import time
import urllib.parse
import urllib.request

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# Kotak yang mencakup Denpasar, Badung, Gianyar, Tabanan (selatan, barat, utara, timur)
S, W, N, E = -8.90, 114.85, -8.20, 115.45
ROWS, COLS = 2, 3  # 6 kotak kecil

HEADERS = {"User-Agent": "spbu-sarbagita-monitor/0.1 (student project)"}


def tiles():
    dlat = (N - S) / ROWS
    dlon = (E - W) / COLS
    for r in range(ROWS):
        for c in range(COLS):
            yield (S + r * dlat, W + c * dlon, S + (r + 1) * dlat, W + (c + 1) * dlon)


def fetch(bbox, attempts=6):
    s, w, n, e = bbox
    query = f'[out:json][timeout:60];nwr["amenity"="fuel"]({s:.4f},{w:.4f},{n:.4f},{e:.4f});out center tags;'
    data = urllib.parse.urlencode({"data": query}).encode()
    for i in range(attempts):
        url = MIRRORS[i % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=data, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.load(resp)["elements"]
        except Exception as exc:  # noqa: BLE001
            wait = min(5 * (i + 1), 30)
            print(f"  gagal di {url.split('/')[2]}: {exc!s:.80} - coba lagi {wait}s")
            time.sleep(wait)
    raise SystemExit(f"Kotak {bbox} gagal setelah {attempts} percobaan. Jalankan lagi nanti.")


def main():
    found = {}
    all_tiles = list(tiles())
    for idx, bbox in enumerate(all_tiles, 1):
        print(f"Kotak {idx}/{len(all_tiles)} ...")
        for el in fetch(bbox):
            found[(el["type"], el["id"])] = el  # hapus duplikat antar kotak
        time.sleep(2)
    elements = list(found.values())
    with open("spbu_raw.json", "w", encoding="utf-8") as f:
        json.dump({"source": "OpenStreetMap (ODbL)", "elements": elements}, f, ensure_ascii=False)
    print(f"Selesai: {len(elements)} titik disimpan di spbu_raw.json")


if __name__ == "__main__":
    main()
