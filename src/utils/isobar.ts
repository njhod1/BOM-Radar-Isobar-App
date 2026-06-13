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

// Coarse global grid — 10×12 = 120 points; small enough to stay inside
// Open-Meteo's free-tier per-request coordinate limit
export const GLOBAL_GRID: GridConfig = {
  latMin: -75,
  latMax: 75,
  lonMin: -179,
  lonMax: 179,
  nRows: 10,
  nCols: 12,
};

// Dense local grid derived from the current map viewport + 70% padding so
// the grid boundary is always well off-screen
export function viewportGrid(
  south: number,
  north: number,
  west: number,
  east: number,
): GridConfig {
  const latPad = (north - south) * 0.7;
  const lonPad = (east - west) * 0.7;
  const latMin = Math.max(-80, south - latPad);
  const latMax = Math.min(80, north + latPad);
  const lonMin = Math.max(-179, west - lonPad);
  const lonMax = Math.min(179, east + lonPad);
  // ~2° target spacing, capped at 15×15
  const nRows = Math.min(15, Math.max(5, Math.round((latMax - latMin) / 2)));
  const nCols = Math.min(15, Math.max(5, Math.round((lonMax - lonMin) / 2)));
  return { latMin, latMax, lonMin, lonMax, nRows, nCols };
}

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

// 3×3 box blur — reduces sharp single-cell spikes that cause concentric-ring artifacts
function smooth(vals: number[], nRows: number, nCols: number): number[] {
  return vals.map((_, i) => {
    const r = Math.floor(i / nCols), c = i % nCols;
    let sum = 0, count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < nRows && nc >= 0 && nc < nCols) {
          sum += vals[nr * nCols + nc]; count++;
        }
      }
    }
    return sum / count;
  });
}

const THRESHOLDS = Array.from({ length: 16 }, (_, i) => 980 + i * 4); // 980..1040 hPa

export function computeIsobars(values: number[], cfg: GridConfig): IsobarLine[] {
  // One smoothing pass tames single-cell spikes without compressing the pressure range
  const v = smooth(values, cfg.nRows, cfg.nCols);
  const gen = contours().size([cfg.nCols, cfg.nRows]).thresholds(THRESHOLDS);
  return gen(v)
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
