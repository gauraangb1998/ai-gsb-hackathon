import { useState, useEffect, useRef } from 'react';
import * as turf from '@turf/turf';
import { distanceMiles } from '../utils/geo.js';
import { scorePoint, YELLOW_THRESHOLD } from '../utils/scoring.js';

// Expand a GeoJSON polygon's bbox by N degrees in each direction
function getBbox(polygon) {
  const coords = polygon.geometry.coordinates[0];
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

// Filter a FeatureCollection to features whose bbox overlaps the search area
// buffer in degrees (~1 degree ≈ 70 miles)
function filterNearby(fc, bbox, bufferDeg = 1.5) {
  if (!fc?.features?.length) return fc;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const features = fc.features.filter(feat => {
    if (!feat.geometry) return false;
    try {
      const fb = turf.bbox(feat);
      // Overlap check with buffered bbox
      return fb[0] <= maxLng + bufferDeg &&
             fb[2] >= minLng - bufferDeg &&
             fb[1] <= maxLat + bufferDeg &&
             fb[3] >= minLat - bufferDeg;
    } catch { return true; } // keep if bbox fails
  });
  return { type: 'FeatureCollection', features };
}

function pointInFC(point, fc) {
  if (!fc?.features?.length) return false;
  for (const feat of fc.features) {
    if (!feat.geometry) continue;
    try { if (turf.booleanPointInPolygon(point, feat)) return true; } catch {}
  }
  return false;
}

export function useSearch(bbox, grid, staticData, droughtPolygons) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const staticDataRef = useRef(staticData);
  const droughtRef = useRef(droughtPolygons);
  useEffect(() => { staticDataRef.current = staticData; }, [staticData]);
  useEffect(() => { droughtRef.current = droughtPolygons; }, [droughtPolygons]);

  const isLoading = staticData.loading;

  useEffect(() => {
    if (!bbox || !grid || isLoading) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const cancelled = { value: false };

    const timer = setTimeout(() => {
      if (cancelled.value) return;
      const sd = staticDataRef.current;
      const dp = droughtRef.current;

      try {
        // 1. Filter grid points to bbox
        const inBbox = grid.features.filter(pt => {
          try { return turf.booleanPointInPolygon(pt, bbox); } catch { return false; }
        });

        // 2. Pre-filter ALL feature collections to nearby features only
        //    This is critical for performance — avoids checking all 12k pipelines per point
        const searchBbox = getBbox(bbox);
        const local = {
          substations:    filterNearby(sd.substations, searchBbox, 2.0),   // ~140mi
          transmission:   filterNearby(sd.transmission, searchBbox, 2.0),
          pipelines:      filterNearby(sd.pipelines, searchBbox, 0.8),     // ~56mi
          flood:          filterNearby(sd.flood, searchBbox, 0.2),
          protectedLands: filterNearby(sd.protectedLands, searchBbox, 0.2),
          ssa:            filterNearby(sd.ssa, searchBbox, 0.2),
          highways:       filterNearby(sd.highways, searchBbox, 1.0),
          airports:       filterNearby(sd.airports, searchBbox, 2.0),      // 30mi radius
        };

        console.log(`[Search] ${inBbox.length} pts in bbox | nearby: ${local.substations.features.length} subs, ${local.pipelines.features.length} pipes, ${local.airports.features.length} airports`);

        let excluded = 0;
        const scored_results = [];

        for (const pt of inBbox) {
          if (cancelled.value) return;

          // Hard exclusions using pre-filtered local data
          if (pointInFC(pt, local.flood) || pointInFC(pt, local.protectedLands)) {
            excluded++; continue;
          }

          // SSA 1-mile setback via distance
          const distToSSA = local.ssa?.features?.length ? distanceMiles(pt, local.ssa) : Infinity;
          if (distToSSA < 1) { excluded++; continue; }

          // Score using local (pre-filtered) data
          const score = scorePoint(pt, local, dp, null);
          const nearSSA = distToSSA < 1; // always false here (excluded above)

          if (score.totalScore >= YELLOW_THRESHOLD) {
            const [lng, lat] = pt.geometry.coordinates;
            scored_results.push({ lat, lng, ...score, nearSSA });
          }
        }

        scored_results.sort((a, b) => b.totalScore - a.totalScore);
        console.log(`[Search] ${excluded} excluded, ${scored_results.length} above threshold (${YELLOW_THRESHOLD})`);

        if (!cancelled.value) { setResults(scored_results); setSearching(false); }
      } catch (err) {
        console.error('[Search] Error:', err);
        if (!cancelled.value) { setResults([]); setSearching(false); }
      }
    }, 50); // small delay to let UI update (show spinner) before heavy computation

    return () => { cancelled.value = true; clearTimeout(timer); };
  }, [bbox, grid, isLoading]);

  return { results, searching };
}
