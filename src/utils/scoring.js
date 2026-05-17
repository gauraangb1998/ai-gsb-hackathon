import * as turf from '@turf/turf';
import {
  POWER, GAS, WATER_BASE, DROUGHT_PENALTY, SSA_PENALTY,
  LOGISTICS, GREEN_THRESHOLD, YELLOW_THRESHOLD,
} from '../constants/scoring.js';
import { distanceMiles, pointInBuffered } from './geo.js';

function getDroughtLevel(point, droughtPolygons) {
  if (!droughtPolygons?.length) return null;
  // droughtPolygons: [{category:'D3', geometry: GeoJSON polygon}, ...]
  // sorted worst-to-best so we return the worst level containing this point
  const sorted = [...droughtPolygons].sort((a, b) => {
    const order = ['D4', 'D3', 'D2', 'D1', 'D0'];
    return order.indexOf(a.category) - order.indexOf(b.category);
  });
  for (const zone of sorted) {
    if (!zone.geometry) continue;
    try {
      if (turf.booleanPointInPolygon(point, zone.geometry)) {
        return zone.category;
      }
    } catch {
      // skip malformed
    }
  }
  return null;
}

export function scorePoint(point, staticData, droughtPolygons, ssaBuffer) {
  const { substations, pipelines, highways, airports } = staticData;

  // Power (30pts)
  const distSub = distanceMiles(point, substations);
  let powerScore = 0;
  if (distSub < 1) powerScore = POWER.mile1;
  else if (distSub < 3) powerScore = POWER.mile3;
  else if (distSub < 5) powerScore = POWER.mile5;

  // Gas (25pts)
  const distPipe = distanceMiles(point, pipelines);
  let gasScore = 0;
  if (distPipe < 2) gasScore = GAS.mile2;
  else if (distPipe < 5) gasScore = GAS.mile5;

  // Water & environment (25pts, floored at 0)
  let waterScore = WATER_BASE;
  const droughtLevel = getDroughtLevel(point, droughtPolygons);
  if (droughtLevel === 'D3' || droughtLevel === 'D4') {
    waterScore -= DROUGHT_PENALTY;
  }
  const nearSSA = ssaBuffer ? pointInBuffered(point, ssaBuffer) : false;
  if (nearSSA) waterScore -= SSA_PENALTY;
  waterScore = Math.max(0, waterScore);

  // Logistics (20pts)
  let logisticsScore = 0;
  const distHighway = distanceMiles(point, highways);
  if (distHighway <= 10) logisticsScore += LOGISTICS.interstate;
  const distAirport = distanceMiles(point, airports);
  if (distAirport <= 30) logisticsScore += LOGISTICS.airport;

  const totalScore = powerScore + gasScore + waterScore + logisticsScore;

  return {
    powerScore,
    gasScore,
    waterScore,
    logisticsScore,
    totalScore,
    distSub: +distSub.toFixed(1),
    distPipe: +distPipe.toFixed(1),
    distHighway: +distHighway.toFixed(1),
    distAirport: +distAirport.toFixed(1),
    droughtLevel: droughtLevel ?? 'None',
    nearSSA,
  };
}

export { GREEN_THRESHOLD, YELLOW_THRESHOLD };
