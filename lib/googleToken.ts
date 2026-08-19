import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Checks that a Google sign-in token is genuine.
 *
 * The credential the browser sends back is a JWT signed by Google. It was previously read with
 * `decodeJwt`, which only unpacks the payload -- it verifies nothing. Anyone could have written
 * `{"email":"someone@example.com"}`, signed it with any key at all, posted it here, and been logged
 * in as that person, with their credits and their plan.
 *
 * Verification means three things, and all three matter:
 *   - the signature matches one of Google's published keys (it really came from Google);
 *   - the audience is our client id (it was issued for this app, not some other site's);
 *   - the issuer is Google (nobody else minted it).
 */
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  /** Google's stable id for the account; survives an email address change. */
  sub: string;
}

export async function verifyGoogleCredential(
  credential: string,
  clientId: string | undefined
): Promise<GoogleIdentity | null> {
  if (!credential || !clientId) {
    if (!clientId) console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured; cannot verify.');
    return null;
  }

  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      audience: clientId,
      issuer: GOOGLE_ISSUERS,
    });

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase().trim() : '';
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!email || !sub) return null;

    // An unverified address could belong to someone else entirely.
    if (payload.email_verified === false) {
      console.warn('Rejected a Google sign-in with an unverified email address.');
      return null;
    }

    return {
      email,
      emailVerified: payload.email_verified !== false,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
      sub,
    };
  } catch (e) {
    console.warn('Rejected an invalid Google credential:', e instanceof Error ? e.message : e);
    return null;
  }
}
