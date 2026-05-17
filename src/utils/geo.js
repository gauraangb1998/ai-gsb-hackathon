import * as turf from '@turf/turf';

export function distanceMiles(point, featureCollection) {
  if (!featureCollection?.features?.length) return Infinity;
  let min = Infinity;
  for (const feat of featureCollection.features) {
    if (!feat.geometry) continue;
    try {
      let nearest;
      if (feat.geometry.type === 'Point') {
        nearest = turf.distance(point, feat, { units: 'miles' });
      } else {
        const nearestPt = turf.nearestPointOnLine(
          feat.geometry.type === 'LineString'
            ? feat
            : turf.multiLineString(feat.geometry.coordinates),
          point,
          { units: 'miles' }
        );
        nearest = nearestPt.properties.dist;
      }
      if (nearest < min) min = nearest;
    } catch {
      // skip malformed geometries
    }
  }
  return min;
}

export function pointInAny(point, featureCollection) {
  if (!featureCollection?.features?.length) return false;
  for (const feat of featureCollection.features) {
    if (!feat.geometry) continue;
    try {
      if (turf.booleanPointInPolygon(point, feat)) return true;
    } catch {
      // skip malformed
    }
  }
  return false;
}

export function buildBufferedUnion(featureCollection, radiusMiles) {
  if (!featureCollection?.features?.length) return null;
  const polygons = [];
  for (const feat of featureCollection.features) {
    if (!feat.geometry) continue;
    try {
      const buffered = turf.buffer(feat, radiusMiles, { units: 'miles' });
      if (buffered) polygons.push(buffered);
    } catch {
      // skip
    }
  }
  if (!polygons.length) return null;
  if (polygons.length === 1) return polygons[0];
  return turf.union(turf.featureCollection(polygons));
}

export function pointInBuffered(point, bufferedPolygon) {
  if (!bufferedPolygon) return false;
  try {
    return turf.booleanPointInPolygon(point, bufferedPolygon);
  } catch {
    return false;
  }
}
