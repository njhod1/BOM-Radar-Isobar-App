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
  const loaded = useRef<Set<string>>(new Set());      // paths whose tiles have finished loading at least once
  const visiblePath = useRef<string | null>(null);    // frame currently shown to the user
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  // Add/remove tile layers as the frames list changes
  useEffect(() => {
    if (frames.length === 0) return;

    frames.forEach(frame => {
      if (!layers.current.has(frame.path)) {
        const layer = L.tileLayer(frame.tileUrl, {
          opacity: 0,
          zIndex: 200,
          attribution: 'Radar: <a href="https://www.rainviewer.com">RainViewer</a>',
          maxNativeZoom: 8,
          maxZoom: 19,
          noWrap: true,           // don't repeat radar across wrapped world copies
          keepBuffer: 4,          // keep more surrounding tiles so panning doesn't blank out
        });
        // Mark a frame ready once all its visible tiles have loaded
        layer.on('load', () => loaded.current.add(frame.path));
        layer.addTo(map);
        layers.current.set(frame.path, layer);
      }
    });

    // Remove layers for frames that no longer exist
    const pathSet = new Set(frames.map(f => f.path));
    layers.current.forEach((layer, path) => {
      if (!pathSet.has(path)) {
        map.removeLayer(layer);
        layers.current.delete(path);
        loaded.current.delete(path);
      }
    });
  }, [frames, map]);

  // Show the current frame — but if its tiles aren't loaded yet, keep the last
  // loaded frame visible and only swap once the new one is ready. This prevents
  // the blank flashes ("rain appears then disappears") during the first loop.
  useEffect(() => {
    const current = frames[currentIndex];
    if (!current) return;
    const layer = layers.current.get(current.path);
    if (!layer) return;

    const show = () => {
      // Bail if playback has already moved on to a different frame
      if (frames[currentIndex]?.path !== current.path) return;
      layers.current.forEach((l, path) => {
        l.setOpacity(path === current.path ? opacityRef.current : 0);
      });
      visiblePath.current = current.path;
    };

    if (loaded.current.has(current.path)) {
      show();                     // already loaded → switch instantly
    } else {
      layer.once('load', show);   // not yet → hold last frame, reveal when ready
    }
  }, [frames, currentIndex]);

  // Opacity slider: adjust the visible frame without changing which frame shows
  useEffect(() => {
    if (!visiblePath.current) return;
    layers.current.get(visiblePath.current)?.setOpacity(opacity);
  }, [opacity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      layers.current.forEach(layer => map.removeLayer(layer));
      layers.current.clear();
      loaded.current.clear();
    };
  }, [map]);

  return null;
}
