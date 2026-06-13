import React, { useState, useEffect, useRef } from 'react';
import { Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  computeIsobars,
  gridPoints,
  viewportGrid,
  isobarColor,
  isobarWeight,
} from '../utils/isobar';
import type { IsobarLine, GridConfig } from '../utils/isobar';

// Switch from global (~8°) to local (~2°) grid at this zoom level
const ZOOM_THRESHOLD = 4;
const LOCAL_TTL  = 10 * 60 * 1000; // 10 min
const MIN_RING_POINTS = 5;
const LOCAL_CACHE_MAX = 12;

// Module-level cache survives re-renders
const localCache = new Map<string, { data: IsobarLine[]; at: number }>();

interface OMPoint {
  hourly: { pressure_msl: number[] };
}

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
      return pts.map(() => 1013.25);
    }
    if (!r.ok) return pts.map(() => 1013.25);
    const raw = await r.json();
    if (raw.error) return pts.map(() => 1013.25);
    const arr: OMPoint[] = Array.isArray(raw) ? raw : [raw];
    const h = new Date().getUTCHours();
    return arr.map(p => p.hourly?.pressure_msl?.[h] ?? 1013.25);
  } catch {
    return pts.map(() => 1013.25);
  }
}

function localKey(cfg: GridConfig): string {
  return `${cfg.latMin}|${cfg.latMax}|${cfg.lonMin}|${cfg.lonMax}|${cfg.nRows}|${cfg.nCols}`;
}

function setLocalCache(key: string, data: IsobarLine[]) {
  if (localCache.size >= LOCAL_CACHE_MAX) {
    localCache.delete(localCache.keys().next().value!);
  }
  localCache.set(key, { data, at: Date.now() });
}

// Split a ring wherever the longitude jumps >90° — removes antimeridian and grid-edge artifacts
function splitAtAntimeridian(ring: [number, number][]): Array<[number, number][]> {
  const segs: Array<[number, number][]> = [];
  let cur: [number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    if (i > 0 && Math.abs(ring[i][1] - ring[i - 1][1]) > 90) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    cur.push(ring[i]);
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

function labelPoint(
  ring: [number, number][],
  bounds: L.LatLngBounds,
  center: L.LatLng,
): [number, number] | null {
  let best: [number, number] | null = null;
  let bestDist = Infinity;
  for (const pt of ring) {
    if (!bounds.contains(L.latLng(pt[0], pt[1]))) continue;
    const d = center.distanceTo(L.latLng(pt[0], pt[1]));
    if (d < bestDist) { bestDist = d; best = pt; }
  }
  return best;
}

function makeLabelIcon(pressure: number, color: string): L.DivIcon {
  return L.divIcon({
    className: 'isobar-label',
    html: `<span style="color:${color}">${pressure}</span>`,
    iconSize: [36, 14],
    iconAnchor: [18, 7],
  });
}

interface Props {
  globalIsobars: IsobarLine[];
  opacity: number;
}

export function IsobarLayer({ globalIsobars, opacity }: Props) {
  const map = useMap();
  const [localIsobars, setLocalIsobars] = useState<IsobarLine[] | null>(null);
  const [view, setView] = useState(() => {
    // getBounds() throws "Map container has no size" if container hasn't laid out yet
    try {
      return { bounds: map.getBounds(), center: map.getCenter(), zoom: map.getZoom() };
    } catch {
      return {
        bounds: L.latLngBounds(L.latLng(-60, 88), L.latLng(35, 178)),
        center: L.latLng(-27, 133),
        zoom: 4,
      };
    }
  });
  const fetchingLocal = useRef(false);

  // Track map movement
  useEffect(() => {
    const update = () =>
      setView({ bounds: map.getBounds(), center: map.getCenter(), zoom: map.getZoom() });
    map.on('moveend', update);
    map.on('zoomend', update);
    return () => { map.off('moveend', update); map.off('zoomend', update); };
  }, [map]);

  // Fetch local grid when zoomed in, refetch when viewport changes
  const boundsKey = [
    view.bounds.getSouth().toFixed(1), view.bounds.getNorth().toFixed(1),
    view.bounds.getWest().toFixed(1),  view.bounds.getEast().toFixed(1),
  ].join(',');

  useEffect(() => {
    if (view.zoom <= ZOOM_THRESHOLD) {
      setLocalIsobars(null); // fall back to global
      return;
    }
    const b = view.bounds;
    const cfg = viewportGrid(b.getSouth(), b.getNorth(), b.getWest(), b.getEast());
    const key = localKey(cfg);
    const hit = localCache.get(key);
    if (hit && Date.now() - hit.at < LOCAL_TTL) {
      setLocalIsobars(hit.data);
      return;
    }
    if (fetchingLocal.current) return;
    fetchingLocal.current = true;
    fetchPressure(cfg)
      .then(vals => {
        const lines = computeIsobars(vals, cfg);
        setLocalCache(key, lines);
        setLocalIsobars(lines);
      })
      .catch(console.error)
      .finally(() => { fetchingLocal.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.zoom, boundsKey]);

  if (opacity === 0) return null;

  const isobars = view.zoom > ZOOM_THRESHOLD && localIsobars ? localIsobars : globalIsobars;
  if (isobars.length === 0) return null;

  return (
    <>
      {isobars.map(iso =>
        iso.rings.map((ring, ri) => {
          if (ring.length < MIN_RING_POINTS) return null;
          const color = isobarColor(iso.pressure);
          const segs = splitAtAntimeridian(ring);
          const pos = labelPoint(ring, view.bounds, view.center);
          return (
            <React.Fragment key={`${iso.pressure}-${ri}`}>
              {segs.map((seg, si) => (
                <Polyline
                  key={si}
                  positions={seg}
                  pathOptions={{ color, weight: isobarWeight(iso.pressure), opacity, fill: false, interactive: false }}
                />
              ))}
              {pos && (
                <Marker
                  position={pos}
                  icon={makeLabelIcon(iso.pressure, color)}
                  interactive={false}
                  zIndexOffset={-500}
                  opacity={opacity}
                />
              )}
            </React.Fragment>
          );
        }),
      )}
    </>
  );
}
