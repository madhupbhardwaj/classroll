import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

type GoogleKey = JsonWebKey & { kid: string; kty: string; alg?: string; use?: string };
type GoogleClaims = {
  iss?: string; aud?: string | string[]; azp?: string; sub?: string;
  exp?: number; iat?: number; nbf?: number; email?: string;
  email_verified?: boolean; hd?: string; name?: string;
};

let cachedKeys: GoogleKey[] = [];
let keysExpireAt = 0;

async function googleKeys(forceRefresh = false): Promise<GoogleKey[]> {
  if (!forceRefresh && cachedKeys.length && Date.now() < keysExpireAt) return cachedKeys;
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Google public keys are unavailable.');
  const body = await response.json() as { keys?: GoogleKey[] };
  if (!Array.isArray(body.keys) || !body.keys.length) throw new Error('Google returned no public keys.');
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300);
  cachedKeys = body.keys;
  keysExpireAt = Date.now() + Math.max(0, Math.min(maxAge, 86400) - 30) * 1000;
  return cachedKeys;
}

export async function verifyGoogleIdToken(token: string, clientId: string): Promise<{sub:string;email:string;name:string}> {
  if (!clientId || token.length > 16000) throw new Error('Google sign-in is unavailable.');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) throw new Error('Invalid Google credential.');
  let header: { alg?: string; kid?: string };
  let claims: GoogleClaims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { throw new Error('Invalid Google credential.'); }
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid Google credential.');
  let keys = await googleKeys();
  let key = keys.find(candidate => candidate.kid === header.kid && candidate.kty === 'RSA' && (!candidate.alg || candidate.alg === 'RS256') && (!candidate.use || candidate.use === 'sig'));
  if (!key) {
    keys = await googleKeys(true);
    key = keys.find(candidate => candidate.kid === header.kid && candidate.kty === 'RSA' && (!candidate.alg || candidate.alg === 'RS256') && (!candidate.use || candidate.use === 'sig'));
  }
  if (!key) throw new Error('Invalid Google credential.');
  let valid = false;
  try {
    valid = verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), createPublicKey({key, format:'jwk'}), Buffer.from(parts[2], 'base64url'));
  } catch { /* Reject malformed keys and signatures. */ }
  if (!valid) throw new Error('Invalid Google credential.');
  const now = Math.floor(Date.now() / 1000);
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss || '') ||
      claims.aud !== clientId || (claims.azp && claims.azp !== clientId) ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now + 60 ||
      (claims.nbf !== undefined && claims.nbf > now + 60) ||
      !claims.sub || !claims.email || claims.email_verified !== true) {
    throw new Error('Invalid Google credential.');
  }
  const email = claims.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !(email.endsWith('@gmail.com') || claims.hd)) {
    throw new Error('Use a Gmail or Google Workspace account so Classroll can verify email ownership.');
  }
  return {sub:claims.sub, email, name:(claims.name || email.split('@')[0]).trim().slice(0,80)};
}
