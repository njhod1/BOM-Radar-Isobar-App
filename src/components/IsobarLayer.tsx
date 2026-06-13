import React, { useState, useEffect } from 'react';
import { Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { IsobarLine } from '../utils/isobar';
import { isobarColor, isobarWeight } from '../utils/isobar';

const MIN_RING_POINTS = 5;

// Find the ring point closest to the map center that is inside the current view
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
  isobars: IsobarLine[];
  opacity: number;
}

export function IsobarLayer({ isobars, opacity }: Props) {
  const map = useMap();
  const [view, setView] = useState(() => ({
    bounds: map.getBounds(),
    center: map.getCenter(),
  }));

  useEffect(() => {
    const update = () => setView({ bounds: map.getBounds(), center: map.getCenter() });
    map.on('moveend', update);
    map.on('zoomend', update);
    return () => {
      map.off('moveend', update);
      map.off('zoomend', update);
    };
  }, [map]);

  if (opacity === 0 || isobars.length === 0) return null;

  return (
    <>
      {isobars.map(iso =>
        iso.rings.map((ring, ri) => {
          if (ring.length < MIN_RING_POINTS) return null;
          const color = isobarColor(iso.pressure);
          const pos = labelPoint(ring, view.bounds, view.center);

          return (
            <React.Fragment key={`${iso.pressure}-${ri}`}>
              <Polyline
                positions={ring}
                pathOptions={{
                  color,
                  weight: isobarWeight(iso.pressure),
                  opacity,
                  fill: false,
                  interactive: false,
                }}
              />
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
