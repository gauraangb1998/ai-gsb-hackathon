import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TX_CENTER, TX_ZOOM } from '../constants/bounds.js';
import { LAYERS } from '../constants/layers.js';
import { GREEN_THRESHOLD, YELLOW_THRESHOLD } from '../utils/scoring.js';

const STYLE = 'https://demotiles.maplibre.org/style.json';

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

const LAYER_RENDER = {
  substations:  { type: 'circle', paint: { 'circle-color': '#9333ea', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 7], 'circle-opacity': 0.9, 'circle-stroke-color': '#fff', 'circle-stroke-width': 0.5 } },
  transmission: { type: 'line',   paint: { 'line-color': '#9333ea', 'line-width': 1.5, 'line-opacity': 0.7 } },
  pipelines:    { type: 'line',   paint: { 'line-color': '#f97316', 'line-width': 1.5, 'line-opacity': 0.7 } },
  flood:        { type: 'fill',   paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.35 } },
  protected:    { type: 'fill',   paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.35 } },
  ssa:          { type: 'fill',   paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.3 } },
  highways:     { type: 'line',   paint: { 'line-color': '#94a3b8', 'line-width': 1.5, 'line-opacity': 0.6 } },
  airports:     { type: 'circle', paint: { 'circle-color': '#94a3b8', 'circle-radius': 5, 'circle-opacity': 0.9 } },
};

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

