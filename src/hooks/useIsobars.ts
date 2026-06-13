import { useState, useEffect } from 'react';
import {
  computeIsobars,
  gridPoints,
  GLOBAL_GRID,
  type GridConfig,
  type IsobarLine,
} from '../utils/isobar';

interface OMPoint {
  current: { pressure_msl: number | null };
}

async function fetchChunk(chunk: [number, number][]): Promise<number[]> {
  const lats = chunk.map(([lat]) => lat.toFixed(2)).join(',');
  const lons = chunk.map(([, lon]) => lon.toFixed(2)).join(',');
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&current=pressure_msl&timezone=UTC&forecast_days=1`,
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.json();
    if (raw.error) throw new Error(raw.reason ?? 'Open-Meteo error');
    const arr: OMPoint[] = Array.isArray(raw) ? raw : [raw];
    return arr.map(p => p.current?.pressure_msl ?? 1013.25);
  } catch (e) {
    console.error('Isobar chunk failed:', e);
    return chunk.map(() => 1013.25);
  }
}

async function fetchPressure(cfg: GridConfig): Promise<number[]> {
  const pts = gridPoints(cfg);
  const chunks: Array<[number, number][]> = [];
  for (let i = 0; i < pts.length; i += 50) chunks.push(pts.slice(i, i + 50));

  // Sequential — parallel calls consistently trigger Open-Meteo rate limits
  const vals: number[] = [];
  for (const chunk of chunks) {
    vals.push(...await fetchChunk(chunk));
  }

  const range = Math.max(...vals) - Math.min(...vals);
  if (range < 0.5) throw new Error('Pressure data unavailable (Open-Meteo may be unreachable)');

  return vals;
}

const GLOBAL_TTL = 30 * 60 * 1000;
const sharedCache = { data: null as IsobarLine[] | null, at: 0 };

export function useIsobars() {
  const [isobars, setIsobars]   = useState<IsobarLine[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  useEffect(() => {
    if (sharedCache.data && Date.now() - sharedCache.at < GLOBAL_TTL) {
      setIsobars(sharedCache.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchPressure(GLOBAL_GRID)
      .then(vals => {
        const lines = computeIsobars(vals, GLOBAL_GRID);
        sharedCache.data = lines;
        sharedCache.at = Date.now();
        setIsobars(lines);
        setLoading(false);
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : 'Isobar load failed');
        setLoading(false);
      });
  }, []);

  return { isobars, loading, error };
}
