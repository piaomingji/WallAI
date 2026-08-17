import { NextRequest, NextResponse } from "next/server";
import {
  getUserByEmail,
  verifyUserPassword,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "メールアドレスとパスワードを入力してください。" }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません。" }, { status: 401 });
    }

    const isValid = await verifyUserPassword(user.id, password);
    if (!isValid) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません。" }, { status: 401 });
    }

    const token = await createSessionToken(user);
    await setSessionCookie(token);

    return NextResponse.json({ user, success: true });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "ログイン処理中にエラーが発生しました。" }, { status: 500 });
  }
}
