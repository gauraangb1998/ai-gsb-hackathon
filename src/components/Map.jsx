import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TX_CENTER, TX_ZOOM } from '../constants/bounds.js';
import { LAYERS } from '../constants/layers.js';
import { GREEN_THRESHOLD, YELLOW_THRESHOLD } from '../utils/scoring.js';

const STREET_STYLE = 'https://demotiles.maplibre.org/style.json';

const SATELLITE_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri — Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'satellite-bg', type: 'raster', source: 'satellite' }],
};

// Paint properties differ between street and satellite for contrast
function getLayerRender(isSatellite) {
  return {
    substations:  { type: 'circle', paint: { 'circle-color': '#c084fc', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 9], 'circle-opacity': 1, 'circle-stroke-color': isSatellite ? '#000' : '#fff', 'circle-stroke-width': isSatellite ? 1.5 : 0.5 } },
    transmission: { type: 'line',   paint: { 'line-color': isSatellite ? '#e879f9' : '#a855f7', 'line-width': isSatellite ? 2.5 : 1.5, 'line-opacity': 1 } },
    pipelines:    { type: 'line',   paint: { 'line-color': isSatellite ? '#fb923c' : '#f97316', 'line-width': isSatellite ? 3 : 1.5, 'line-opacity': 1 } },
    flood:        { type: 'fill',   paint: { 'fill-color': '#3b82f6', 'fill-opacity': isSatellite ? 0.5 : 0.35 } },
    protected:    { type: 'fill',   paint: { 'fill-color': '#22c55e', 'fill-opacity': isSatellite ? 0.45 : 0.35 } },
    ssa:          { type: 'fill',   paint: { 'fill-color': '#ef4444', 'fill-opacity': isSatellite ? 0.45 : 0.3 } },
    highways:     { type: 'line',   paint: { 'line-color': isSatellite ? '#ffffff' : '#94a3b8', 'line-width': isSatellite ? 2.5 : 1.5, 'line-opacity': isSatellite ? 0.85 : 0.6 } },
    airports:     { type: 'circle', paint: { 'circle-color': isSatellite ? '#ffffff' : '#94a3b8', 'circle-radius': 5, 'circle-opacity': 1, 'circle-stroke-color': '#000', 'circle-stroke-width': isSatellite ? 1 : 0 } },
  };
}

const LAYER_ID_TO_DATA_KEY = {
  substations: 'substations',
  transmission: 'transmission',
  pipelines: 'pipelines',
  flood: 'flood',
  protected: 'protectedLands',
  ssa: 'ssa',
  highways: 'highways',
  airports: 'airports',
};

const TX_CITIES = {
  type: 'FeatureCollection',
  features: [
    { type:'Feature', geometry:{ type:'Point', coordinates:[-95.369, 29.760] }, properties:{ name:'Houston',    pop:3 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-96.797, 32.776] }, properties:{ name:'Dallas',     pop:3 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-98.494, 29.425] }, properties:{ name:'San Antonio',pop:3 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-97.743, 30.267] }, properties:{ name:'Austin',     pop:3 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-97.333, 32.725] }, properties:{ name:'Fort Worth', pop:2 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-106.485,31.758] }, properties:{ name:'El Paso',    pop:2 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-101.855,33.565] }, properties:{ name:'Lubbock',    pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-101.831,35.207] }, properties:{ name:'Amarillo',   pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-97.148, 31.549] }, properties:{ name:'Waco',       pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-94.103, 30.080] }, properties:{ name:'Beaumont',   pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-102.077,31.869] }, properties:{ name:'Midland',    pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-98.493, 33.913] }, properties:{ name:'Abilene',    pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-96.468, 33.209] }, properties:{ name:'Plano',      pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-97.137, 26.204] }, properties:{ name:'McAllen',    pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-97.508, 25.900] }, properties:{ name:'Brownsville',pop:1 } },
  ],
};

