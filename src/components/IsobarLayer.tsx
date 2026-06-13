import React from 'react';
import { Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { IsobarLine } from '../utils/isobar';
import { isobarColor, isobarWeight } from '../utils/isobar';

// Only label rings with enough points to be meaningful on screen
const MIN_LABEL_POINTS = 16;

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
  if (opacity === 0 || isobars.length === 0) return null;

  return (
    <>
      {isobars.map(iso =>
        iso.rings.map((ring, ri) => {
          const showLabel = ring.length >= MIN_LABEL_POINTS;
          // Place label ~1/3 along the ring to avoid edge artifacts
          const labelPos = showLabel ? ring[Math.floor(ring.length / 3)] : null;
          const color = isobarColor(iso.pressure);

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
              {labelPos && (
                <Marker
                  position={labelPos}
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
