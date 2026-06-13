import { useState } from 'react';
import { useMap } from 'react-leaflet';

const LocateIcon = ({ spinning }: { spinning: boolean }) => (
  <svg
    width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }}
  >
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

export function LocationButton() {
  const map = useMap();
  const [state, setState] = useState<'idle' | 'locating' | 'error'>('idle');

  const locate = () => {
    if (!navigator.geolocation) return;
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      pos => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 10, { duration: 1.5 });
        setState('idle');
      },
      () => {
        setState('error');
        setTimeout(() => setState('idle'), 2000);
      },
      { timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <button
      className={`location-btn${state === 'error' ? ' error' : ''}`}
      onClick={locate}
      aria-label="Go to my location"
      title="Go to my location"
    >
      <LocateIcon spinning={state === 'locating'} />
    </button>
  );
}
