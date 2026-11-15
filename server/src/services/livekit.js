import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
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
 * role 'seller' publishes camera + mic; 'viewer' only watches; 'counter' (Sprint 5) may publish mic/camera.
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
    canPublishData: role === 'seller',
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
