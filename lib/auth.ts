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
    return await getUserById(userId);
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
      userId = await kv.get<string>(`wall-ai:user-email:${normalizedEmail}`);
    } else {
      userId = memoryUserByEmail.get(normalizedEmail) || null;
    }

    if (!userId) return null;
    return await getUserById(userId);
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

export async function deductUserCredit(userId: string): Promise<{ success: boolean; remainingCredits: number }> {
  const user = await getUserById(userId);
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
