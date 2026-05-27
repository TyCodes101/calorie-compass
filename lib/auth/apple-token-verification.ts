import { createPublicKey, verify as verifySignature, type JsonWebKeyInput } from 'crypto';

export const appleIssuer = 'https://appleid.apple.com';
export const appleJwksUrl = 'https://appleid.apple.com/auth/keys';

type AppleJwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type AppleJwtClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  nonce?: string;
};

type AppleJwk = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
  kty?: string;
};

type AppleJwks = {
  keys?: AppleJwk[];
};

export type VerifiedAppleIdentity = {
  subject: string;
  audience: string;
  issuer: typeof appleIssuer;
  issuedAt: number;
  expiresAt: number;
  email?: string;
  emailVerified?: boolean;
  nonce?: string;
};

export type AppleIdentityVerificationResult =
  | { ok: true; identity: VerifiedAppleIdentity }
  | { ok: false; error: string; code: 'APPLE_TOKEN_INVALID' | 'APPLE_TOKEN_CONFIG_MISSING' };

type VerifyAppleIdentityTokenOptions = {
  identityToken: string;
  expectedAudience?: string;
  nonce?: string;
  nowSeconds?: number;
  fetchJwks?: () => Promise<AppleJwks>;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

function decodeJwtPart<T>(part: string): T | null {
  try {
    return JSON.parse(decodeBase64Url(part).toString('utf8')) as T;
  } catch {
    return null;
  }
}

function parseEmailVerified(value: AppleJwtClaims['email_verified']) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return undefined;
}

function audienceMatches(audience: AppleJwtClaims['aud'], expectedAudience: string) {
  if (typeof audience === 'string') {
    return audience === expectedAudience;
  }
  if (Array.isArray(audience)) {
    return audience.includes(expectedAudience);
  }
  return false;
}

async function fetchAppleJwks(): Promise<AppleJwks> {
  const response = await fetch(appleJwksUrl, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Apple JWKS request failed with ${response.status}`);
  }
  return (await response.json()) as AppleJwks;
}

function isUsableAppleJwk(key: AppleJwk | undefined): key is AppleJwk {
  return Boolean(key && key.kty === 'RSA' && key.kid && (!key.use || key.use === 'sig'));
}

function verifyRs256Signature(signingInput: string, signature: string, jwk: AppleJwk) {
  const publicKey = createPublicKey({ key: jwk as JsonWebKeyInput['key'], format: 'jwk' });
  return verifySignature('RSA-SHA256', Buffer.from(signingInput), publicKey, decodeBase64Url(signature));
}

export async function verifyAppleIdentityToken({
  identityToken,
  expectedAudience,
  nonce,
  nowSeconds = Math.floor(Date.now() / 1000),
  fetchJwks = fetchAppleJwks,
}: VerifyAppleIdentityTokenOptions): Promise<AppleIdentityVerificationResult> {
  const trimmedAudience = expectedAudience?.trim();
  if (!trimmedAudience) {
    return { ok: false, code: 'APPLE_TOKEN_CONFIG_MISSING', error: 'Apple audience/client id server configuration is required.' };
  }

  const parts = identityToken.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token must be a compact JWT.' };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJwtPart<AppleJwtHeader>(encodedHeader);
  const claims = decodeJwtPart<AppleJwtClaims>(encodedPayload);
  if (!header || !claims) {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token header or payload is invalid.' };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token must use RS256 with a key id.' };
  }

  if (claims.iss !== appleIssuer) {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token issuer is invalid.' };
  }

  if (!audienceMatches(claims.aud, trimmedAudience)) {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token audience is invalid.' };
  }

  if (typeof claims.sub !== 'string' || claims.sub.trim().length === 0) {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token subject is required.' };
  }

  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token is expired.' };
  }

  if (typeof claims.iat !== 'number' || claims.iat > nowSeconds + 300) {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token issued-at time is invalid.' };
  }

  if (nonce && claims.nonce !== nonce) {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token nonce is invalid.' };
  }

  try {
    const jwks = await fetchJwks();
    const jwk = jwks.keys?.find((key) => key.kid === header.kid);
    if (!isUsableAppleJwk(jwk)) {
      return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple signing key was not found.' };
    }

    if (!verifyRs256Signature(`${encodedHeader}.${encodedPayload}`, encodedSignature, jwk)) {
      return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token signature is invalid.' };
    }

    return {
      ok: true,
      identity: {
        subject: claims.sub,
        audience: trimmedAudience,
        issuer: appleIssuer,
        issuedAt: claims.iat,
        expiresAt: claims.exp,
        email: claims.email,
        emailVerified: parseEmailVerified(claims.email_verified),
        nonce: claims.nonce,
      },
    };
  } catch {
    return { ok: false, code: 'APPLE_TOKEN_INVALID', error: 'Apple identity token could not be verified.' };
  }
}