export default function Map({ layerVisibility, results, onMapReady, staticData, hasSearch, searchPolygon, flyToSite, onSiteClick, children }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const onMapReadyRef = useRef(onMapReady);
  const onSiteClickRef = useRef(onSiteClick);
  onMapReadyRef.current = onMapReady;
  onSiteClickRef.current = onSiteClick;

  // Init map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: TX_CENTER,
      zoom: TX_ZOOM,
      attributionControl: false,
    });
    window.__siteiqMap = map; // available immediately for testing

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      // Infrastructure layers
      LAYERS.forEach(layer => {
        const render = LAYER_RENDER[layer.id];
        if (!render) return;
        map.addSource(`src-${layer.id}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: `lyr-${layer.id}`, type: render.type, source: `src-${layer.id}`, paint: render.paint });
      });

      // Candidate site layers
      map.addSource('src-sites', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.addLayer({
        id: 'lyr-sites-yellow', type: 'circle', source: 'src-sites',
        filter: ['all', ['>=', ['get', 'totalScore'], YELLOW_THRESHOLD], ['<', ['get', 'totalScore'], GREEN_THRESHOLD]],
        paint: {
          'circle-color': '#eab308', 'circle-radius': 8, 'circle-opacity': 0.9,
          'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5,
        },
      });
      map.addLayer({
        id: 'lyr-sites-green', type: 'circle', source: 'src-sites',
        filter: ['>=', ['get', 'totalScore'], GREEN_THRESHOLD],
        paint: {
          'circle-color': '#22c55e', 'circle-radius': 10, 'circle-opacity': 0.9,
          'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5,
        },
      });

      // Score label on green sites
      map.addLayer({
        id: 'lyr-sites-label', type: 'symbol', source: 'src-sites',
        filter: ['>=', ['get', 'totalScore'], GREEN_THRESHOLD],
        layout: {
          'text-field': ['to-string', ['get', 'totalScore']],
          'text-size': 9,
          'text-offset': [0, 1.8],
        },
        paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1 },
      });

      // City reference labels
      map.addSource('src-cities', { type: 'geojson', data: TX_CITIES });
      map.addLayer({
        id: 'lyr-cities-dot', type: 'circle', source: 'src-cities',
        paint: { 'circle-color': '#e2e8f0', 'circle-radius': ['interpolate',['linear'],['get','pop'],1,3,3,5], 'circle-opacity': 0.85, 'circle-stroke-color': '#0f0f17', 'circle-stroke-width': 1 },
      });
      map.addLayer({
        id: 'lyr-cities-label', type: 'symbol', source: 'src-cities',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['interpolate',['linear'],['get','pop'],1,11,3,13],
          'text-font': ['Open Sans Bold','Arial Unicode MS Bold'],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: { 'text-color': '#e2e8f0', 'text-halo-color': '#0f0f17', 'text-halo-width': 1.5 },
      });

      // Hover popup for site dots
      const hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      const SITE_LAYERS = ['lyr-sites-green', 'lyr-sites-yellow'];
      SITE_LAYERS.forEach(lyrId => {
        map.on('click', lyrId, e => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          onSiteClickRef.current?.({
            lat: p.lat, lng: p.lng,
            totalScore: p.totalScore, powerScore: p.powerScore,
            gasScore: p.gasScore, waterScore: p.waterScore,
            logisticsScore: p.logisticsScore, distSub: p.distSub,
            distPipe: p.distPipe, distHighway: p.distHighway,
            distAirport: p.distAirport, droughtLevel: p.droughtLevel,
            nearSSA: p.nearSSA,
          });
        });
        map.on('mouseenter', lyrId, e => {
          map.getCanvas().style.cursor = 'pointer';
          const p = e.features?.[0]?.properties;
          const coords = e.features?.[0]?.geometry?.coordinates;
          if (!p || !coords) return;
          hoverPopup.setLngLat(coords).setHTML(
            `<div style="font-family:system-ui,sans-serif;padding:6px 10px;background:#1e1e2e;border:1px solid #313244;border-radius:8px;color:#cdd6f4;font-size:12px;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,0.4)">
              <div style="font-size:18px;font-weight:800;color:${p.totalScore>=70?'#86efac':'#fde68a'}">${p.totalScore}<span style="font-size:11px;font-weight:400;color:#6c7086">/100</span></div>
              <div style="color:#6c7086;font-size:10px">⚡${p.powerScore} · 🔥${p.gasScore} · 💧${p.waterScore} · 🚛${p.logisticsScore}</div>
              <div style="color:#6c7086;font-size:10px;margin-top:2px">Click for full breakdown</div>
            </div>`
          ).addTo(map);
        });
        map.on('mouseleave', lyrId, () => { map.getCanvas().style.cursor = ''; hoverPopup.remove(); });
      });

      mapRef.current = map;
      onMapReadyRef.current?.(map);
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Load static data when it becomes available
  useEffect(() => {
    const map = mapRef.current;
    if (!map || staticData?.loading) return;
    const update = () => {
      LAYERS.forEach(layer => {
        const data = staticData[LAYER_ID_TO_DATA_KEY[layer.id]];
        const src = map.getSource(`src-${layer.id}`);
        if (data && src) src.setData(data);
      });
    };
    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [staticData.loading]);

  // Layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    LAYERS.forEach(layer => {
      if (map.getLayer(`lyr-${layer.id}`)) {
        map.setLayoutProperty(`lyr-${layer.id}`, 'visibility', layerVisibility[layer.id] ? 'visible' : 'none');
      }
    });
  }, [layerVisibility]);

  // Update site dots
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const src = map.getSource('src-sites');
      if (!src) return;
      src.setData({
        type: 'FeatureCollection',
        features: results.map(site => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [site.lng, site.lat] },
          properties: {
            lat: site.lat, lng: site.lng,
            totalScore: site.totalScore,
            powerScore: site.powerScore, gasScore: site.gasScore,
            waterScore: site.waterScore, logisticsScore: site.logisticsScore,
            distSub: site.distSub, distPipe: site.distPipe,
            distHighway: site.distHighway, distAirport: site.distAirport,
            droughtLevel: site.droughtLevel ?? 'N/A',
            nearSSA: !!site.nearSSA,
          },
        })),
      });
    };
    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [results]);

  // Fit map to drawn search polygon
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchPolygon) return;
    try {
      const [minLng, minLat, maxLng, maxLat] = polygonBbox(searchPolygon);
      if (!isFinite(minLng)) return;
      const doFit = () => map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, duration: 900, maxZoom: 13 });
      if (map.isStyleLoaded()) doFit();
      else map.once('load', doFit);
    } catch {}
  }, [searchPolygon]);

  // Fly to selected site
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToSite) return;
    map.flyTo({ center: [flyToSite.lng, flyToSite.lat], zoom: Math.max(map.getZoom(), 11), duration: 700, essential: true });
  }, [flyToSite]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Draw instructions overlay */}
      {!hasSearch && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15, 15, 23, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(124, 58, 237, 0.4)',
          borderRadius: 10, padding: '10px 18px',
          color: '#c4c4d4', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
          pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 16 }}>✏️</span>
          Use the <strong style={{ color: '#a78bfa' }}>polygon tool</strong> (top-right) to draw a search area on Texas
        </div>
      )}

      {children}
    </div>
  );
}
