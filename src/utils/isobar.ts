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

// Bilinearly upsample a coarse grid by factor k so d3-contour has many cells to
// work with — this is what turns straight, faceted isobars into smooth curves.
function upsample(
  vals: number[], nRows: number, nCols: number, k: number,
): { data: number[]; rows: number; cols: number } {
  const rows = (nRows - 1) * k + 1;
  const cols = (nCols - 1) * k + 1;
  const data = new Array<number>(rows * cols);
  for (let r = 0; r < rows; r++) {
    const fr = r / k;
    const r0 = Math.min(nRows - 1, Math.floor(fr));
    const r1 = Math.min(nRows - 1, r0 + 1);
    const tr = fr - r0;
    for (let c = 0; c < cols; c++) {
      const fc = c / k;
      const c0 = Math.min(nCols - 1, Math.floor(fc));
      const c1 = Math.min(nCols - 1, c0 + 1);
      const tc = fc - c0;
      const v00 = vals[r0 * nCols + c0];
      const v01 = vals[r0 * nCols + c1];
      const v10 = vals[r1 * nCols + c0];
      const v11 = vals[r1 * nCols + c1];
      const top = v00 + (v01 - v00) * tc;
      const bot = v10 + (v11 - v10) * tc;
      data[r * cols + c] = top + (bot - top) * tr;
    }
  }
  return { data, rows, cols };
}

const THRESHOLDS = Array.from({ length: 16 }, (_, i) => 980 + i * 4); // 980..1040 hPa
const UPSAMPLE = 6;

// A point sitting on the outer edge of the data grid (contours get closed along
// the grid frame, which would otherwise draw a rectangular "box" over the map).
function onFrame(pt: [number, number], cfg: GridConfig, eps = 0.05): boolean {
  return (
    Math.abs(pt[0] - cfg.latMax) < eps ||
    Math.abs(pt[0] - cfg.latMin) < eps ||
    Math.abs(pt[1] - cfg.lonMin) < eps ||
    Math.abs(pt[1] - cfg.lonMax) < eps
  );
}

// Split a closed contour ring into open polylines, dropping any segment that
// runs along the grid frame — this removes the boundary box while keeping the
// real isobars that touch the edge.
function clipFrame(ring: [number, number][], cfg: GridConfig): Array<[number, number][]> {
  const out: Array<[number, number][]> = [];
  let cur: [number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    if (i > 0 && onFrame(ring[i - 1], cfg) && onFrame(ring[i], cfg)) {
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
    cur.push(ring[i]);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// Chaikin corner-cutting — rounds the angular joints left by a coarse grid into
// smooth curves. Each pass replaces every corner with two points at 1/4 and 3/4
// along its segments; endpoints are preserved so open polylines stay anchored.
function chaikin(pts: [number, number][], iterations = 2): [number, number][] {
  let out = pts;
  for (let it = 0; it < iterations && out.length >= 3; it++) {
    const next: [number, number][] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [ay, ax] = out[i];
      const [by, bx] = out[i + 1];
      next.push([ay + (by - ay) * 0.25, ax + (bx - ax) * 0.25]);
      next.push([ay + (by - ay) * 0.75, ax + (bx - ax) * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

export function computeIsobars(values: number[], cfg: GridConfig): IsobarLine[] {
  // Smooth away single-cell spikes, then upsample for smooth curved contours
  const v = smooth(values, cfg.nRows, cfg.nCols);
  const { data, rows, cols } = upsample(v, cfg.nRows, cfg.nCols, UPSAMPLE);
  const gen = contours().size([cols, rows]).thresholds(THRESHOLDS);
  return gen(data)
    .filter(f => f.coordinates.length > 0)
    .map(f => {
      const rings: Array<[number, number][]> = [];
      for (const polygon of f.coordinates) {
        const latlon = polygon[0].map(([x, y]) => {
          const lat = cfg.latMax - (y / (rows - 1)) * (cfg.latMax - cfg.latMin);
          const lon = cfg.lonMin + (x / (cols - 1)) * (cfg.lonMax - cfg.lonMin);
          return [lat, lon] as [number, number];
        });
        for (const seg of clipFrame(latlon, cfg)) rings.push(chaikin(seg));
      }
      return { pressure: f.value, rings };
    });
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
