import { GREEN_THRESHOLD } from '../utils/scoring.js';

function ScoreBar({ label, value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#5c5c7a', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: value > 0 ? '#8888a8' : '#3a3a5a' }}>{value}/{max}</span>
      </div>
      <div style={{ background: '#1e1e30', borderRadius: 3, height: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: pct === 0 ? 'transparent' : (pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#6366f1'),
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}

export default function SiteCard({ site, rank, onClick }) {
  const isGreen = site.totalScore >= GREEN_THRESHOLD;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#1a1a2e',
        border: `1px solid ${isGreen ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.15)'}`,
        borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
        marginBottom: 6, transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#1e1e38'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#1a1a2e'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: '#4a4a6a', marginBottom: 1 }}>#{rank} · {site.lat.toFixed(3)}°N {Math.abs(site.lng).toFixed(3)}°W</div>
          <div style={{ fontSize: 11, color: '#6c6c8a' }}>
            {site.distSub} mi to substation · {site.distPipe} mi to pipeline
          </div>
        </div>
        <div style={{
          fontSize: 20, fontWeight: 800, lineHeight: 1,
          color: isGreen ? '#4ade80' : '#facc15',
          minWidth: 32, textAlign: 'right',
        }}>
          {site.totalScore}
        </div>
      </div>

      {/* Score bars */}
      <ScoreBar label="⚡ Power" value={site.powerScore} max={30} />
      <ScoreBar label="🔥 Gas" value={site.gasScore} max={25} />
      <ScoreBar label="💧 Water & Env" value={site.waterScore} max={25} />
      <ScoreBar label="🚛 Logistics" value={site.logisticsScore} max={20} />
    </div>
  );
}
