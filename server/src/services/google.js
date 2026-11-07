import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';

// "Continue with Google": the browser gets an ID token from Google Identity Services
// and sends it to POST /api/auth/google. We check its signature, expiry and audience here.
let client;

export const isGoogleConfigured = () => Boolean(env.GOOGLE_CLIENT_ID);

/** Returns { sub, email, emailVerified, name, picture } or null if the token is not valid for our client ID. */
export async function verifyGoogleIdToken(idToken) {
  client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) return null;
    return { sub: p.sub, email: p.email.toLowerCase(), emailVerified: p.email_verified === true, name: p.name, picture: p.picture };
  } catch {
    return null;
  }
}
