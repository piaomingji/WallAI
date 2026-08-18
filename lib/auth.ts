import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createClient } from "@vercel/kv";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "wall_ai_jwt_secret_key_2026_super_secure_67890"
);

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

const kv = createClient({
  url: process.env.KV_REST_API_URL || process.env.REDIS_REST_API_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.REDIS_REST_API_TOKEN || "",
});

const memoryUserDb = new Map<string, { user: UserProfile; passwordHash: string }>();
const memoryUserByEmail = new Map<string, string>();

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
  try {
    if (process.env.KV_REST_API_URL || process.env.REDIS_REST_API_URL) {
      await kv.set(`wall-ai:user:${user.id}`, user);
      await kv.set(`wall-ai:user-email:${user.email.toLowerCase()}`, user.id);
      if (passwordHash) {
        await kv.set(`wall-ai:user-auth:${user.id}`, passwordHash);
      }
    } else {
      memoryUserDb.set(user.id, { user, passwordHash: passwordHash || "" });
      memoryUserByEmail.set(user.email.toLowerCase(), user.id);
    }
  } catch (err) {
    console.warn("Failed to save user to KV, saved to memory:", err);
    memoryUserDb.set(user.id, { user, passwordHash: passwordHash || "" });
    memoryUserByEmail.set(user.email.toLowerCase(), user.id);
  }
  await saveRegisteredUserToCookie(user);
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
  try {
    if (process.env.KV_REST_API_URL || process.env.REDIS_REST_API_URL) {
      const user = await kv.get<UserProfile>(`wall-ai:user:${userId}`);
      if (user) return user;
    }
    const record = memoryUserDb.get(userId);
    return record ? record.user : null;
  } catch {
    const record = memoryUserDb.get(userId);
    return record ? record.user : null;
  }
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    let userId: string | null = null;

    if (process.env.KV_REST_API_URL || process.env.REDIS_REST_API_URL) {
      userId = await kv.get<string>(`wallai:user-email:${normalizedEmail}`);
    } else {
      userId = memoryUserByEmail.get(normalizedEmail) || null;
    }

    if (userId) {
      const user = await getUserById(userId);
      if (user) return user;
    }

    return await getRegisteredUserFromCookie(normalizedEmail);
  } catch {
    return null;
  }
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  try {
    const inputHash = await hashPassword(password);
    let storedHash: string | null = null;

    if (process.env.KV_REST_API_URL || process.env.REDIS_REST_API_URL) {
      storedHash = await kv.get<string>(`wall-ai:user-auth:${userId}`);
    } else {
      const record = memoryUserDb.get(userId);
      storedHash = record ? record.passwordHash : null;
    }

    return storedHash === inputHash;
  } catch {
    return false;
  }
}

export async function deductUserCredit(userId?: string): Promise<{ success: boolean; remainingCredits: number }> {
  const user = await getCurrentUser();
  if (userId && !user) console.log(userId);
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
