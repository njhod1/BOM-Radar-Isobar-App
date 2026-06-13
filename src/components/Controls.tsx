import { useState, useRef, useEffect } from 'react';
import type { RadarFrame } from '../hooks/useRadarFrames';
import type { FlyTarget, Favourite } from '../types';

interface Props {
  frames: RadarFrame[];
  currentIndex: number;
  isPlaying: boolean;
  radarOpacity: number;
  isobarOpacity: number;
  favourites: Favourite[];
  onFlyTo: (t: FlyTarget) => void;
  onSaveFavourite: (f: Favourite) => void;
  onDeleteFavourite: (name: string) => void;
  onPlayPause: () => void;
  onFrameChange: (i: number) => void;
  onRadarOpacity: (v: number) => void;
  onIsobarOpacity: (v: number) => void;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

function shortName(s: string): string {
  return s.split(',')[0].trim();
}

function zoomFromBBox(bb?: [string, string, string, string]): number {
  if (!bb) return 8;
  const latSpan = parseFloat(bb[1]) - parseFloat(bb[0]);
  const lonSpan = parseFloat(bb[3]) - parseFloat(bb[2]);
  const span = Math.max(latSpan, lonSpan);
  if (span > 30) return 3;
  if (span > 8)  return 4;
  if (span > 2)  return 6;
  if (span > 0.3) return 9;
  return 12;
}

async function geocode(q: string): Promise<NominatimResult[]> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
      { headers: { 'Accept-Language': 'en' } },
    );
    return r.ok ? r.json() : [];
  } catch { return []; }
}

const GLOBAL_TARGET: FlyTarget = { lat: 20, lon: 10, zoom: 2 };

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

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const GlobeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

export function Controls({ frames, currentIndex, isPlaying, radarOpacity, isobarOpacity, favourites, onFlyTo, onSaveFavourite, onDeleteFavourite, onPlayPause, onFrameChange, onRadarOpacity, onIsobarOpacity }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastResult, setLastResult] = useState<NominatimResult | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setResults([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    const res = await geocode(query.trim());
    setIsSearching(false);
    if (res.length === 0) return;
    // Auto-fly to best result immediately; show the rest as alternatives
    const best = res[0];
    setLastResult(best);
    setQuery(shortName(best.display_name));
    onFlyTo({ lat: parseFloat(best.lat), lon: parseFloat(best.lon), zoom: zoomFromBBox(best.boundingbox) });
    setResults(res.slice(1));
  };

  const selectResult = (r: NominatimResult) => {
    setLastResult(r);
    setResults([]);
    setQuery(shortName(r.display_name));
    onFlyTo({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), zoom: zoomFromBBox(r.boundingbox) });
  };

  const isSaved = lastResult != null && favourites.some(f => f.name === shortName(lastResult.display_name));
  const canSave = lastResult != null && !isSaved && favourites.length < 3;

  const current = frames[currentIndex];

  return (
    <div className="controls-panel">
      {/* Favourites chips */}
      {favourites.length > 0 && (
        <div className="favourites-row">
          {favourites.map(f => (
            <button
              key={f.name}
              className="fav-chip"
              onClick={() => { onFlyTo({ lat: f.lat, lon: f.lon, zoom: 8 }); setQuery(f.name); }}
            >
              <span className="fav-chip-star">★</span>
              {f.name}
              <span
                className="fav-chip-del"
                role="button"
                aria-label={`Remove ${f.name}`}
                onClick={e => { e.stopPropagation(); onDeleteFavourite(f.name); }}
              >×</span>
            </button>
          ))}
        </div>
      )}

      {/* Search row */}
      <div className="search-wrap" ref={wrapRef}>
        <form className="search-row" onSubmit={doSearch}>
          <input
            className="search-input"
            type="text"
            placeholder="Search location…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            onFocus={e => e.target.select()}
          />
          <button type="submit" className="nav-btn" aria-label="Search" disabled={isSearching}>
            {isSearching ? <span style={{ fontSize: 13 }}>…</span> : <SearchIcon />}
          </button>
          <button
            type="button"
            className={`nav-btn star-btn${isSaved ? ' saved' : ''}`}
            onClick={() => lastResult && onSaveFavourite({ name: shortName(lastResult.display_name), lat: parseFloat(lastResult.lat), lon: parseFloat(lastResult.lon) })}
            disabled={!canSave}
            aria-label={isSaved ? 'Already saved' : 'Save as favourite'}
            title={!lastResult ? 'Search for a location first' : isSaved ? 'Already saved' : favourites.length >= 3 ? 'Delete a favourite first' : 'Save as favourite'}
          >
            <StarIcon filled={!!isSaved} />
          </button>
          <button
            type="button"
            className="nav-btn"
            onClick={() => onFlyTo(GLOBAL_TARGET)}
            aria-label="Global view"
            title="Global view"
          >
            <GlobeIcon />
          </button>
        </form>

        {results.length > 0 && (
          <div className="search-dropdown">
            {results.map((r, i) => (
              <button key={i} className="search-result-item" type="button" onClick={() => selectResult(r)}>
                <span className="search-result-name">{shortName(r.display_name)}</span>
                <span className="search-result-sub">{r.display_name.split(',').slice(1, 3).join(',').trim()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="timeline-row">
        <button className="btn-icon" onClick={() => onFrameChange(Math.max(0, currentIndex - 1))} aria-label="Previous frame"><PrevIcon /></button>
        <button className="btn-play" onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <PauseIcon /> : <PlayIcon />}</button>
        <button className="btn-icon" onClick={() => onFrameChange(Math.min(frames.length - 1, currentIndex + 1))} aria-label="Next frame"><NextIcon /></button>
        <div className="timeline-track">
          <input type="range" className="timeline-slider" min={0} max={Math.max(0, frames.length - 1)} value={currentIndex} onChange={e => onFrameChange(Number(e.target.value))} />
          <div className="timeline-labels">
            <span>{frames.length > 0 ? `${Math.round((frames.length - 1 - currentIndex) * 10)}m ago` : ''}</span>
            <span className={currentIndex === frames.length - 1 ? 'now-label' : ''}>Now</span>
          </div>
        </div>
        <span className="frame-time">
          {currentIndex === frames.length - 1 && frames.length > 0 ? 'Now' : current ? formatTime(current.time) : '--:--'}
        </span>
      </div>

      {/* Opacity */}
      <div className="opacity-row">
        <div className="opacity-group">
          <span className="opacity-label">Radar</span>
          <input type="range" className="opacity-slider" min={0} max={100} value={Math.round(radarOpacity * 100)} onChange={e => onRadarOpacity(Number(e.target.value) / 100)} />
        </div>
        <div className="opacity-group">
          <span className="opacity-label">Isobar</span>
          <input type="range" className="opacity-slider" min={0} max={100} value={Math.round(isobarOpacity * 100)} onChange={e => onIsobarOpacity(Number(e.target.value) / 100)} />
        </div>
      </div>
    </div>
  );
}
