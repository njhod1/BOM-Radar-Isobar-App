import { isobarColor } from '../utils/isobar';

const ISOBAR_ENTRIES = [
  { label: '≤992 hPa', hPa: 992 },
  { label: '1000', hPa: 1000 },
  { label: '1008', hPa: 1008 },
  { label: '1016', hPa: 1016 },
  { label: '1024', hPa: 1024 },
  { label: '≥1028', hPa: 1028 },
] as const;

// RainViewer radar colors follow the standard weather radar dBZ palette
const RADAR_ENTRIES = [
  { label: 'Light',    color: '#00d4ff' },
  { label: 'Moderate', color: '#00c800' },
  { label: 'Heavy',    color: '#ffff00' },
  { label: 'Intense',  color: '#ff8c00' },
  { label: 'Extreme',  color: '#ff0000' },
] as const;

export function Legend() {
  return (
    <div className="legend">
      <div className="legend-title">Isobars</div>
      {ISOBAR_ENTRIES.map(e => (
        <div key={e.hPa} className="legend-item">
          <div className="legend-swatch" style={{ background: isobarColor(e.hPa) }} />
          <span>{e.label}</span>
        </div>
      ))}

      <div className="legend-title" style={{ marginTop: 8 }}>Radar</div>
      {RADAR_ENTRIES.map(e => (
        <div key={e.label} className="legend-item">
          <div className="legend-swatch" style={{ background: e.color }} />
          <span>{e.label}</span>
        </div>
      ))}
    </div>
  );
}