function polygonBbox(polygon) {
  const coords = polygon?.geometry?.coordinates?.[0] ?? polygon?.coordinates?.[0] ?? [];
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

function makePinEl(site, onClick) {
  const isGreen = site.totalScore >= GREEN_THRESHOLD;
  const color = isGreen ? '#22c55e' : '#eab308';
  const shadow = isGreen ? 'rgba(34,197,94,0.45)' : 'rgba(234,179,8,0.45)';
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;user-select:none;';
  el.innerHTML = `
    <div style="
      width:32px;height:32px;border-radius:50%;
      background:${color};
      border:2.5px solid #fff;
      box-shadow:0 3px 10px ${shadow};
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:10px;font-weight:800;
      font-family:system-ui,sans-serif;
      line-height:1;
    ">${site.totalScore}</div>
    <div style="
      width:0;height:0;
      border-left:6px solid transparent;
      border-right:6px solid transparent;
      border-top:9px solid ${color};
      margin-top:-1px;
      filter:drop-shadow(0 2px 2px rgba(0,0,0,0.3));
    "></div>`;
  el.addEventListener('click', (e) => { e.stopPropagation(); onClick(site); });
  return el;
}

export default function Map({ layerVisibility, results, onMapReady, staticData, hasSearch, searchPolygon, flyToSite, onSiteClick, children }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const onMapReadyRef = useRef(onMapReady);
  const onSiteClickRef = useRef(onSiteClick);
  onMapReadyRef.current = onMapReady;
  onSiteClickRef.current = onSiteClick;

  // Live refs so addLayers / marker updates can read current values
  const staticDataRef = useRef(staticData);
  const resultsRef = useRef(results);
  const layerVisibilityRef = useRef(layerVisibility);
  const basemapRef = useRef('street');
  staticDataRef.current = staticData;
  resultsRef.current = results;
  layerVisibilityRef.current = layerVisibility;

  const [basemap, setBasemap] = useState('street');
  const markersRef = useRef([]);

  // ── Rebuild pin markers whenever results change ────────────────────────────
  const rebuildMarkers = useCallback((map, siteList) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (!map || !siteList?.length) return;
    siteList.forEach(site => {
      const el = makePinEl(site, (s) => onSiteClickRef.current?.(s));
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([site.lng, site.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, []);

  // ── Add all infrastructure + city layers to map ────────────────────────────
  const addLayers = useCallback((map) => {
    const isSat = basemapRef.current === 'satellite';
    const LAYER_RENDER = getLayerRender(isSat);

    LAYERS.forEach(layer => {
      const render = LAYER_RENDER[layer.id];
      if (!render) return;
      if (!map.getSource(`src-${layer.id}`)) {
        map.addSource(`src-${layer.id}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.getLayer(`lyr-${layer.id}`)) {
        map.addLayer({ id: `lyr-${layer.id}`, type: render.type, source: `src-${layer.id}`, paint: render.paint });
      }
    });

    // City reference labels
    if (!map.getSource('src-cities')) {
      map.addSource('src-cities', { type: 'geojson', data: TX_CITIES });
    }
    if (!map.getLayer('lyr-cities-dot')) {
      map.addLayer({
        id: 'lyr-cities-dot', type: 'circle', source: 'src-cities',
        paint: { 'circle-color': '#e2e8f0', 'circle-radius': ['interpolate',['linear'],['get','pop'],1,3,3,5], 'circle-opacity': 0.9, 'circle-stroke-color': isSat ? '#000' : '#0f0f17', 'circle-stroke-width': 1 },
      });
    }
    if (!map.getLayer('lyr-cities-label')) {
      map.addLayer({
        id: 'lyr-cities-label', type: 'symbol', source: 'src-cities',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['interpolate',['linear'],['get','pop'],1,11,3,13],
          'text-font': ['Open Sans Semibold'],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: { 'text-color': isSat ? '#fff' : '#e2e8f0', 'text-halo-color': isSat ? '#000' : '#0f0f17', 'text-halo-width': 2 },
      });
    }

    // Apply current visibility
    const vis = layerVisibilityRef.current;
    LAYERS.forEach(layer => {
      if (map.getLayer(`lyr-${layer.id}`)) {
        map.setLayoutProperty(`lyr-${layer.id}`, 'visibility', vis[layer.id] ? 'visible' : 'none');
      }
    });

    // Re-apply static data
    const sd = staticDataRef.current;
    if (sd && !sd.loading) {
      LAYERS.forEach(layer => {
        const data = sd[LAYER_ID_TO_DATA_KEY[layer.id]];
        const src = map.getSource(`src-${layer.id}`);
        if (data && src) src.setData(data);
      });
    }

    // Re-add pin markers
    rebuildMarkers(map, resultsRef.current);
  }, [rebuildMarkers]);

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STREET_STYLE,
      center: TX_CENTER,
      zoom: TX_ZOOM,
      attributionControl: false,
    });
    window.__siteiqMap = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      addLayers(map);
      mapRef.current = map;
      onMapReadyRef.current?.(map);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [addLayers]);

  // ── Basemap switch ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    basemapRef.current = basemap;
    const newStyle = basemap === 'satellite' ? SATELLITE_STYLE : STREET_STYLE;
    // Clear markers before style change (they survive but need re-adding after)
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    map.setStyle(newStyle);
    map.once('style.load', () => addLayers(map));
  }, [basemap, addLayers]);

  // ── Static data → infrastructure layers ───────────────────────────────────
  useEffect(() => {
    if (staticData?.loading) return;
    const apply = () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return false;
      LAYERS.forEach(layer => {
        const data = staticData[LAYER_ID_TO_DATA_KEY[layer.id]];
        const src = map.getSource(`src-${layer.id}`);
        if (data && src) src.setData(data);
      });
      return true;
    };
    if (!apply()) {
      const iv = setInterval(() => { if (apply()) clearInterval(iv); }, 100);
      return () => clearInterval(iv);
    }
  }, [staticData]);

  // ── Layer visibility toggles ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    LAYERS.forEach(layer => {
      if (map.getLayer(`lyr-${layer.id}`)) {
        map.setLayoutProperty(`lyr-${layer.id}`, 'visibility', layerVisibility[layer.id] ? 'visible' : 'none');
      }
    });
  }, [layerVisibility]);

  // ── Results → rebuild pin markers ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      rebuildMarkers(map, results);
    } else {
      map.once('load', () => rebuildMarkers(map, results));
    }
  }, [results, rebuildMarkers]);

  // ── Fit map to drawn search polygon ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchPolygon) return;
    try {
      const [minLng, minLat, maxLng, maxLat] = polygonBbox(searchPolygon);
      if (!isFinite(minLng)) return;
      const doFit = () => map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, duration: 900, maxZoom: 13 });
      if (map.isStyleLoaded()) doFit(); else map.once('load', doFit);
    } catch {}
  }, [searchPolygon]);

  // ── Fly to selected site ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToSite) return;
    map.flyTo({ center: [flyToSite.lng, flyToSite.lat], zoom: Math.max(map.getZoom(), 11), duration: 700, essential: true });
  }, [flyToSite]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Basemap toggle */}
      <div style={{
        position: 'absolute', bottom: 32, left: 12,
        display: 'flex', borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.12)',
        zIndex: 10,
      }}>
        {['street', 'satellite'].map(mode => (
          <button key={mode} onClick={() => setBasemap(mode)} style={{
            padding: '6px 13px', fontSize: 12, fontWeight: 600,
            fontFamily: 'system-ui, sans-serif', cursor: 'pointer', border: 'none',
            background: basemap === mode ? '#7c3aed' : 'rgba(15,15,23,0.85)',
            color: basemap === mode ? '#fff' : '#9999b8',
            backdropFilter: 'blur(6px)',
            transition: 'background 0.15s, color 0.15s',
          }}>
            {mode === 'street' ? '🗺 Street' : '🛰 Satellite'}
          </button>
        ))}
      </div>

      {/* Draw instructions overlay */}
      {!hasSearch && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,15,23,0.88)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(124,58,237,0.4)', borderRadius: 10,
          padding: '10px 18px', color: '#c4c4d4', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
          pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 16 }}>✏️</span>
          Use the <strong style={{ color: '#a78bfa' }}>polygon tool</strong> (top-right) to draw a search area on Texas
        </div>
      )}

      {children}
    </div>
  );
}
