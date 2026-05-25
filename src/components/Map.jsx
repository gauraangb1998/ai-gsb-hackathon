import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TX_CENTER, TX_ZOOM } from '../constants/bounds.js';
import { LAYERS } from '../constants/layers.js';
import { GREEN_THRESHOLD, YELLOW_THRESHOLD } from '../utils/scoring.js';
import { getOperatorColor } from './LayerPanel.jsx';

// ─── Single style with BOTH basemaps as raster sources ───────────────────────
// We NEVER call map.setStyle() — toggling is done via setLayoutProperty only.
// This means our custom GeoJSON layers and HTML markers are NEVER wiped.
const MAP_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 512,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 19,
    },
    'esri-satellite': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri',
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'layer-street',    type: 'raster', source: 'carto-dark',      layout: { visibility: 'visible' } },
    { id: 'layer-satellite', type: 'raster', source: 'esri-satellite',   layout: { visibility: 'none'    } },
  ],
};

// ─── Infrastructure paint — street vs satellite ───────────────────────────────
const PAINT = {
  street: {
    substations:  { 'circle-color': '#c084fc', 'circle-radius': ['interpolate',['linear'],['zoom'],5,4,10,9], 'circle-opacity': 0.9, 'circle-stroke-color': '#fff', 'circle-stroke-width': 0.5 },
    transmission: { 'line-color': '#a855f7', 'line-width': 1.5, 'line-opacity': 0.7 },
    pipelines:    { 'line-color': '#f97316', 'line-width': 1.5, 'line-opacity': 0.8 },
    flood:        { 'fill-color': '#3b82f6', 'fill-opacity': 0.35 },
    protected:    { 'fill-color': '#22c55e', 'fill-opacity': 0.35 },
    ssa:          { 'fill-color': '#ef4444', 'fill-opacity': 0.3  },
    highways:     { 'line-color': '#94a3b8', 'line-width': 1.5, 'line-opacity': 0.6 },
    airports:     { 'circle-color': '#94a3b8', 'circle-radius': 5, 'circle-opacity': 0.9, 'circle-stroke-color': '#fff', 'circle-stroke-width': 0 },
  },
  satellite: {
    substations:  { 'circle-color': '#e879f9', 'circle-radius': ['interpolate',['linear'],['zoom'],5,5,10,11], 'circle-opacity': 1, 'circle-stroke-color': '#000', 'circle-stroke-width': 2 },
    transmission: { 'line-color': '#f0abfc', 'line-width': 3,   'line-opacity': 1   },
    pipelines:    { 'line-color': '#fb923c', 'line-width': 3.5, 'line-opacity': 1   },
    flood:        { 'fill-color': '#60a5fa', 'fill-opacity': 0.55 },
    protected:    { 'fill-color': '#4ade80', 'fill-opacity': 0.5  },
    ssa:          { 'fill-color': '#f87171', 'fill-opacity': 0.5  },
    highways:     { 'line-color': '#ffffff', 'line-width': 3,   'line-opacity': 0.9 },
    airports:     { 'circle-color': '#fff',  'circle-radius': 6, 'circle-opacity': 1, 'circle-stroke-color': '#000', 'circle-stroke-width': 1.5 },
  },
};

const LAYER_TYPE = {
  substations: 'circle', transmission: 'line', pipelines: 'line',
  flood: 'fill', protected: 'fill', ssa: 'fill', highways: 'line', airports: 'circle',
};

const LAYER_ID_TO_DATA_KEY = {
  substations: 'substations', transmission: 'transmission', pipelines: 'pipelines',
  flood: 'flood', protected: 'protectedLands', ssa: 'ssa', highways: 'highways', airports: 'airports',
};

