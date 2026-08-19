
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { storeGetJson, storeGetString, storeSetJson, storeSetString, quotaGet as storeQuotaGet, quotaIncrement } from "@/lib/quotaStore";

/**
 * The key that signs session cookies.
 *
 * It had a hard-coded fallback, and with no JWT_SECRET configured that fallback was what actually
 * signed every session. A secret committed to the repository is not a secret: anyone who can read
 * the source can mint a cookie for any account. Verifying signatures properly only helps if the key
 * is not public, so this says so loudly rather than carrying on quietly.
 */
const FALLBACK_SECRET = "wall_ai_jwt_secret_key_2026_super_secure_12345";

if (!process.env.JWT_SECRET) {
  console.error(
    "SESSIONS ARE FORGEABLE: JWT_SECRET is not set, so sessions are signed with a key that is " +
      "published in the source. Set JWT_SECRET to a long random value."
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || FALLBACK_SECRET);

const COOKIE_NAME = "wall_ai_session";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: "free" | "pro" | "unlimited";
  credits: number;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Accounts are kept in Redis, not in memory.
 *
 * They used to fall back to an in-process Map whenever the store was unconfigured -- which it always
 * was, since the REST credentials this file looked for were never set. On Vercel each request may be
 * served by a fresh instance, so that Map was empty again moments later: every sign-in looked like a
 * brand new account and handed out another set of free credits, to the same person, indefinitely.
 * The limits were not being bypassed; there was simply nothing remembering anyone.
 */
const USER_KEY = (id: string) => `wall_ai:user:${id}`;
const USER_BY_EMAIL_KEY = (email: string) => `wall_ai:user-email:${email.toLowerCase()}`;
const USER_AUTH_KEY = (id: string) => `wall_ai:user-auth:${id}`;

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "_wall_ai_salt_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionToken(user: UserProfile): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    credits: user.credits,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

/**
 * Reads a session cookie, and only accepts it if the signature holds.
 *
 * There used to be a fallback here: if verification failed, the token was decoded unsigned and
 * accepted anyway as long as it carried a subject or an email. That made the signature decorative --
 * anyone could write their own cookie naming any account and be logged in as them, with that
 * account's credits and plan. An expired or tampered token is now simply not a session.
 */
export async function verifySessionToken(token: string) {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload || !payload.sub) return null;

    const userId = payload.sub as string;
    const kvUser = await getUserById(userId);
    if (kvUser) return kvUser;

    return {
      id: userId,
      email: (payload.email as string) || "",
      name: (payload.name as string) || "",
      plan: (payload.plan as "free" | "pro" | "unlimited") || "free",
      credits: typeof payload.credits === "number" ? payload.credits : 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function saveUser(user: UserProfile, passwordHash?: string): Promise<void> {
  const stored = await storeSetJson(USER_KEY(user.id), user);
  await storeSetString(USER_BY_EMAIL_KEY(user.email), user.id);
  if (passwordHash) await storeSetString(USER_AUTH_KEY(user.id), passwordHash);

  if (!stored) {
    // Worth shouting about: without persistence the free tier resets on every request.
    console.error("ACCOUNT NOT SAVED: the store is unreachable. Check KV_REDIS_URL.");
  }

  // The cookie stays as a convenience copy, not as the source of truth.
  await saveRegisteredUserToCookie(user);
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
  return await storeGetJson<UserProfile>(USER_KEY(userId));
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const userId = await storeGetString(USER_BY_EMAIL_KEY(normalizedEmail));
  if (userId) {
    const user = await getUserById(userId);
    if (user) return user;
  }
  // Only as a last resort: a returning visitor whose account predates the store being connected.
  return await getRegisteredUserFromCookie(normalizedEmail);
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  try {
    const inputHash = await hashPassword(password);
    const storedHash = await storeGetString(USER_AUTH_KEY(userId));
    return !!storedHash && storedHash === inputHash;
  } catch {
    return false;
  }
}

export async function deductUserCredit(userId?: string): Promise<{ success: boolean; remainingCredits: number }> {
  let user = await getCurrentUser();
  if (!user && userId) {
    user = await getUserById(userId);
  }
  if (!user) return { success: false, remainingCredits: 0 };

  if (user.plan === "pro" || user.plan === "unlimited") {
    return { success: true, remainingCredits: 999 };
  }

  if (user.credits <= 0) {
    return { success: false, remainingCredits: 0 };
  }

  user.credits = Math.max(0, user.credits - 1);
  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  try {
    const newToken = await createSessionToken(user);
    await setSessionCookie(newToken);
  } catch (err) {
    console.warn("Failed to update session cookie on deduct:", err);
  }

  return { success: true, remainingCredits: user.credits };
}

export async function addUserCredits(userId: string, count: number, setPlan?: "free" | "pro" | "unlimited"): Promise<UserProfile | null> {
  const user = await getUserById(userId);
  if (!user) return null;

  user.credits += count;
  if (setPlan) user.plan = setPlan;
  user.updatedAt = new Date().toISOString();

  await saveUser(user);
  return user;
}


const USERS_COOKIE_NAME = "wall_ai_registered_users";
const IP_QUOTA_COOKIE = "wall_ai_ip_quota";

export async function getRegisteredUserFromCookie(email: string): Promise<UserProfile | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(USERS_COOKIE_NAME)?.value;
    if (!token) return null;
    const verified = await verifySessionToken(token);
    if (!verified || typeof verified !== "object") return null;
    const usersMap = (verified.users as Record<string, UserProfile>) || {};
    const normalizedEmail = email.toLowerCase().trim();
    return usersMap[normalizedEmail] || null;
  } catch {
    return null;
  }
}

export async function saveRegisteredUserToCookie(user: UserProfile): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(USERS_COOKIE_NAME)?.value;
    let usersMap: Record<string, UserProfile> = {};
    if (token) {
      const verified = await verifySessionToken(token);
      if (verified && typeof verified === "object" && verified.users) {
        usersMap = (verified.users as Record<string, UserProfile>) || {};
      }
    }
    const normalizedEmail = user.email.toLowerCase().trim();
    usersMap[normalizedEmail] = user;

    const newToken = await new SignJWT({ users: usersMap })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("365d")
      .sign(JWT_SECRET);

    cookieStore.set(USERS_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  } catch (err) {
    console.warn("Failed to save registered user cookie:", err);
  }
}

export async function getIpQuotaFromCookie(): Promise<number> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(IP_QUOTA_COOKIE)?.value;
    if (!token) return 0;
    const verified = await verifySessionToken(token);
    if (verified && typeof verified.count === "number") {
      return verified.count;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function incrementIpQuotaCookie(): Promise<number> {
  try {
    const current = await getIpQuotaFromCookie();
    const newCount = current + 1;
    const cookieStore = await cookies();
    const newToken = await new SignJWT({ count: newCount })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("365d")
      .sign(JWT_SECRET);

    cookieStore.set(IP_QUOTA_COOKIE, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
    return newCount;
  } catch {
    return 1;
  }
}


/** Kept for callers elsewhere in the app; now backed by the store that actually works. */
export async function safeKvGet(key: string): Promise<number> {
  return await storeQuotaGet(key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * Kept for callers elsewhere in the app.
 *
 * Counters are incremented rather than overwritten now. Read-then-write loses count whenever two
 * requests overlap, which for a usage limit means undercounting exactly when someone is using the
 * service hardest.
 */
export async function safeKvSet(key: string, _value: number, opts?: { ex?: number }) {
  await quotaIncrement(key, opts?.ex);
}
