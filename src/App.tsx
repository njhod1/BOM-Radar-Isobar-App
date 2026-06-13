import { useState, useEffect, useCallback, useRef } from 'react';
import { RadarMap } from './components/RadarMap';
import { Controls } from './components/Controls';
import { Legend } from './components/Legend';
import { useRadarFrames } from './hooks/useRadarFrames';
import { useIsobars, type Region } from './hooks/useIsobars';

export default function App() {
  const [region, setRegion] = useState<Region>('sydney');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(0.7);
  const [isobarOpacity, setIsobarOpacity] = useState(0.9);

  const { frames, loading: radarLoading, error: radarError } = useRadarFrames();
  const { isobars, loading: isobarLoading, error: isobarError } = useIsobars(region);

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Jump to latest frame when frames first arrive
  useEffect(() => {
    if (frames.length > 0) setCurrentFrame(frames.length - 1);
  }, [frames.length]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, 600);
    return () => clearInterval(timerRef.current);
  }, [isPlaying, frames.length]);

  const handleRegionChange = useCallback((r: Region) => {
    setRegion(r);
  }, []);

  const statusMessage = (() => {
    if (radarError) return { text: `Radar error: ${radarError}`, error: true };
    if (isobarError) return { text: `Isobar error: ${isobarError}`, error: true };
    if (radarLoading) return { text: 'Loading radar…', error: false };
    if (isobarLoading) return { text: 'Computing isobars…', error: false };
    return null;
  })();

  return (
    <div className="app">
      <RadarMap
        region={region}
        frames={frames}
        currentFrame={currentFrame}
        radarOpacity={radarOpacity}
        isobars={isobars}
        isobarOpacity={isobarOpacity}
      />
      <Legend />
      {statusMessage && (
        <div className={`status-bar${statusMessage.error ? ' error' : ''}`}>
          {statusMessage.text}
        </div>
      )}
      <Controls
        frames={frames}
        currentIndex={currentFrame}
        isPlaying={isPlaying}
        radarOpacity={radarOpacity}
        isobarOpacity={isobarOpacity}
        region={region}
        onPlayPause={() => setIsPlaying(p => !p)}
        onFrameChange={setCurrentFrame}
        onRadarOpacity={setRadarOpacity}
        onIsobarOpacity={setIsobarOpacity}
        onRegionChange={handleRegionChange}
      />
    </div>
  );
}
