import { useState, useEffect, useCallback, useRef, Component } from 'react';
import type { ReactNode } from 'react';
import { RadarMap } from './components/RadarMap';
import { Controls } from './components/Controls';
import { Legend } from './components/Legend';
import { useRadarFrames } from './hooks/useRadarFrames';
import type { Region } from './hooks/useIsobars';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#dc2626', fontFamily: 'sans-serif' }}>
          <strong>App error:</strong> {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [region, setRegion] = useState<Region>('australia');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(0.7);
  const [isobarOpacity, setIsobarOpacity] = useState(0.9);

  const { frames, loading: radarLoading, error: radarError } = useRadarFrames();

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

  return (
    <ErrorBoundary>
    <div className="app">
      <RadarMap
        region={region}
        frames={frames}
        currentFrame={currentFrame}
        radarOpacity={radarOpacity}
        isobarOpacity={isobarOpacity}
      />
      <Legend />
      {(radarLoading || radarError) && (
        <div className={`status-bar${radarError ? ' error' : ''}`}>
          {radarError ? `Radar error: ${radarError}` : 'Loading radar…'}
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
    </ErrorBoundary>
  );
}
