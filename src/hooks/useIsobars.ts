import { useState, useEffect } from 'react';
import {
  computeIsobars,
  gridPoints,
  AUSTRALASIA_GRID,
  type GridConfig,
  type IsobarLine,
} from '../utils/isobar';

export type Region = 'sydney' | 'australia' | 'indopac';

interface OMPoint {
  current: { pressure_msl: number | null };
}

async function fetchPressure(cfg: GridConfig): Promise<number[]> {
  const pts = gridPoints(cfg);
  const lats = pts.map(([lat]) => lat.toFixed(2)).join(',');
  const lons = pts.map(([, lon]) => lon.toFixed(2)).join(',');
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lats}&longitude=${lons}` +
    `&current=pressure_msl&timezone=UTC&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const raw: OMPoint | OMPoint[] = await res.json();
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map(p => p.current.pressure_msl ?? 1013.25);
}

const CACHE_TTL = 15 * 60 * 1000; // 15 min

// Single shared cache — grid is the same regardless of which region tab is active
const sharedCache = { data: null as IsobarLine[] | null, at: 0 };

export function useIsobars(_region: Region) {
  const [isobars, setIsobars] = useState<IsobarLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (sharedCache.data && Date.now() - sharedCache.at < CACHE_TTL) {
      setIsobars(sharedCache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchPressure(AUSTRALASIA_GRID)
      .then(vals => {
        const lines = computeIsobars(vals, AUSTRALASIA_GRID);
        sharedCache.data = lines;
        sharedCache.at = Date.now();
        if (!cancelled) { setIsobars(lines); setLoading(false); }
      })
      .catch(e => {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Isobar load failed'); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, []); // no region dependency — grid never changes

  return { isobars, loading, error };
}
