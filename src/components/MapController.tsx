import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { FlyTarget } from '../types';

export function MapController({ flyTarget }: { flyTarget: FlyTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!flyTarget) return;
    map.flyTo([flyTarget.lat, flyTarget.lon], flyTarget.zoom, { duration: 1.2 });
  }, [flyTarget, map]);

  return null;
}
