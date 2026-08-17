import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
import {
  getUserByEmail,
  saveUser,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { credential } = await req.json();

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
      const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      user = {
        id: userId,
        email,
        name: payload.name || email.split("@")[0],
        avatarUrl: payload.picture,
        plan: "free",
        credits: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveUser(user);
    }

    const token = await createSessionToken(user);
    await setSessionCookie(token);

    return NextResponse.json({ user, success: true });
  } catch (e) {
    console.error("Google Auth error:", e);
    return NextResponse.json({ error: "Google認証処理中にエラーが発生しました。" }, { status: 500 });
  }
}
