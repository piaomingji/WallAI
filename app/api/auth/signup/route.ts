import { NextRequest, NextResponse } from "next/server";
import {
  getUserByEmail,
  hashPassword,
  saveUser,
  createSessionToken,
  setSessionCookie,
  type UserProfile,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "有効なメールアドレスを入力してください。" }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "パスワードは6文字以上で入力してください。" }, { status: 400 });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ error: "このメールアドレスは既に登録されています。" }, { status: 400 });
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = await hashPassword(password);

    const newUser: UserProfile = {
      id: userId,
      email: email.trim().toLowerCase(),
      name: name?.trim() || email.split("@")[0],
      plan: "free",
      credits: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveUser(newUser, passwordHash);

    const token = await createSessionToken(newUser);
    await setSessionCookie(token);

    return NextResponse.json({ user: newUser, success: true });
  } catch (e) {
    console.error("Signup error:", e);
    return NextResponse.json({ error: "新規登録処理中にエラーが発生しました。" }, { status: 500 });
  }
}
