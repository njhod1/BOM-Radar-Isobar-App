#!/usr/bin/env node
// Fetches global pressure grid from Open-Meteo and writes public/pressure-data.json.
// Run by the update-pressure GitHub Action every 30 minutes.
// GitHub Actions IPs are not subject to the same rate limits as browser clients.

import { writeFileSync } from 'fs';

const GRID = { latMin: -75, latMax: 75, lonMin: -179, lonMax: 179, nRows: 10, nCols: 12 };

function gridPoints(cfg) {
  const pts = [];
  for (let row = 0; row < cfg.nRows; row++) {
    const lat = cfg.latMax - (row / (cfg.nRows - 1)) * (cfg.latMax - cfg.latMin);
    for (let col = 0; col < cfg.nCols; col++) {
      const lon = cfg.lonMin + (col / (cfg.nCols - 1)) * (cfg.lonMax - cfg.lonMin);
      pts.push([lat, lon]);
    }
  }
  return pts;
}

async function main() {
  const pts = gridPoints(GRID);
  const lats = pts.map(([lat]) => lat.toFixed(2)).join(',');
  const lons = pts.map(([, lon]) => lon.toFixed(2)).join(',');
  const h = new Date().getUTCHours();

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
              `&hourly=pressure_msl&timezone=UTC&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Open-Meteo ${res.status}: ${body.slice(0, 200)}`);
  }
  const raw = await res.json();
  if (raw.error) throw new Error(raw.reason ?? 'API error');

  const arr = Array.isArray(raw) ? raw : [raw];
  const values = arr.map(p => p.hourly?.pressure_msl?.[h] ?? 1013.25);

  const range = Math.max(...values) - Math.min(...values);
  if (range < 0.5) throw new Error(`Pressure range too small (${range.toFixed(2)} hPa) — data may be stale`);

  writeFileSync('public/pressure-data.json', JSON.stringify({ ts: Date.now(), grid: GRID, values }));
  console.log(`Wrote ${values.length} points, range ${range.toFixed(1)} hPa, hour ${h} UTC`);
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
