export const LAYERS = [
  { id: 'substations',  label: 'Substations (≥345kV)',     file: 'tx_substations.geojson',  color: '#9333ea', defaultOn: true },
  { id: 'transmission', label: 'Transmission Lines',        file: 'tx_transmission.geojson', color: '#a855f7', defaultOn: true },
  { id: 'pipelines',    label: 'Natural Gas Pipelines',     file: 'tx_pipelines.geojson',    color: '#f97316', defaultOn: true },
  { id: 'flood',        label: 'Flood Hazard Zones',        file: 'tx_flood.geojson',        color: '#3b82f6', defaultOn: true },
  { id: 'protected',    label: 'Protected Lands',           file: 'tx_protected.geojson',    color: '#22c55e', defaultOn: true },
  { id: 'ssa',          label: 'Sole Source Aquifers',      file: 'tx_ssa.geojson',          color: '#ef4444', defaultOn: true },
  { id: 'highways',     label: 'Interstate Highways',       file: 'tx_highways.geojson',     color: '#6b7280', defaultOn: true },
  { id: 'airports',     label: 'Airports',                  file: 'tx_airports.geojson',     color: '#6b7280', defaultOn: true },
];
