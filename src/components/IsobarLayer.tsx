import { Polyline } from 'react-leaflet';
import type { IsobarLine } from '../utils/isobar';
import { isobarColor, isobarWeight } from '../utils/isobar';

interface Props {
  isobars: IsobarLine[];
  opacity: number;
}

export function IsobarLayer({ isobars, opacity }: Props) {
  if (opacity === 0 || isobars.length === 0) return null;

  return (
    <>
      {isobars.map(iso =>
        iso.rings.map((ring, ri) => (
          <Polyline
            key={`${iso.pressure}-${ri}`}
            positions={ring}
            pathOptions={{
              color: isobarColor(iso.pressure),
              weight: isobarWeight(iso.pressure),
              opacity,
              fill: false,
              interactive: false,
            }}
          />
        )),
      )}
    </>
  );
}
