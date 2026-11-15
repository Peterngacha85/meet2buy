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

/** The seller's camera and microphone tracks (or null) among the remote participants. */
function findSellerTracks(room) {
  const people = [...room.remoteParticipants.values()];
  const seller = people.find(isSeller) ?? people.find((p) => p.getTrackPublication(Track.Source.Camera));
  if (!seller) return { video: null, audio: null, present: false };
  return {
    video: seller.getTrackPublication(Track.Source.Camera)?.track ?? null,
    audio: seller.getTrackPublication(Track.Source.Microphone)?.track ?? null,
    present: true,
  };
}

/** Turns browser media errors into words a seller can act on. */
export function mediaErrorMessage(err) {
  if (err?.name === 'NotAllowedError') {
    return 'Your browser blocked the camera or microphone. Allow them for this site (the camera icon in the address bar), then try again.';
  }
  if (err?.name === 'NotFoundError') return 'No camera or microphone was found. Plug one in and try again.';
  if (err?.name === 'NotReadableError') return 'Your camera is being used by another app. Close it and try again.';
  return err?.message || 'Could not start the camera.';
}

/** Camera + mic preview for the seller before going live (720p, published later with simulcast). */
export async function startCameraAndMic() {
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
  const [seller, setSeller] = useState({ video: null, audio: null, present: false });
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

    const refresh = () => active && setSeller(findSellerTracks(room));
    room
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

  return { connection, seller, canPlayAudio, startAudio, error };
}
