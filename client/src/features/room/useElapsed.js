import { useEffect, useState } from 'react';

/** Seconds since `since` (a date), ticking every second; null when there is no start time. */
export function useElapsedSeconds(since) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!since) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return null;
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
}

/** 75 → "01:15", 3725 → "1:02:05" */
export function clock(seconds) {
  if (seconds == null) return '';
  const hh = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}
