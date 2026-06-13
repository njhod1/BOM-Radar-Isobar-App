import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { RadarFrame } from '../hooks/useRadarFrames';

interface Props {
  frames: RadarFrame[];
  currentIndex: number;
  opacity: number;
}

export function AnimatedRadar({ frames, currentIndex, opacity }: Props) {
  const map = useMap();
  const layers = useRef<Map<string, L.TileLayer>>(new Map());

  // Add/remove layers as frames list changes
  useEffect(() => {
    if (frames.length === 0) return;

    // Add missing layers (opacity 0 until they're the current frame)
    frames.forEach(frame => {
      if (!layers.current.has(frame.path)) {
        const layer = L.tileLayer(frame.tileUrl, {
          opacity: 0,
          zIndex: 200,
          attribution: 'Radar: <a href="https://www.rainviewer.com">RainViewer</a>',
          maxNativeZoom: 8,
          maxZoom: 19,
        });
        layer.addTo(map);
        layers.current.set(frame.path, layer);
      }
    });

    // Remove stale layers
    const pathSet = new Set(frames.map(f => f.path));
    layers.current.forEach((layer, path) => {
      if (!pathSet.has(path)) {
        map.removeLayer(layer);
        layers.current.delete(path);
      }
    });
  }, [frames, map]);

  // Show only the current frame
  useEffect(() => {
    const current = frames[currentIndex];
    if (!current) return;
    layers.current.forEach((layer, path) => {
      layer.setOpacity(path === current.path ? opacity : 0);
    });
  }, [frames, currentIndex, opacity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      layers.current.forEach(layer => map.removeLayer(layer));
      layers.current.clear();
    };
  }, [map]);

  return null;
}
