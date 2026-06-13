import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { Region } from '../hooks/useIsobars';

const VIEWS: Record<Region, { center: [number, number]; zoom: number }> = {
  sydney:   { center: [-33.87, 151.21], zoom: 5 },
  australia: { center: [-27.0,  133.0],  zoom: 4 },
  indopac:  { center: [ -5.0,  120.0],  zoom: 3 },
};

export function MapController({ region }: { region: Region }) {
  const map = useMap();
  const prev = useRef<Region | null>(null);

  useEffect(() => {
    if (prev.current === region) return;
    prev.current = region;
    const { center, zoom } = VIEWS[region];
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [region, map]);

  return null;
}
