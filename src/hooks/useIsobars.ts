import { useState, useEffect } from 'react';
import {
  computeIsobars,
  gridPoints,
  GLOBAL_GRID,
  type GridConfig,
  type IsobarLine,
} from '../utils/isobar';

interface OMPoint {
  hourly: { pressure_msl: number[] };
}

// current UTC hour → index into the hourly array (which starts at 00:00 UTC)
const nowHour = () => new Date().getUTCHours();

let lastChunkError = '';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchChunk(chunk: [number, number][], attempt = 0): Promise<number[]> {
  const lats = chunk.map(([lat]) => lat.toFixed(2)).join(',');
  const lons = chunk.map(([, lon]) => lon.toFixed(2)).join(',');
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&hourly=pressure_msl&timezone=UTC&forecast_days=1`,
    );
    if (r.status === 429 && attempt < 3) {
      await sleep(3000 * (attempt + 1));
      return fetchChunk(chunk, attempt + 1);
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.json();
    if (raw.error) throw new Error(raw.reason ?? 'Open-Meteo error');
    const arr: OMPoint[] = Array.isArray(raw) ? raw : [raw];
    const h = nowHour();
    return arr.map(p => p.hourly?.pressure_msl?.[h] ?? 1013.25);
  } catch (e) {
    lastChunkError = e instanceof Error ? e.message : String(e);
    console.error('Isobar chunk failed:', lastChunkError);
    return chunk.map(() => 1013.25);
  }
}

async function fetchPressure(cfg: GridConfig): Promise<number[]> {
  const pts = gridPoints(cfg);
  const chunks: Array<[number, number][]> = [];
  // 100 pts/chunk → 3 requests for 300-pt global grid (was 6 at 50 pts/chunk)
  for (let i = 0; i < pts.length; i += 100) chunks.push(pts.slice(i, i + 100));

  const vals: number[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(400); // space requests to avoid burst rate limit
    vals.push(...await fetchChunk(chunks[i]));
  }

  const range = Math.max(...vals) - Math.min(...vals);
  if (range < 0.5) throw new Error(`Pressure data unavailable — ${lastChunkError || 'all values identical'}`);

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