const TX_CITIES = {
  type: 'FeatureCollection',
  features: [
    { type:'Feature', geometry:{ type:'Point', coordinates:[-95.369,29.760] }, properties:{ name:'Houston',    pop:3 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-96.797,32.776] }, properties:{ name:'Dallas',     pop:3 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-98.494,29.425] }, properties:{ name:'San Antonio',pop:3 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-97.743,30.267] }, properties:{ name:'Austin',     pop:3 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-97.333,32.725] }, properties:{ name:'Fort Worth', pop:2 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-106.485,31.758]}, properties:{ name:'El Paso',    pop:2 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-101.855,33.565]}, properties:{ name:'Lubbock',    pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-101.831,35.207]}, properties:{ name:'Amarillo',   pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-97.148,31.549] }, properties:{ name:'Waco',       pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-102.077,31.869]}, properties:{ name:'Midland',    pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-98.493,33.913] }, properties:{ name:'Abilene',    pop:1 } },
    { type:'Feature', geometry:{ type:'Point', coordinates:[-97.508,25.900] }, properties:{ name:'Brownsville',pop:1 } },
  ],
};

function polygonBbox(polygon) {
  const coords = polygon?.geometry?.coordinates?.[0] ?? polygon?.coordinates?.[0] ?? [];
  let minLng=Infinity, maxLng=-Infinity, minLat=Infinity, maxLat=-Infinity;
  for (const [lng,lat] of coords) {
    if (lng<minLng) minLng=lng; if (lng>maxLng) maxLng=lng;
    if (lat<minLat) minLat=lat; if (lat>maxLat) maxLat=lat;
  }
  return [minLng,minLat,maxLng,maxLat];
}

function makePinEl(site, onClick) {
  const isGreen = site.totalScore >= GREEN_THRESHOLD;
  const bg    = isGreen ? '#22c55e' : '#eab308';
  const shadow= isGreen ? 'rgba(34,197,94,0.5)' : 'rgba(234,179,8,0.5)';
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;user-select:none;';
  el.innerHTML = `
    <div style="width:32px;height:32px;border-radius:50%;background:${bg};border:2.5px solid #fff;
      box-shadow:0 3px 12px ${shadow};display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:10px;font-weight:800;font-family:system-ui,sans-serif;line-height:1;">
      ${site.totalScore}
    </div>
    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
      border-top:9px solid ${bg};margin-top:-1px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));"></div>`;
  el.addEventListener('click', e => { e.stopPropagation(); onClick(site); });
  return el;
}

