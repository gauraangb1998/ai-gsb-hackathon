import { useMemo } from 'react';
import * as turf from '@turf/turf';
import { TX_BBOX, GRID_SPACING } from '../constants/bounds.js';

export function useCandidateGrid() {
  const grid = useMemo(() => {
    const g = turf.pointGrid(TX_BBOX, GRID_SPACING, { units: 'degrees' });
    console.log(`Candidate grid: ${g.features.length} points over Texas`);
    return g;
  }, []);

  return { grid };
}
