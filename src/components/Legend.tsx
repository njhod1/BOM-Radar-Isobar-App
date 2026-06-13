import { isobarColor } from '../utils/isobar';

const ENTRIES = [
  { label: '≤992 hPa', hPa: 992 },
  { label: '1000', hPa: 1000 },
  { label: '1008', hPa: 1008 },
  { label: '1016', hPa: 1016 },
  { label: '1024', hPa: 1024 },
  { label: '≥1028', hPa: 1028 },
] as const;

export function Legend() {
  return (
    <div className="legend">
      <div className="legend-title">Isobars</div>
      {ENTRIES.map(e => (
        <div key={e.hPa} className="legend-item">
          <div className="legend-swatch" style={{ background: isobarColor(e.hPa) }} />
          <span>{e.label}</span>
        </div>
      ))}
    </div>
  );
}
