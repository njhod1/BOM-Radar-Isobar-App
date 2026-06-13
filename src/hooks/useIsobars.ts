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
const LS_KEY = 'bom-isobars-v1';

// In-memory cache (survives re-renders, lost on tab close)
const mem = { data: null as IsobarLine[] | null, at: 0 };

function lsLoad(): { data: IsobarLine[]; at: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p?.at && Array.isArray(p?.data) ? p : null;
  } catch { return null; }
}

function lsSave(data: IsobarLine[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ data, at: Date.now() })); }
  catch { /* storage full or unavailable */ }
}

export function useIsobars() {
  const [isobars, setIsobars] = useState<IsobarLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    // 1. In-memory hit (same tab, survives re-renders)
    if (mem.data && Date.now() - mem.at < GLOBAL_TTL) {
      setIsobars(mem.data);
      setLoading(false);
      return;
    }
    // 2. localStorage hit (new tab / page reload, same browser)
    const stored = lsLoad();
    if (stored && Date.now() - stored.at < GLOBAL_TTL) {
      mem.data = stored.data;
      mem.at   = stored.at;
      setIsobars(stored.data);
      setLoading(false);
      return;
    }
    // 3. Fetch fresh
    setLoading(true);
    setError(null);
    fetchPressure(GLOBAL_GRID)
      .then(vals => {
        const lines = computeIsobars(vals, GLOBAL_GRID);
        mem.data = lines;
        mem.at   = Date.now();
        lsSave(lines);
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
