import { MapContainer, TileLayer } from 'react-leaflet';
import { AnimatedRadar } from './AnimatedRadar';
import { IsobarLayer } from './IsobarLayer';
import { MapController } from './MapController';
import { LocationButton } from './LocationButton';
import type { RadarFrame } from '../hooks/useRadarFrames';
import type { FlyTarget } from '../types';
import type { IsobarLine } from '../utils/isobar';

interface Props {
  flyTarget: FlyTarget | null;
  frames: RadarFrame[];
  currentFrame: number;
  radarOpacity: number;
  isobarOpacity: number;
  isobars: IsobarLine[];
}

export function RadarMap({ flyTarget, frames, currentFrame, radarOpacity, isobarOpacity, isobars }: Props) {
  return (
    <MapContainer
      center={[-27.0, 133.0]}
      zoom={4}
      minZoom={2}
      zoomControl={false}
      className="map-container"
      attributionControl={true}
      maxBounds={[[-85, -180], [85, 180]]}
      maxBoundsViscosity={1.0}
      worldCopyJump={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
        noWrap={true}
      />
      <MapController flyTarget={flyTarget} />
      <AnimatedRadar frames={frames} currentIndex={currentFrame} opacity={radarOpacity} />
      <IsobarLayer globalIsobars={isobars} opacity={isobarOpacity} />
      <LocationButton />
    </MapContainer>
  );
}
