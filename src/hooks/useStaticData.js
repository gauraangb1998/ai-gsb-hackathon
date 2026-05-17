import { useState, useEffect } from 'react';

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const FILES = [
  { key: 'substations',    file: 'tx_substations.geojson' },
  { key: 'transmission',   file: 'tx_transmission.geojson' },
  { key: 'pipelines',      file: 'tx_pipelines.geojson' },
  { key: 'flood',          file: 'tx_flood.geojson' },
  { key: 'protectedLands', file: 'tx_protected.geojson' },
  { key: 'ssa',            file: 'tx_ssa.geojson' },
  { key: 'highways',       file: 'tx_highways.geojson' },
  { key: 'airports',       file: 'tx_airports.geojson' },
];

export function useStaticData() {
  const [state, setState] = useState({
    substations: EMPTY_FC,
    transmission: EMPTY_FC,
    pipelines: EMPTY_FC,
    flood: EMPTY_FC,
    protectedLands: EMPTY_FC,
    ssa: EMPTY_FC,
    highways: EMPTY_FC,
    airports: EMPTY_FC,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function loadAll() {
      const results = await Promise.all(
        FILES.map(async ({ key, file }) => {
          try {
            const res = await fetch(`/data/${file}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            console.log(`[StaticData] ${file}: ${data.features?.length ?? 0} features`);
            return { key, data };
          } catch (err) {
            console.error(`[StaticData] Failed to load ${file}:`, err.message);
            return { key, data: EMPTY_FC };
          }
        })
      );

      const loaded = {};
      for (const { key, data } of results) {
        loaded[key] = data;
      }

      setState({ ...loaded, loading: false, error: null });
    }

    loadAll();
  }, []);

  return state;
}
