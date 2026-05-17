import requests
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
os.makedirs(OUTPUT_DIR, exist_ok=True)

TX_BBOX = {
    'geometry': '-106.65,25.84,-93.51,36.5',
    'geometryType': 'esriGeometryEnvelope',
    'spatialRel': 'esriSpatialRelIntersects',
    'inSR': '4326',
}

DATASETS = [
    {
        'name': 'tx_substations',
        'url': 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/Electric_Substations/FeatureServer/0/query',
        'where': "STATE='TX' AND MAX_VOLTAG >= 345",
        'fields': 'NAME,MAX_VOLTAG,MIN_VOLTAG,CITY,STATE,LATITUDE,LONGITUDE,LINES',
        'use_bbox': False,
        'notes': 'TX substations >=345kV. Voltage field is MAX_VOLTAG (truncated name).',
    },
    {
        'name': 'tx_transmission',
        'url': 'https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Power_Transmission_Lines/FeatureServer/0/query',
        'where': 'VOLTAGE >= 345',
        'fields': 'VOLTAGE,VOLT_CLASS,SUB_1,SUB_2',
        'use_bbox': True,
    },
    {
        'name': 'tx_pipelines',
        'url': 'https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Natural_Gas_Pipelines___Copy_shp/FeatureServer/0/query',
        'where': '1=1',
        'fields': 'TYPEPIPE,Operator,Shape_Leng',
        'use_bbox': True,
    },
    {
        'name': 'tx_flood',
        'url': 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set_gdb/FeatureServer/0/query',
        'where': "SFHA_TF='T'",
        'fields': 'FLD_ZONE,ZONE_SUBTY,SFHA_TF',
        'use_bbox': True,
        'notes': 'FEMA flood zones - only Special Flood Hazard Areas (SFHA_TF=T)',
    },
    {
        'name': 'tx_protected',
        'url': 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Historic_Sites_PADUS/FeatureServer/0/query',
        'where': '1=1',
        'fields': 'FeatClass,Category,Own_Type,Own_Name,Unit_Nm,State_Nm,GIS_Acres',
        'use_bbox': True,
        'notes': 'PADUS protected lands - federal, state, local public lands',
    },
    {
        'name': 'tx_ssa',
        'url': 'https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Sole_Source_Aquifers_August_2019/FeatureServer/0/query',
        'where': '1=1',
        'fields': 'SSA_ID,SSA_NAME,FR_ID,EPA_Link,EPA_Region',
        'use_bbox': False,
        'notes': 'EPA Sole Source Aquifers - small national dataset',
    },
    {
        'name': 'tx_highways',
        'url': 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/0/query',
        'where': '1=1',
        'fields': 'NAME,BASENAME,MTFCC,RTTYP',
        'use_bbox': True,
        'notes': 'Census TIGER Primary Roads / Interstates',
    },
    {
        'name': 'tx_airports',
        'url': 'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/US_Airport/FeatureServer/0/query',
        'where': "TYPE_CODE='AD'",  # AD = Airport (excludes heliports HP, ultralights UL, etc.)
        'fields': 'NAME,IDENT,TYPE_CODE,SERVCITY,ELEVATION,LATITUDE,LONGITUDE',
        'use_bbox': True,
        'notes': 'FAA airports - TYPE_CODE=AD (airports, excludes heliports/ultralights)',
    },
]


def esri_to_geojson_geometry(esri_geom, geom_type):
    """Convert an ESRI JSON geometry to GeoJSON geometry."""
    if not esri_geom:
        return None
    if geom_type == 'esriGeometryPoint':
        return {
            'type': 'Point',
            'coordinates': [esri_geom.get('x', 0), esri_geom.get('y', 0)]
        }
    elif geom_type == 'esriGeometryPolyline':
        paths = esri_geom.get('paths', [])
        if len(paths) == 1:
            return {'type': 'LineString', 'coordinates': paths[0]}
        return {'type': 'MultiLineString', 'coordinates': paths}
    elif geom_type == 'esriGeometryPolygon':
        rings = esri_geom.get('rings', [])
        if len(rings) == 1:
            return {'type': 'Polygon', 'coordinates': rings}
        return {'type': 'MultiPolygon', 'coordinates': [[ring] for ring in rings]}
    return None


def probe_fields(url, where, use_bbox):
    params = {
        'where': where,
        'outFields': '*',
        'resultRecordCount': 1,
        'f': 'json',
    }
    if use_bbox:
        params.update(TX_BBOX)
    try:
        r = requests.get(url, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        features = data.get('features', [])
        geom_type = data.get('geometryType', 'unknown')
        print(f"  Geometry type: {geom_type}")
        if features:
            fields = list(features[0].get('attributes', {}).keys())
            print(f"  Fields: {fields[:12]}")
            return geom_type
        else:
            print(f"  No features in probe")
            return geom_type
    except Exception as e:
        print(f"  Probe error: {e}")
        return 'unknown'


def fetch_all(url, where, fields, use_bbox, max_features=50000):
    """Fetch all features using JSON format, paginating through results."""
    features = []
    offset = 0
    page_size = 1000
    geom_type = None

    while True:
        params = {
            'where': where,
            'outFields': fields,
            'resultOffset': offset,
            'resultRecordCount': page_size,
            'f': 'json',
        }
        if use_bbox:
            params.update(TX_BBOX)
            params['outSR'] = '4326'  # only set outSR when using bbox (to normalize coordinates)

        r = requests.get(url, params=params, timeout=90)
        r.raise_for_status()
        data = r.json()

        if geom_type is None:
            geom_type = data.get('geometryType', 'esriGeometryPoint')

        page_features = data.get('features', [])

        # Convert ESRI JSON features to GeoJSON features
        for feat in page_features:
            geojson_geom = esri_to_geojson_geometry(feat.get('geometry'), geom_type)
            geojson_feat = {
                'type': 'Feature',
                'geometry': geojson_geom,
                'properties': feat.get('attributes', {}),
            }
            features.append(geojson_feat)

        if len(features) >= max_features:
            print(f"  Hit max_features limit ({max_features}) - stopping")
            break

        exceeded = data.get('exceededTransferLimit', False)
        if not exceeded:
            break

        offset += page_size
        print(f"    ...paginating, got {len(features)} so far")

    return features


def main():
    results = {}
    for ds in DATASETS:
        name = ds['name']
        print(f"\n{'='*55}")
        print(f"Dataset: {name}")
        if 'notes' in ds:
            print(f"  Note: {ds['notes']}")

        print(f"  Probing fields...")
        probe_fields(ds['url'], ds['where'], ds['use_bbox'])

        print(f"  Fetching all features...")
        try:
            features = fetch_all(ds['url'], ds['where'], ds['fields'], ds['use_bbox'])

            geojson = {
                'type': 'FeatureCollection',
                'features': features,
            }

            out_path = os.path.join(OUTPUT_DIR, f"{name}.geojson")
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(geojson, f)

            print(f"  SUCCESS: {len(features)} features -> public/data/{name}.geojson")
            results[name] = len(features)

        except Exception as e:
            import traceback
            print(f"  ERROR: {e}")
            traceback.print_exc()
            out_path = os.path.join(OUTPUT_DIR, f"{name}.geojson")
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump({'type': 'FeatureCollection', 'features': []}, f)
            print(f"  Wrote empty GeoJSON for {name}")
            results[name] = 0

    print(f"\n{'='*55}")
    print("SUMMARY:")
    for name, count in results.items():
        status = "OK " if count > 0 else "EMPTY"
        print(f"  [{status}] {name}: {count} features")


if __name__ == '__main__':
    main()
