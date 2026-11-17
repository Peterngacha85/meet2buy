import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  createLocalTracks,
} from 'livekit-client';

const isSeller = (p) => {
  try {
    return JSON.parse(p.metadata || '{}').role === 'seller';
  } catch {
    return false;
  }
};

const tracksOf = (p) => ({
  video: p?.getTrackPublication(Track.Source.Camera)?.track ?? null,
  audio: p?.getTrackPublication(Track.Source.Microphone)?.track ?? null,
});

/**
 * Remote tracks: the seller's, and the buyer at the counter (any other participant publishing).
 * The seller's token carries role "seller" in its metadata.
 */
function findRemoteTracks(room) {
  const people = [...room.remoteParticipants.values()];
  const seller = people.find(isSeller);
  const counter = people.find(
    (p) => !isSeller(p) && (p.getTrackPublication(Track.Source.Microphone) || p.getTrackPublication(Track.Source.Camera)),
  );
  return {
    seller: { ...tracksOf(seller), present: Boolean(seller) },
    counter: counter ? { ...tracksOf(counter), name: counter.name || 'Shopper' } : null,
  };
}

function findLocal(room) {
  const lp = room.localParticipant;
  return {
    mic: Boolean(lp.getTrackPublication(Track.Source.Microphone)?.track && !lp.getTrackPublication(Track.Source.Microphone).isMuted),
    camera: lp.getTrackPublication(Track.Source.Camera)?.track ?? null,
  };
}

/**
 * Browsers only allow the camera and microphone on https:// pages (and http://localhost). Opened as
 * http://192.168.x.x from a phone, there is no permission prompt at all — so we say why.
 */
export const mediaAvailable = () => typeof window !== 'undefined' && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);

function assertMedia() {
  if (mediaAvailable()) return;
  const err = new Error('insecure');
  err.name = 'InsecureContext';
  throw err;
}

/**
 * The camera/mic exists and is allowed, but another app holds it (a WhatsApp or phone call, Zoom…).
 * Chrome says NotReadableError ("Could not start video source"), Firefox AbortError, old Chrome TrackStartError.
 */
export const isDeviceBusy = (err) =>
  ['NotReadableError', 'AbortError', 'TrackStartError'].includes(err?.name) || /could not start (video|audio) source/i.test(err?.message ?? '');

/** Turns browser media errors into words a seller can act on. */
export function mediaErrorMessage(err) {
  if (err?.name === 'InsecureContext') {
    return 'This browser blocks the camera and microphone on this address. Open Meet2buy from its https:// link (not an http:// or IP address) and try again.';
  }
  if (err?.name === 'NotAllowedError') {
    return 'Your browser blocked the camera or microphone. Allow them for this site (the camera icon in the address bar), then try again.';
  }
  if (err?.name === 'NotFoundError') return 'No camera or microphone was found. Plug one in and try again.';
  if (err?.name === 'NotReadableError') return 'Your camera is being used by another app. Close it and try again.';
  return err?.message || 'Could not start the camera.';
}

/** Camera + mic preview for the seller before going live (720p, published later with simulcast). */
export async function startCameraAndMic() {
  assertMedia();
  return createLocalTracks({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: { resolution: VideoPresets.h720.resolution, facingMode: 'user' },
  });
}

/**
 * Connect to a LiveKit room (doc 07 §2).
 * Viewers get the seller's video/audio; the seller passes `publish` (local tracks) to broadcast them.
 */
export function useLiveKit({ url, token, publish = null }) {
  const [connection, setConnection] = useState('idle'); // idle | connecting | connected | reconnecting | disconnected
  const [remote, setRemote] = useState({ seller: { video: null, audio: null, present: false }, counter: null });
  const [local, setLocal] = useState({ mic: false, camera: null });
  const [canPlayAudio, setCanPlayAudio] = useState(true);
  const [error, setError] = useState('');
  const roomRef = useRef(null);

  useEffect(() => {
    if (!url || !token) return undefined;
    let active = true;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    setError('');
    setConnection('connecting');

    const refresh = () => {
      if (!active) return;
      setRemote(findRemoteTracks(room));
      setLocal(findLocal(room));
    };
    room
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.TrackSubscribed, refresh)
      .on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.AudioPlaybackStatusChanged, () => active && setCanPlayAudio(room.canPlaybackAudio))
      .on(RoomEvent.ConnectionStateChanged, (s) => {
        if (!active) return;
        if (s === ConnectionState.Connected) setConnection('connected');
        else if (s === ConnectionState.Reconnecting || s === ConnectionState.SignalReconnecting) setConnection('reconnecting');
      })
      .on(RoomEvent.Disconnected, (reason) => {
        if (!active) return;
        setConnection('disconnected');
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) setError('You opened this room in another tab or device, so video moved there.');
        else if (reason === DisconnectReason.ROOM_DELETED) setError('');
        else if (reason !== DisconnectReason.CLIENT_INITIATED) setError('Video disconnected. Reload the page to reconnect.');
      });

    (async () => {
      try {
        await room.connect(url, token);
        if (!active) return;
        if (publish) {
          for (const track of publish) {
            await room.localParticipant.publishTrack(track, track.kind === 'video' ? { simulcast: true } : {});
          }
        }
        refresh();
        setCanPlayAudio(room.canPlaybackAudio);
      } catch (err) {
        if (active) {
          setConnection('disconnected');
          setError(err?.message?.includes('permission') ? mediaErrorMessage(err) : 'Could not connect to the live video. Check your internet and reload.');
        }
      }
    })();

    return () => {
      active = false;
      roomRef.current = null;
      room.removeAllListeners();
      // Keep the seller's preview tracks alive: the page owns them.
      room.disconnect(false);
    };
  }, [url, token, publish]);

  /** Browsers block sound until the user taps: call from a click. */
  const startAudio = useCallback(async () => {
    await roomRef.current?.startAudio();
    setCanPlayAudio(roomRef.current?.canPlaybackAudio ?? true);
  }, []);

  /** Buyer at the counter: turn the mic / camera on or off. Throws if not allowed or the browser blocks it. */
  const setMic = useCallback(async (enabled) => {
    const room = roomRef.current;
    if (!room) throw new Error('Not connected');
    if (enabled) assertMedia();
    await room.localParticipant.setMicrophoneEnabled(enabled, { echoCancellation: true, noiseSuppression: true });
    setLocal(findLocal(room));
  }, []);
  const setCamera = useCallback(async (enabled) => {
    const room = roomRef.current;
    if (!room) throw new Error('Not connected');
    if (enabled) assertMedia();
    await room.localParticipant.setCameraEnabled(enabled, { resolution: VideoPresets.h360.resolution, facingMode: 'user' });
    setLocal(findLocal(room));
  }, []);
  /** Stop publishing everything (the counter turn ended). */
  const stopPublishing = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await Promise.allSettled([room.localParticipant.setMicrophoneEnabled(false), room.localParticipant.setCameraEnabled(false)]);
    setLocal(findLocal(room));
  }, []);

  return {
    connection,
    seller: remote.seller,
    counter: remote.counter,
    local,
    canPlayAudio,
    startAudio,
    setMic,
    setCamera,
    stopPublishing,
    error,
  };
}
