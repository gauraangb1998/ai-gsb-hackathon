export default function SiteDetailModal({ site, onClose }) {
  if (!site) return null;

  const dims = [
    { label: 'Power', key: 'powerScore', max: 30, source: 'HIFLD — 345kV+ Substations' },
    { label: 'Gas', key: 'gasScore', max: 25, source: 'HIFLD — Natural Gas Pipelines' },
    { label: 'Water & Environment', key: 'waterScore', max: 25, source: 'US Drought Monitor + EPA SSA' },
    { label: 'Logistics', key: 'logisticsScore', max: 20, source: 'HIFLD — Highways & FAA Airports' },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 500,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1e1e2e', border: '1px solid #313244',
          borderRadius: 12, padding: 24, width: 380, maxWidth: '95vw',
          color: '#cdd6f4', position: 'relative',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none', color: '#6c7086',
            fontSize: 18, cursor: 'pointer', lineHeight: 1,
          }}
        >✕</button>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#6c7086', marginBottom: 2 }}>Candidate Site</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {site.lat.toFixed(4)}°N, {Math.abs(site.lng).toFixed(4)}°W
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'center', marginBottom: 20,
        }}>
          <div style={{
            fontSize: 36, fontWeight: 800,
            color: site.totalScore >= 70 ? '#86efac' : '#fde68a',
          }}>
            {site.totalScore}
            <span style={{ fontSize: 14, fontWeight: 400, color: '#6c7086', marginLeft: 4 }}>/100</span>
          </div>
        </div>

        {dims.map(({ label, key, max, source }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#cba6f7' }}>{site[key]}/{max}</span>
            </div>
            <div style={{ background: '#313244', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 2 }}>
              <div style={{
                width: `${Math.round((site[key] / max) * 100)}%`,
                height: '100%', borderRadius: 4,
                background: site[key] / max >= 0.7 ? '#22c55e' : site[key] / max >= 0.4 ? '#eab308' : '#6c7086',
              }} />
            </div>
            <div style={{ fontSize: 10, color: '#585b70' }}>{source}</div>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #313244', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: '#6c7086', fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Distances
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
            <Dist label="Substation" value={site.distSub} />
            <Dist label="Pipeline" value={site.distPipe} />
            <Dist label="Highway" value={site.distHighway} />
            <Dist label="Airport" value={site.distAirport} />
          </div>
        </div>

        <div style={{ borderTop: '1px solid #313244', paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
            <div><span style={{ color: '#6c7086' }}>Drought: </span>{site.droughtLevel}</div>
            <div><span style={{ color: '#6c7086' }}>Near SSA: </span>{site.nearSSA ? 'Yes ⚠️' : 'No'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dist({ label, value }) {
  return (
    <div>
      <span style={{ color: '#6c7086' }}>{label}: </span>
      <span>{value} mi</span>
    </div>
  );
}
