/**
 * The Google OAuth client id, in one place.
 *
 * It is not a secret -- it is sent to the browser on every sign-in -- but it must be identical on
 * both sides: the button that requests the token uses it as the audience, and the server checks
 * that audience when verifying. They used to be written separately, one hard-coded in the sign-in
 * dialog and one read from an environment variable, so a missing variable silently rejected every
 * valid login. The environment still wins, for moving the app to another Google project without a
 * code change.
 */
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "729533279786-55pmrngc4lurkcv4dluf048v7es7uiua.apps.googleusercontent.com";
