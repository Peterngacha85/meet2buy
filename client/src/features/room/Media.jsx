import { useEffect, useRef } from 'react';

/** Plays a LiveKit (local or remote) video track. Muted: sound comes from <TrackAudio>. */
export function TrackVideo({ track, mirror = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return undefined;
    track.attach(el);
    return () => track.detach(el);
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={`${mirror ? '-scale-x-100' : ''} ${className}`}
    />
  );
}

export function TrackAudio({ track }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return undefined;
    track.attach(el);
    return () => track.detach(el);
  }, [track]);
  return <audio ref={ref} autoPlay />;
}
