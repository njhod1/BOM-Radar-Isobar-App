import { useState, useEffect } from 'react';
import {
  computeIsobars,
  GLOBAL_GRID,
  type GridConfig,
  type IsobarLine,
} from '../utils/isobar';

interface PressureData {
  ts: number;
  grid: GridConfig;
  values: number[];
}

// Raw GitHub URL always serves the latest committed pressure-data.json,
// updated every 30 minutes by the update-pressure GitHub Action.
// Using this URL means zero rate-limit risk — no Open-Meteo calls from the browser.
const GH_DATA_URL =
  'https://raw.githubusercontent.com/njhod1/BOM-Radar-Isobar-App/main/public/pressure-data.json';

// Accept data up to 90 min old (Action runs every 30 min; allow 3× for lag/failures)
const DATA_MAX_AGE = 90 * 60 * 1000;
const GLOBAL_TTL   = 30 * 60 * 1000;
const LS_KEY       = 'bom-isobars-v2';

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
  catch { /* storage full */ }
}

async function fetchFromGitHub(): Promise<number[]> {
  // Cache-bust every 5 minutes so we pick up fresh Action commits
  const bust = Math.floor(Date.now() / 300_000);
  const res = await fetch(`${GH_DATA_URL}?t=${bust}`);
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data: PressureData = await res.json();
  if (!data.values?.length) throw new Error('Empty payload');
  if (Date.now() - data.ts > DATA_MAX_AGE) throw new Error('Data older than 90 min');
  const range = Math.max(...data.values) - Math.min(...data.values);
  if (range < 0.5) throw new Error('Data flat');
  return data.values;
}

export function useIsobars() {
  const [isobars, setIsobars] = useState<IsobarLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    // 1. In-memory hit (fastest — same tab, survives re-renders)
    if (mem.data && Date.now() - mem.at < GLOBAL_TTL) {
      setIsobars(mem.data);
      setLoading(false);
      return;
    }
    // 2. localStorage hit (new tab / page reload within 30 min)
    const stored = lsLoad();
    if (stored && Date.now() - stored.at < GLOBAL_TTL) {
      mem.data = stored.data;
      mem.at   = stored.at;
      setIsobars(stored.data);
      setLoading(false);
      return;
    }
    // 3. Fetch from GitHub-hosted static file (no rate limits)
    setLoading(true);
    setError(null);
    fetchFromGitHub()
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