export default function Map({ layerVisibility, results, onMapReady, staticData, hasSearch, searchPolygon, flyToSite, onSiteClick, dcData, dcHidden, children }) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const markersRef    = useRef([]);
  const onMapReadyRef  = useRef(onMapReady);
  const onSiteClickRef = useRef(onSiteClick);
  onMapReadyRef.current  = onMapReady;
  onSiteClickRef.current = onSiteClick;

  const [basemap, setBasemap] = useState('street');

  // ── Rebuild pin markers whenever results change ─────────────────────────
  const rebuildMarkers = useCallback((siteList) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const map = mapRef.current;
    if (!map || !siteList?.length) return;
    siteList.forEach(site => {
      const el = makePinEl(site, s => onSiteClickRef.current?.(s));
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([site.lng, site.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, []);

  // ── Init map ONCE ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: TX_CENTER,
      zoom: TX_ZOOM,
      attributionControl: false,
    });
    window.__siteiqMap = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      // ── Add all infrastructure sources + layers (once, never removed) ──
      LAYERS.forEach(layer => {
        const type = LAYER_TYPE[layer.id];
        if (!type) return;
        map.addSource(`src-${layer.id}`, { type: 'geojson', data: { type:'FeatureCollection', features:[] } });
        map.addLayer({ id:`lyr-${layer.id}`, type, source:`src-${layer.id}`, paint: PAINT.street[layer.id] });
      });

      // ── Existing data centers ─────────────────────────────────────────
      map.addSource('src-datacenters', { type: 'geojson', data: { type:'FeatureCollection', features:[] } });
      // Outer ring (company color)
      map.addLayer({
        id: 'lyr-dc-ring', type: 'circle', source: 'src-datacenters',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 11,
          'circle-opacity': 0.25,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 2,
        },
      });
      // Inner square-ish marker
      map.addLayer({
        id: 'lyr-dc-dot', type: 'circle', source: 'src-datacenters',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 6,
          'circle-opacity': 1,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
        },
      });

      // DC click → popup
      const dcPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 14,
        className: 'dc-popup' });
      map.on('click', 'lyr-dc-dot', e => {
        const p = e.features?.[0]?.properties;
        const coords = e.features?.[0]?.geometry?.coordinates;
        if (!p || !coords) return;
        const websiteHtml = p.website
          ? `<a href="${p.website}" target="_blank" style="color:#93c5fd;font-size:10px;">${p.website.replace(/^https?:\/\//, '')}</a>`
          : '';
        dcPopup.setLngLat(coords).setHTML(`
          <div style="font-family:system-ui,sans-serif;padding:8px 10px;background:#1e1e2e;border:1px solid #313244;border-radius:8px;color:#cdd6f4;font-size:12px;min-width:160px;box-shadow:0 4px 16px rgba(0,0,0,0.5)">
            <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:4px">${p.name || 'Data Center'}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <div style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></div>
              <span style="color:#94a3b8">${p.operator || 'Unknown operator'}</span>
            </div>
            ${p.note ? `<div style="color:#6c7086;font-size:10px;margin-bottom:4px">${p.note}</div>` : ''}
            ${websiteHtml}
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid #313244;font-size:10px;color:#6c7086">
              ⚠️ Nearby data centers may compete for substation capacity &amp; water
            </div>
          </div>`).addTo(map);
      });
      map.on('mouseenter', 'lyr-dc-dot', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'lyr-dc-dot', () => { map.getCanvas().style.cursor = ''; });

      // ── City reference dots + labels ───────────────────────────────────
      map.addSource('src-cities', { type:'geojson', data: TX_CITIES });
      map.addLayer({ id:'lyr-cities-dot', type:'circle', source:'src-cities',
        paint: { 'circle-color':'#e2e8f0', 'circle-radius':['interpolate',['linear'],['get','pop'],1,3,3,5], 'circle-opacity':0.9, 'circle-stroke-color':'#0f0f17', 'circle-stroke-width':1 } });
      map.addLayer({ id:'lyr-cities-label', type:'symbol', source:'src-cities',
        layout: { 'text-field':['get','name'], 'text-size':['interpolate',['linear'],['get','pop'],1,11,3,13],
          'text-font':['Open Sans Semibold'], 'text-offset':[0,1.2], 'text-anchor':'top', 'text-allow-overlap':false },
        paint: { 'text-color':'#e2e8f0', 'text-halo-color':'#0f0f17', 'text-halo-width':1.5 } });

      mapRef.current = map;
      onMapReadyRef.current?.(map);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Basemap toggle — just flip visibility, NO setStyle ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setLayoutProperty('layer-street',    'visibility', basemap === 'street'    ? 'visible' : 'none');
    map.setLayoutProperty('layer-satellite', 'visibility', basemap === 'satellite' ? 'visible' : 'none');
    // Update infrastructure paint for contrast
    const p = PAINT[basemap];
    LAYERS.forEach(layer => {
      if (!map.getLayer(`lyr-${layer.id}`)) return;
      const paint = p[layer.id];
      if (!paint) return;
      Object.entries(paint).forEach(([prop, val]) => {
        try { map.setPaintProperty(`lyr-${layer.id}`, prop, val); } catch {}
      });
    });
  }, [basemap]);

  // ── Feed static GeoJSON data into infrastructure layers ─────────────────
  useEffect(() => {
    if (staticData?.loading) return;
    const apply = () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return false;
      LAYERS.forEach(layer => {
        const data = staticData[LAYER_ID_TO_DATA_KEY[layer.id]];
        const src  = map.getSource(`src-${layer.id}`);
        if (data && src) src.setData(data);
      });
      return true;
    };
    if (!apply()) {
      const iv = setInterval(() => { if (apply()) clearInterval(iv); }, 100);
      return () => clearInterval(iv);
    }
  }, [staticData]);

  // ── Layer visibility toggles ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    LAYERS.forEach(layer => {
      if (map.getLayer(`lyr-${layer.id}`)) {
        map.setLayoutProperty(`lyr-${layer.id}`, 'visibility', layerVisibility[layer.id] ? 'visible' : 'none');
      }
    });
  }, [layerVisibility]);

  // ── Feed datacenter GeoJSON (with pre-computed color property) ──────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dcData?.features) return;
    const apply = () => {
      const src = map.getSource('src-datacenters');
      if (!src) return false;
      // Attach color to each feature so the layer can use ['get', 'color']
      const colored = {
        ...dcData,
        features: dcData.features.map(f => ({
          ...f,
          properties: { ...f.properties, color: getOperatorColor(f.properties?.operator) },
        })),
      };
      src.setData(colored);
      return true;
    };
    if (!apply()) {
      const iv = setInterval(() => { if (apply()) clearInterval(iv); }, 100);
      return () => clearInterval(iv);
    }
  }, [dcData]);

  // ── Company visibility filter ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getLayer('lyr-dc-dot')) return;
    if (!dcHidden || dcHidden.size === 0) {
      map.setFilter('lyr-dc-dot', null);
      map.setFilter('lyr-dc-ring', null);
    } else {
      const hidden = [...dcHidden];
      const filter = ['!', ['in', ['get', 'operator'], ['literal', hidden]]];
      map.setFilter('lyr-dc-dot', filter);
      map.setFilter('lyr-dc-ring', filter);
    }
  }, [dcHidden]);

  // ── Results → pin markers (always runs, no isStyleLoaded gate) ──────────
  useEffect(() => {
    rebuildMarkers(results);
  }, [results, rebuildMarkers]);

  // ── Fit map to drawn search polygon ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchPolygon) return;
    try {
      const [w,s,e,n] = polygonBbox(searchPolygon);
      if (!isFinite(w)) return;
      const fit = () => map.fitBounds([[w,s],[e,n]], { padding:80, duration:900, maxZoom:13 });
      if (map.isStyleLoaded()) fit(); else map.once('load', fit);
    } catch {}
  }, [searchPolygon]);

  // ── Fly to selected site ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToSite) return;
    map.flyTo({ center:[flyToSite.lng, flyToSite.lat], zoom:Math.max(map.getZoom(),11), duration:700, essential:true });
  }, [flyToSite]);

  return (
    <div style={{ flex:1, position:'relative', overflow:'hidden', minWidth:0 }}>
      <div ref={containerRef} style={{ width:'100%', height:'100%' }} />

      {/* Basemap toggle */}
      <div style={{
        position:'absolute', bottom:32, left:12, zIndex:10,
        display:'flex', borderRadius:8, overflow:'hidden',
        boxShadow:'0 2px 12px rgba(0,0,0,0.5)',
        border:'1px solid rgba(255,255,255,0.12)',
      }}>
        {['street','satellite'].map(mode => (
          <button key={mode} onClick={() => setBasemap(mode)} style={{
            padding:'6px 13px', fontSize:12, fontWeight:600,
            fontFamily:'system-ui,sans-serif', cursor:'pointer', border:'none',
            background: basemap === mode ? '#7c3aed' : 'rgba(15,15,23,0.85)',
            color:       basemap === mode ? '#fff'    : '#9999b8',
            backdropFilter:'blur(6px)',
            transition:'background 0.15s,color 0.15s',
          }}>
            {mode === 'street' ? '🗺 Street' : '🛰 Satellite'}
          </button>
        ))}
      </div>

      {/* Draw hint */}
      {!hasSearch && (
        <div style={{
          position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'rgba(15,15,23,0.88)', backdropFilter:'blur(8px)',
          border:'1px solid rgba(124,58,237,0.4)', borderRadius:10,
          padding:'10px 18px', color:'#c4c4d4', fontSize:13, fontWeight:500,
          display:'flex', alignItems:'center', gap:8,
          pointerEvents:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.4)', whiteSpace:'nowrap',
        }}>
          <span style={{ fontSize:16 }}>✏️</span>
          Use the <strong style={{ color:'#a78bfa' }}>polygon tool</strong> (top-right) to draw a search area on Texas
        </div>
      )}

      {children}
    </div>
  );
}
