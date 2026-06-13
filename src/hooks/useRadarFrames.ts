import { useState, useEffect } from 'react';

export interface RadarFrame {
  time: number;   // unix seconds
  path: string;   // e.g. "/v2/radar/1234567800"
  tileUrl: string;
}

interface RVResponse {
  host: string;
  radar: {
    past: Array<{ time: number; path: string }>;
  };
}

const API = 'https://api.rainviewer.com/public/weather-maps.json';

export function useRadarFrames() {
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(API);
        if (!res.ok) throw new Error(`RainViewer ${res.status}`);
        const data: RVResponse = await res.json();

        const past = data.radar.past.slice(-12); // up to last ~2 hours
        const mapped: RadarFrame[] = past.map(f => ({
          time: f.time,
          path: f.path,
          tileUrl: `${data.host}${f.path}/512/{z}/{x}/{y}/2/1_1.png`,
        }));

        if (!cancelled) {
          setFrames(mapped);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Radar load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 10 * 60 * 1000); // refresh every 10 min
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { frames, loading, error };
}
