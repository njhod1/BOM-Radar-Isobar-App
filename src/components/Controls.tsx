import type { RadarFrame } from '../hooks/useRadarFrames';
import type { Region } from '../hooks/useIsobars';

interface Props {
  frames: RadarFrame[];
  currentIndex: number;
  isPlaying: boolean;
  radarOpacity: number;
  isobarOpacity: number;
  region: Region;
  onPlayPause: () => void;
  onFrameChange: (i: number) => void;
  onRadarOpacity: (v: number) => void;
  onIsobarOpacity: (v: number) => void;
  onRegionChange: (r: Region) => void;
}

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Sydney',
  });
}

// Simple SVG icons inlined to avoid an icon library dependency
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const PrevIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
  </svg>
);

const NextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 4V8l-5.5 4zM16 6h2v12h-2z" />
  </svg>
);

export function Controls({
  frames,
  currentIndex,
  isPlaying,
  radarOpacity,
  isobarOpacity,
  region,
  onPlayPause,
  onFrameChange,
  onRadarOpacity,
  onIsobarOpacity,
  onRegionChange,
}: Props) {
  const current = frames[currentIndex];

  return (
    <div className="controls-panel">
      {/* Region selector */}
      <div className="region-tabs">
        <button
          className={`region-tab${region === 'sydney' ? ' active' : ''}`}
          onClick={() => onRegionChange('sydney')}
        >
          Sydney
        </button>
        <button
          className={`region-tab${region === 'australia' ? ' active' : ''}`}
          onClick={() => onRegionChange('australia')}
        >
          Australia
        </button>
      </div>

      {/* Timeline */}
      <div className="timeline-row">
        <button
          className="btn-icon"
          onClick={() => onFrameChange(Math.max(0, currentIndex - 1))}
          aria-label="Previous frame"
        >
          <PrevIcon />
        </button>

        <button className="btn-play" onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          className="btn-icon"
          onClick={() => onFrameChange(Math.min(frames.length - 1, currentIndex + 1))}
          aria-label="Next frame"
        >
          <NextIcon />
        </button>

        <input
          type="range"
          className="timeline-slider"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={currentIndex}
          onChange={e => onFrameChange(Number(e.target.value))}
        />

        <span className="frame-time">
          {current ? formatTime(current.time) : '--:--'}
        </span>
      </div>

      {/* Opacity sliders */}
      <div className="opacity-row">
        <div className="opacity-group">
          <span className="opacity-label">Radar</span>
          <input
            type="range"
            className="opacity-slider"
            min={0}
            max={100}
            value={Math.round(radarOpacity * 100)}
            onChange={e => onRadarOpacity(Number(e.target.value) / 100)}
          />
        </div>
        <div className="opacity-group">
          <span className="opacity-label">Isobar</span>
          <input
            type="range"
            className="opacity-slider"
            min={0}
            max={100}
            value={Math.round(isobarOpacity * 100)}
            onChange={e => onIsobarOpacity(Number(e.target.value) / 100)}
          />
        </div>
      </div>
    </div>
  );
}
