import { useEffect, useRef } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

// Custom styles that are MapLibre-compatible (avoids line-dasharray expression issue)
const DRAW_STYLES = [
  // Polygon fill (inactive)
  {
    id: 'gl-draw-polygon-fill',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
    paint: { 'fill-color': '#7c3aed', 'fill-outline-color': '#7c3aed', 'fill-opacity': 0.15 },
  },
  // Polygon outline (active)
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#a78bfa', 'line-width': 2.5, 'line-opacity': 1 },
  },
  // Vertex points (active)
  {
    id: 'gl-draw-polygon-and-line-vertex-active',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
    paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#7c3aed', 'circle-stroke-width': 2 },
  },
  // Midpoints
  {
    id: 'gl-draw-polygon-midpoint',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
    paint: { 'circle-radius': 3, 'circle-color': '#a78bfa' },
  },
  // Lines (for line drawing mode and polygon edges during draw)
  {
    id: 'gl-draw-line',
    type: 'line',
    filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#a78bfa', 'line-width': 2.5, 'line-opacity': 1 },
  },
  // Static polygon fill
  {
    id: 'gl-draw-polygon-fill-static',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']],
    paint: { 'fill-color': '#7c3aed', 'fill-outline-color': '#7c3aed', 'fill-opacity': 0.1 },
  },
  // Static polygon stroke
  {
    id: 'gl-draw-polygon-stroke-static',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#7c3aed', 'line-width': 2, 'line-opacity': 0.7 },
  },
];

export default function DrawControl({ map, onSearch }) {
  const drawRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      styles: DRAW_STYLES,
    });

    map.addControl(draw, 'top-right');
    drawRef.current = draw;

    const onCreateOrUpdate = (e) => {
      // Use event features if available; fall back to draw.getAll()
      const feat = (e?.features?.[0]) ?? draw.getAll()?.features?.[0] ?? null;
      onSearch?.(feat || null);
    };
    const onDelete = () => onSearch?.(null);

    map.on('draw.create', onCreateOrUpdate);
    map.on('draw.update', onCreateOrUpdate);
    map.on('draw.delete', onDelete);

    return () => {
      map.off('draw.create', onCreateOrUpdate);
      map.off('draw.update', onCreateOrUpdate);
      map.off('draw.delete', onDelete);
      try { if (map.hasControl(draw)) map.removeControl(draw); } catch {}
    };
  }, [map]);

  return null;
}
