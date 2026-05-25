import { useState } from 'react';
import { LAYERS } from '../constants/layers.js';

const DOT_SHAPES = {
  substations: { borderRadius: '50%' },
  transmission: { borderRadius: 1, height: 3, width: 14 },
  pipelines: { borderRadius: 1, height: 3, width: 14 },
  flood: { borderRadius: 3 },
  protected: { borderRadius: 3 },
  ssa: { borderRadius: 3 },
  highways: { borderRadius: 1, height: 3, width: 14 },
  airports: { borderRadius: '50%' },
};

// Deterministic color per operator name
const KNOWN_COLORS = {
  equinix: '#f97316', cyrusone: '#3b82f6', qts: '#8b5cf6',
  amazon: '#f59e0b', aws: '#f59e0b', google: '#22c55e',
  microsoft: '#0ea5e9', azure: '#0ea5e9', meta: '#1d4ed8',
  facebook: '#1d4ed8', databank: '#ec4899', 't5': '#06b6d4',
  flexential: '#84cc16', switch: '#f43f5e', 'iron mountain': '#78716c',
  ironmountain: '#78716c', lumen: '#a78bfa', zayo: '#34d399',
};
const FALLBACK_COLORS = ['#a78bfa','#34d399','#fb7185','#38bdf8','#fbbf24','#a3e635','#f472b6','#4ade80'];

export function getOperatorColor(operator) {
  const key = (operator || 'unknown').toLowerCase();
  for (const [k, v] of Object.entries(KNOWN_COLORS)) {
    if (key.includes(k)) return v;
  }
  let hash = 0;
  for (const c of key) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export default function LayerPanel({ visibility, onChange, dcCompanySummary = [], dcHidden, onDcToggle }) {
  const [dcOpen, setDcOpen] = useState(true);
  const visibleCount = Object.values(visibility).filter(Boolean).length;
  const allDcOn = dcHidden.size === 0;
  const someDcOn = allDcOn || dcHidden.size < dcCompanySummary.length;

  function toggleAllDc(on) {
    dcCompanySummary.forEach(({ name }) => onDcToggle(name, on));
  }

  return (
    <div style={{
      width: 220, flexShrink: 0, background: '#13131f',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid #2a2a3e', overflow: 'hidden',
    }}>
      {/* ── Infrastructure layers ── */}
      <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid #2a2a3e', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#4a4a6a', textTransform: 'uppercase' }}>
          Infrastructure
        </div>
        <div style={{ fontSize: 11, color: '#4a4a6a', marginTop: 2 }}>{visibleCount}/{LAYERS.length} visible</div>
      </div>

      <div style={{ overflowY: 'auto', padding: '8px 8px', flex: dcCompanySummary.length ? '0 0 auto' : 1 }}>
        {LAYERS.map(layer => {
          const shape = DOT_SHAPES[layer.id] || {};
          const isOn = !!visibility[layer.id];
          return (
            <label key={layer.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 6px', borderRadius: 6, cursor: 'pointer',
              fontSize: 12, color: isOn ? '#c4c4d4' : '#4a4a6a',
              transition: 'background 0.1s, color 0.1s',
              background: isOn ? 'rgba(255,255,255,0.03)' : 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = isOn ? 'rgba(255,255,255,0.03)' : 'transparent'}
            >
              <input type="checkbox" checked={isOn} onChange={e => onChange(layer.id, e.target.checked)} style={{ display: 'none' }} />
              <div style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                border: `1.5px solid ${isOn ? layer.color : '#3a3a5a'}`,
                background: isOn ? layer.color : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {isOn && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
              </div>
              <div style={{
                width: shape.width || 10, height: shape.height || 10,
                borderRadius: shape.borderRadius ?? 2, flexShrink: 0,
                background: layer.color, opacity: isOn ? 0.85 : 0.3,
              }} />
              <span style={{ lineHeight: 1.3 }}>{layer.label}</span>
            </label>
          );
        })}
      </div>

      {/* ── Data Centers section ── */}
      {dcCompanySummary.length > 0 && (
        <div style={{ borderTop: '1px solid #2a2a3e', flexShrink: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            padding: '10px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <button onClick={() => setDcOpen(o => !o)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#4a4a6a', textTransform: 'uppercase' }}>
                Data Centers
              </span>
              <span style={{ color: '#4a4a6a', fontSize: 10 }}>{dcOpen ? '▲' : '▼'}</span>
            </button>
            {/* All on/off toggle */}
            <button onClick={() => toggleAllDc(!allDcOn)} style={{
              background: 'none', border: '1px solid #3a3a5a', borderRadius: 4,
              padding: '2px 7px', fontSize: 10, color: '#6c6c8a', cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#3a3a5a'}
            >
              {allDcOn ? 'Hide all' : 'Show all'}
            </button>
          </div>

          {dcOpen && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
              {dcCompanySummary.map(({ name, count }) => {
                const isOn = !dcHidden.has(name);
                const color = getOperatorColor(name);
                return (
                  <label key={name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 6px', borderRadius: 6, cursor: 'pointer',
                    fontSize: 11, color: isOn ? '#c4c4d4' : '#4a4a6a',
                    transition: 'background 0.1s',
                    background: isOn ? 'rgba(255,255,255,0.03)' : 'transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = isOn ? 'rgba(255,255,255,0.03)' : 'transparent'}
                  >
                    <input type="checkbox" checked={isOn} onChange={e => onDcToggle(name, e.target.checked)} style={{ display: 'none' }} />
                    {/* Company color dot */}
                    <div style={{
                      width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                      background: isOn ? color : '#3a3a5a',
                      border: `1.5px solid ${isOn ? color : '#3a3a5a'}`,
                      transition: 'all 0.15s',
                    }} />
                    <span style={{ flex: 1, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <span style={{ fontSize: 10, color: '#4a4a6a', flexShrink: 0 }}>{count}</span>
                  </label>
                );
              })}
              <div style={{ marginTop: 8, padding: '6px 6px', fontSize: 10, color: '#3a3a5a', lineHeight: 1.5 }}>
                Source: OpenStreetMap contributors. Coverage is partial — not all facilities are mapped.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Score legend ── */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #2a2a3e', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4a4a6a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Site Score</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#86efac' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />≥70
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#fde68a' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }} />40–69
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#64748b', border: '2px solid #cbd5e1' }} />DC
          </div>
        </div>
      </div>
    </div>
  );
}
