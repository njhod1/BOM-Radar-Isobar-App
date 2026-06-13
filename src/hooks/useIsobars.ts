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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchPressure(cfg: GridConfig, attempt = 0): Promise<number[]> {
  const pts = gridPoints(cfg);
  const lats = pts.map(([lat]) => lat.toFixed(2)).join(',');
  const lons = pts.map(([, lon]) => lon.toFixed(2)).join(',');
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&hourly=pressure_msl&timezone=UTC&forecast_days=1`,
    );
    if (r.status === 429) {
      if (attempt < 4) {
        await sleep(5000 * (attempt + 1));
        return fetchPressure(cfg, attempt + 1);
      }
      throw new Error('HTTP 429 — rate limited after retries');
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.json();
    if (raw.error) throw new Error(raw.reason ?? 'Open-Meteo error');
    const arr: OMPoint[] = Array.isArray(raw) ? raw : [raw];
    const h = nowHour();
    const vals = arr.map(p => p.hourly?.pressure_msl?.[h] ?? 1013.25);
    const range = Math.max(...vals) - Math.min(...vals);
    if (range < 0.5) throw new Error('Pressure data flat — API may be unavailable');
    return vals;
  } catch (e) {
    throw new Error(`Pressure data unavailable — ${e instanceof Error ? e.message : String(e)}`);
  }
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
