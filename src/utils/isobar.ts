import { contours } from 'd3-contour';

export interface GridConfig {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  nRows: number;
  nCols: number;
}

export interface IsobarLine {
  pressure: number;
  rings: Array<[number, number][]>; // each ring: [[lat, lon], ...]
}

// Covers SE Australia + surrounds — wide enough to capture synoptic pressure systems
// One large grid shared by all views — edges stay off-screen at any normal zoom
export const AUSTRALASIA_GRID: GridConfig = {
  latMin: -65,
  latMax: -5,
  lonMin: 80,
  lonMax: 195,
  nRows: 15,
  nCols: 20,
};

// Flat array of [lat, lon] pairs in row-major order (row 0 = north edge)
export function gridPoints(cfg: GridConfig): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let row = 0; row < cfg.nRows; row++) {
    const lat = cfg.latMax - (row / (cfg.nRows - 1)) * (cfg.latMax - cfg.latMin);
    for (let col = 0; col < cfg.nCols; col++) {
      const lon = cfg.lonMin + (col / (cfg.nCols - 1)) * (cfg.lonMax - cfg.lonMin);
      pts.push([lat, lon]);
    }
  }
  return pts;
}

// Convert contour [x=col, y=row] space back to [lat, lon]
function xyToLatLon(x: number, y: number, cfg: GridConfig): [number, number] {
  const lat = cfg.latMax - (y / (cfg.nRows - 1)) * (cfg.latMax - cfg.latMin);
  const lon = cfg.lonMin + (x / (cfg.nCols - 1)) * (cfg.lonMax - cfg.lonMin);
  return [lat, lon];
}

const THRESHOLDS = Array.from({ length: 16 }, (_, i) => 980 + i * 4); // 980..1040 hPa

export function computeIsobars(values: number[], cfg: GridConfig): IsobarLine[] {
  const gen = contours().size([cfg.nCols, cfg.nRows]).thresholds(THRESHOLDS);
  return gen(values)
    .filter(f => f.coordinates.length > 0)
    .map(f => ({
      pressure: f.value,
      rings: f.coordinates.map(polygon =>
        polygon[0].map(([x, y]) => xyToLatLon(x, y, cfg)),
      ),
    }));
}

export function isobarColor(hPa: number): string {
  if (hPa <= 992)  return '#ef4444'; // deep red – strong low
  if (hPa <= 1000) return '#f97316'; // orange – low
  if (hPa <= 1008) return '#eab308'; // yellow – below normal
  if (hPa <= 1016) return '#22c55e'; // green – near normal
  if (hPa <= 1024) return '#3b82f6'; // blue – above normal
  return '#a78bfa';                   // purple – strong high
}

export function isobarWeight(hPa: number): number {
  return hPa % 20 === 0 ? 2.5 : 1.5;
}
