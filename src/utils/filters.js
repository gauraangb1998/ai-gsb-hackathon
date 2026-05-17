import { pointInAny, pointInBuffered } from './geo.js';

export function isExcluded(point, { flood, protectedLands, ssaBuffer }) {
  if (pointInAny(point, flood)) return true;
  if (pointInAny(point, protectedLands)) return true;
  if (ssaBuffer && pointInBuffered(point, ssaBuffer)) return true;
  return false;
}
