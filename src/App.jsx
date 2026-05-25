import { useState, useMemo } from 'react';
import { LAYERS } from './constants/layers.js';
import { useCandidateGrid } from './hooks/useCandidateGrid.js';
import { useStaticData } from './hooks/useStaticData.js';
import { useDroughtData } from './hooks/useDroughtData.js';
import { useSearch } from './hooks/useSearch.js';
import Map from './components/Map.jsx';
import DrawControl from './components/DrawControl.jsx';
import LayerPanel from './components/LayerPanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import SiteDetailModal from './components/SiteDetailModal.jsx';
import LoadingOverlay from './components/LoadingOverlay.jsx';
import ExportButton from './components/ExportButton.jsx';

const DEFAULT_VISIBILITY = Object.fromEntries(LAYERS.map(l => [l.id, l.defaultOn]));

export default function App() {
  const [layerVisibility, setLayerVisibility] = useState(DEFAULT_VISIBILITY);
  const [searchBbox, setSearchBbox] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [flyToSite, setFlyToSite] = useState(null);
  // dcHidden: Set of operator names the user has toggled OFF
  const [dcHidden, setDcHidden] = useState(new Set());

  // Unique operators + counts derived from loaded datacenter data
  const dcCompanySummary = useMemo(() => {
    const features = staticData.datacenters?.features;
    if (!features?.length) return [];
    const counts = {};
    for (const f of features) {
      const op = f.properties?.operator || 'Unknown';
      counts[op] = (counts[op] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [staticData.datacenters]);

  const { grid } = useCandidateGrid();
  const staticData = useStaticData();
  const { droughtPolygons } = useDroughtData();
  const { results, searching } = useSearch(searchBbox, grid, staticData, droughtPolygons);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0f0f17', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52, flexShrink: 0,
        background: '#13131f', borderBottom: '1px solid #2a2a3e',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
          }}>S</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.3px' }}>SiteIQ</span>
          <span style={{
            fontSize: 11, padding: '2px 6px', borderRadius: 4,
            background: '#1e1e3f', color: '#7c3aed', fontWeight: 600,
          }}>Texas</span>
        </div>

        <div style={{ fontSize: 11, color: '#4a4a6a', maxWidth: 480, textAlign: 'center', lineHeight: 1.4 }}>
          ⚠️ Data is a pre-feasibility screening tool. Substation voltage proxies capacity — actual headroom requires a utility study.
        </div>

        <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          {staticData.loading ? (
            <span style={{ color: '#4a4a6a' }}>⏳ Loading datasets…</span>
          ) : results.length > 0 ? (
            <>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ {results.length} sites scored</span>
              <span style={{ color: '#3a3a5a' }}>·</span>
              <span style={{ color: '#86efac' }}>{results.filter(r => r.totalScore >= 70).length} green</span>
              <span style={{ color: '#3a3a5a' }}>·</span>
              <span style={{ color: '#fde68a' }}>{results.filter(r => r.totalScore < 70).length} yellow</span>
            </>
          ) : (
            <span style={{ color: '#4a4a6a' }}>Ready — draw a search area</span>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LayerPanel
          visibility={layerVisibility}
          onChange={(id, val) => setLayerVisibility(prev => ({ ...prev, [id]: val }))}
          dcCompanySummary={dcCompanySummary}
          dcHidden={dcHidden}
          onDcToggle={(name, visible) => setDcHidden(prev => {
            const next = new Set(prev);
            if (visible) next.delete(name); else next.add(name);
            return next;
          })}
        />

        <Map
          layerVisibility={layerVisibility}
          results={results}
          onMapReady={setMapInstance}
          staticData={staticData}
          hasSearch={!!searchBbox}
          searchPolygon={searchBbox}
          flyToSite={flyToSite}
          onSiteClick={site => { setSelectedSite(site); setFlyToSite(site); }}
          dcData={staticData.datacenters}
          dcHidden={dcHidden}
        >
          <DrawControl map={mapInstance} onSearch={setSearchBbox} />
        </Map>

        <ResultsPanel
          results={results}
          onSelect={site => { setSelectedSite(site); setFlyToSite(site); }}
          searching={searching}
          hasDrawn={!!searchBbox}
        />
      </div>

      <SiteDetailModal site={selectedSite} onClose={() => setSelectedSite(null)} />
      <LoadingOverlay visible={staticData.loading} />
      <ExportButton results={results} />
    </div>
  );
}
