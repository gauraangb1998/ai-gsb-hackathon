import requests, json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
url = "https://overpass-api.de/api/interpreter"
query = """
[out:json][timeout:45];
(
  node["facility"="data_centre"](25.84,-106.65,36.5,-93.51);
  way["facility"="data_centre"](25.84,-106.65,36.5,-93.51);
  node["building"="data_centre"](25.84,-106.65,36.5,-93.51);
  way["building"="data_centre"](25.84,-106.65,36.5,-93.51);
  node["telecom"="data_center"](25.84,-106.65,36.5,-93.51);
  way["telecom"="data_center"](25.84,-106.65,36.5,-93.51);
  node["man_made"="data_center"](25.84,-106.65,36.5,-93.51);
  way["man_made"="data_center"](25.84,-106.65,36.5,-93.51);
);
out center tags;
"""

print("Querying Overpass API for Texas data centers...")
headers = {"User-Agent": "SiteIQ/1.0 (hackathon data center siting tool)"}
r = requests.post(url, data={"data": query}, headers=headers, timeout=60)
if not r.ok:
    print(f"Status {r.status_code}: {r.text[:300]}")
    # Try GET fallback
    import urllib.parse
    get_url = url + "?data=" + urllib.parse.quote(query)
    r = requests.get(get_url, headers=headers, timeout=60)
r.raise_for_status()
elements = r.json().get("elements", [])

features = []
for elem in elements:
    if elem["type"] == "node":
        lng, lat = elem.get("lon"), elem.get("lat")
    elif elem["type"] == "way" and "center" in elem:
        lng, lat = elem["center"]["lon"], elem["center"]["lat"]
    else:
        continue
    tags = elem.get("tags", {})
    name = tags.get("name", tags.get("operator", "Data Center"))
    operator = (tags.get("operator") or tags.get("brand") or tags.get("name") or "Unknown").strip()
    features.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": {
            "name": name, "operator": operator,
            "website": tags.get("website", ""),
            "note": tags.get("note", ""),
            "status": "existing", "osm_id": elem["id"]
        }
    })

fc = {"type": "FeatureCollection", "features": features}
out = os.path.join(OUTPUT_DIR, "tx_datacenters.geojson")
with open(out, "w", encoding="utf-8") as f:
    json.dump(fc, f)

print(f"Saved {len(features)} data centers to tx_datacenters.geojson")
if features:
    ops = sorted({f["properties"]["operator"] for f in features})
    print(f"Operators ({len(ops)}): {', '.join(ops)}")
