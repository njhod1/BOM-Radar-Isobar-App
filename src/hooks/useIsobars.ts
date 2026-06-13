import { useState, useEffect, useRef } from 'react';
import {
  computeIsobars,
  gridPoints,
  SYDNEY_GRID,
  AUSTRALIA_GRID,
  type GridConfig,
  type IsobarLine,
} from '../utils/isobar';

export type Region = 'sydney' | 'australia';

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

export function useIsobars(region: Region) {
  const [isobars, setIsobars] = useState<IsobarLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<Region, { data: IsobarLine[]; at: number }>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const cfg = region === 'sydney' ? SYDNEY_GRID : AUSTRALIA_GRID;
    const hit = cache.current.get(region);

    if (hit && Date.now() - hit.at < CACHE_TTL) {
      setIsobars(hit.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchPressure(cfg)
      .then(vals => {
        const lines = computeIsobars(vals, cfg);
        cache.current.set(region, { data: lines, at: Date.now() });
        if (!cancelled) { setIsobars(lines); setLoading(false); }
      })
      .catch(e => {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Isobar load failed'); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [region]);

  return { isobars, loading, error };
}
