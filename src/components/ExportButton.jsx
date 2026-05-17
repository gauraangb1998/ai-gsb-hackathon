export default function ExportButton({ results }) {
  const disabled = results.length === 0;

  function handleExport() {
    const cols = [
      'site_id', 'total_score', 'power_score', 'gas_score', 'water_score',
      'logistics_score', 'nearest_substation_distance_mi', 'nearest_pipeline_distance_mi',
      'drought_classification', 'ssa_within_1mi', 'lat', 'lng',
    ];

    const rows = results.map((s, i) => [
      i + 1,
      s.totalScore,
      s.powerScore,
      s.gasScore,
      s.waterScore,
      s.logisticsScore,
      s.distSub,
      s.distPipe,
      s.droughtLevel,
      s.nearSSA ? 'yes' : 'no',
      s.lat.toFixed(6),
      s.lng.toFixed(6),
    ]);

    const csv = [cols, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'siteiq_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      disabled={disabled}
      style={{
        position: 'fixed', bottom: 20, right: 20,
        background: disabled ? '#313244' : '#7c3aed',
        color: disabled ? '#585b70' : '#fff',
        border: 'none', borderRadius: 8,
        padding: '10px 16px', fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        zIndex: 20,
        transition: 'background 0.15s',
      }}
    >
      ⬇ Export CSV ({results.length})
    </button>
  );
}
