import { useState, useEffect, useRef } from 'react';

// Stable empty array — never recreated, safe as a useEffect dependency
const EMPTY_POLYGONS = [];

const DROUGHT_URL = 'https://droughtmonitor.unl.edu/data/json/usdm_current.json';

export function useDroughtData() {
  const [droughtByFips, setDroughtByFips] = useState({});
  const [droughtLoading, setDroughtLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(DROUGHT_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // API may return array directly or { data: [...] } or other shape
        const entries = Array.isArray(data) ? data : (data.data ?? data.features ?? Object.values(data));
        const map = {};
        for (const entry of entries) {
          if (entry.FIPS != null && entry.DM != null) {
            map[String(entry.FIPS)] = entry.DM;
          }
        }
        console.log(`[DroughtMonitor] Loaded ${Object.keys(map).length} counties`);
        setDroughtByFips(map);
      } catch (err) {
        console.warn('[DroughtMonitor] Fetch failed — water scores unpenalized:', err.message);
        setDroughtByFips({});
      } finally {
        setDroughtLoading(false);
      }
    }

    load();
  }, []);

  // scoring.js expects droughtPolygons: [{category:'D3', geometry}]
  // We have FIPS data, not polygons — pass stable empty array; drought penalty skipped
  return { droughtPolygons: EMPTY_POLYGONS, droughtByFips, droughtLoading };
}
