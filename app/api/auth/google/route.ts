import { safeKvGet, getIpQuotaFromCookie } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
import {
  getUserByEmail,
  saveUser,
  createSessionToken,
  setSessionCookie,
  saveRegisteredUserToCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { credential, guestQuotaRemaining } = await req.json();

    if (!credential) {
      return NextResponse.json({ error: "Google認証情報が見つかりません。" }, { status: 400 });
    }

    const payload = decodeJwt(credential) as {
      email?: string;
      name?: string;
      sub?: string;
      picture?: string;
    };

    if (!payload || !payload.email) {
      return NextResponse.json({ error: "無効なGoogleアカウント情報です。" }, { status: 400 });
    }

    const email = payload.email.toLowerCase().trim();
    let user = await getUserByEmail(email);

    if (!user) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
      const ipKey = `wall_ai:ip:${ip}`;
      const currentIpCount = await safeKvGet(ipKey);
      const ipQuotaCount = await getIpQuotaFromCookie();
      const effectiveIpCount = Math.max(currentIpCount, ipQuotaCount);

      const initialCredits = Math.max(0, Math.min(10 - effectiveIpCount, typeof guestQuotaRemaining === "number" ? Math.max(0, guestQuotaRemaining) + 5 : 10));

      const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      user = {
        id: userId,
        email,
        name: payload.name || email.split("@")[0],
        avatarUrl: payload.picture,
        plan: "free",
        credits: initialCredits,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveUser(user);
    }

    const token = await createSessionToken(user);
    await setSessionCookie(token);
    await saveRegisteredUserToCookie(user);

    return NextResponse.json({ user, success: true });
  } catch (e) {
    console.error("Google Auth error:", e);
    return NextResponse.json({ error: "Google認証処理中にエラーが発生しました。" }, { status: 500 });
  }
}
