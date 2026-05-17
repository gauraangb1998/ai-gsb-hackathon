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

export default function LayerPanel({ visibility, onChange }) {
  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return (
    <div style={{
      width: 210, flexShrink: 0,
      background: '#13131f',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid #2a2a3e',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid #2a2a3e', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#4a4a6a', textTransform: 'uppercase' }}>
          Infrastructure Layers
        </div>
        <div style={{ fontSize: 11, color: '#4a4a6a', marginTop: 2 }}>{visibleCount}/{LAYERS.length} visible</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {LAYERS.map(layer => {
          const shape = DOT_SHAPES[layer.id] || {};
          const isOn = !!visibility[layer.id];
          return (
            <label key={layer.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 6px', borderRadius: 6, cursor: 'pointer',
              fontSize: 12, color: isOn ? '#c4c4d4' : '#4a4a6a',
              transition: 'background 0.1s, color 0.1s',
              background: isOn ? 'rgba(255,255,255,0.03)' : 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = isOn ? 'rgba(255,255,255,0.03)' : 'transparent'}
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={e => onChange(layer.id, e.target.checked)}
                style={{ display: 'none' }}
              />
              {/* Custom checkbox */}
              <div style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                border: `1.5px solid ${isOn ? layer.color : '#3a3a5a'}`,
                background: isOn ? layer.color : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {isOn && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
              </div>

              {/* Color dot/line preview */}
              <div style={{
                width: shape.width || 10,
                height: shape.height || 10,
                borderRadius: shape.borderRadius ?? 2,
                flexShrink: 0,
                background: layer.color,
                opacity: isOn ? 0.85 : 0.3,
              }} />

              <span style={{ lineHeight: 1.3 }}>{layer.label}</span>
            </label>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #2a2a3e', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4a4a6a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Site Score</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#86efac' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
            ≥70 Green
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#fde68a' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }} />
            40–69 Yellow
          </div>
        </div>
      </div>
    </div>
  );
}
