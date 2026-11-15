import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

// Video and audio of the live room (doc 07 §2). Our API issues the tokens; the secret never leaves the server.

export const isLiveKitConfigured = () =>
  Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);

function assertConfigured() {
  if (!isLiveKitConfigured()) {
    throw new AppError(503, 'Live video is not set up yet. Add the LiveKit keys to the server settings.');
  }
}

const TOKEN_TTL = '6h';

/**
 * A LiveKit access token for one participant.
 * role 'seller' publishes camera + mic; 'viewer' only watches; 'counter' may publish mic/camera;
 * 'observer' (admin review) only watches and is hidden from the other participants.
 */
export async function createRoomToken({ room, identity, name, role }) {
  assertConfigured();
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: TOKEN_TTL,
    metadata: JSON.stringify({ role }),
  });
  const canPublish = role === 'seller' || role === 'counter';
  at.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish,
    // A buyer at the counter may use their mic and camera only (no screen sharing).
    ...(role === 'counter' ? { canPublishSources: ['camera', 'microphone'] } : {}),
    canPublishData: role === 'seller',
    // Admin reviewing a room: sees and hears everything, invisible to everyone in it.
    ...(role === 'observer' ? { hidden: true } : {}),
    // The seller is the room "admin" in LiveKit terms only for their own room.
    roomAdmin: role === 'seller',
  });
  return { token: await at.toJwt(), url: env.LIVEKIT_URL };
}

let client;
function roomService() {
  if (!client) {
    // The REST API lives on the same host as the websocket URL.
    const host = env.LIVEKIT_URL.replace(/^ws/, 'http');
    client = new RoomServiceClient(host, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  }
  return client;
}

/**
 * Give a connected buyer the counter (mic + camera) or take it back (doc 07 §2). LiveKit stops their
 * tracks when publishing is revoked. Returns false if they are not connected to the video (never throws).
 */
export async function setCounterPublish(room, identity, allowed) {
  if (!isLiveKitConfigured()) return false;
  try {
    await roomService().updateParticipant(room, identity, {
      permission: {
        canSubscribe: true,
        canPublish: allowed,
        canPublishData: false,
        canPublishSources: allowed ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
      },
    });
    return true;
  } catch (err) {
    if (err?.status !== 404 && err?.code !== 'not_found') logger.warn(`LiveKit updateParticipant ${identity} failed: ${err.message}`);
    return false;
  }
}

/** Disconnect everyone from a LiveKit room. Never throws: ending our session must not depend on LiveKit. */
export async function closeLiveKitRoom(room) {
  if (!isLiveKitConfigured()) return;
  try {
    await roomService().deleteRoom(room);
  } catch (err) {
    // 404 = nobody ever joined (the room was never created on LiveKit). Anything else is worth a log line.
    if (err?.status !== 404 && err?.code !== 'not_found') logger.warn(`LiveKit deleteRoom ${room} failed: ${err.message}`);
  }
}
