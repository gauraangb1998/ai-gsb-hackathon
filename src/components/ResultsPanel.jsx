import SiteCard from './SiteCard.jsx';

export default function ResultsPanel({ results, onSelect, searching, hasDrawn }) {
  let content;

  if (searching) {
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #2a2a3e', borderTopColor: '#7c3aed',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ color: '#6c6c8a', fontSize: 13, textAlign: 'center' }}>
          Scoring sites…<br />
          <span style={{ fontSize: 11, color: '#3a3a5a', marginTop: 4, display: 'block' }}>Checking power, gas, water & logistics</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  } else if (!hasDrawn) {
    content = (
      <div style={{ padding: '40px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
        <div style={{ color: '#6c6c8a', fontSize: 13, lineHeight: 1.6 }}>
          Draw a search area on the map to find and score candidate data center sites
        </div>
        <div style={{ marginTop: 20, background: '#1a1a2e', borderRadius: 8, padding: '12px 14px', textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4a4a6a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>How to search</div>
          {['Click the ✏️ polygon tool (top-right of map)', 'Click to place corners of your search area', 'Double-click to complete the polygon', 'Results appear instantly'].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, color: '#8888a8' }}>
              <span style={{ color: '#5c5c7a', fontWeight: 600, flexShrink: 0 }}>{i + 1}.</span>
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  } else if (results.length === 0) {
    content = (
      <div style={{ padding: '48px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
        <div style={{ color: '#6c6c8a', fontSize: 13, lineHeight: 1.6 }}>
          No sites meet the minimum score threshold in this area.
        </div>
        <div style={{ color: '#4a4a6a', fontSize: 12, marginTop: 8 }}>
          Try a different area or expand your search region.
        </div>
      </div>
    );
  } else {
    content = results.map((site, i) => (
      <SiteCard key={`${site.lat}-${site.lng}`} site={site} rank={i + 1} onClick={() => onSelect(site)} />
    ));
  }

  return (
    <div style={{
      width: 280, flexShrink: 0,
      background: '#13131f',
      display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid #2a2a3e',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid #2a2a3e', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#4a4a6a', textTransform: 'uppercase' }}>
            Candidate Sites
          </div>
          {results.length > 0 && (
            <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 1 }}>
              {results.filter(r => r.totalScore >= 70).length} green · {results.filter(r => r.totalScore < 70).length} yellow
            </div>
          )}
        </div>
        {results.length > 0 && (
          <div style={{
            fontSize: 20, fontWeight: 800,
            color: '#7c3aed',
          }}>{results.length}</div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: results.length > 0 ? '8px 10px' : 0 }}>
        {content}
      </div>
    </div>
  );
}
