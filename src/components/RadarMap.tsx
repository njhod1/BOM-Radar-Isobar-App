import { MapContainer, TileLayer } from 'react-leaflet';
import { AnimatedRadar } from './AnimatedRadar';
import { IsobarLayer } from './IsobarLayer';
import { MapController } from './MapController';
import { LocationButton } from './LocationButton';
import type { RadarFrame } from '../hooks/useRadarFrames';
import type { IsobarLine } from '../utils/isobar';
import type { Region } from '../hooks/useIsobars';

interface Props {
  region: Region;
  frames: RadarFrame[];
  currentFrame: number;
  radarOpacity: number;
  isobars: IsobarLine[];
  isobarOpacity: number;
}

export function RadarMap({ region, frames, currentFrame, radarOpacity, isobars, isobarOpacity }: Props) {
  return (
    <MapContainer
      center={[-33.87, 151.21]}
      zoom={7}
      zoomControl={false}
      className="map-container"
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <MapController region={region} />
      <AnimatedRadar frames={frames} currentIndex={currentFrame} opacity={radarOpacity} />
      <IsobarLayer isobars={isobars} opacity={isobarOpacity} />
      <LocationButton />
    </MapContainer>
  );
}
