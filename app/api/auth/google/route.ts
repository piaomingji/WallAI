import { NextRequest, NextResponse } from "next/server";
import {
  getUserByEmail,
  saveUser,
  createSessionToken,
  setSessionCookie,
  saveRegisteredUserToCookie,
  getIpQuotaFromCookie,
} from "@/lib/auth";
import { verifyGoogleCredential } from "@/lib/googleToken";
import { GOOGLE_CLIENT_ID } from "@/lib/googleClient";
import { quotaGet, IP_QUOTA_KEY, GOOGLE_QUOTA_KEY, FREE_TOTAL_CREDITS } from "@/lib/quota";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { credential, guestQuotaRemaining } = await req.json();

    if (!credential) {
      return NextResponse.json({ error: "Google認証情報が見つかりません。" }, { status: 400 });
    }

    // Verified, not merely decoded. See lib/googleToken.ts.
    const identity = await verifyGoogleCredential(
      credential,
      GOOGLE_CLIENT_ID
    );
    if (!identity) {
      return NextResponse.json({ error: "Googleアカウントの確認に失敗しました。" }, { status: 401 });
    }

    const email = identity.email;
    let user = await getUserByEmail(email);

    if (!user) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1";

      // How much this device has already used, whichever record has seen more.
      //
      // The Google-account counter is what stops the obvious workaround: use up the free credits,
      // sign in with a second address, and start again. It is keyed to Google's stable account id
      // rather than the email, so changing the address on the account does not reset it either.
      const [ipCount, googleCount] = await Promise.all([
        quotaGet(IP_QUOTA_KEY(ip)),
        quotaGet(GOOGLE_QUOTA_KEY(identity.sub)),
      ]);
      const cookieCount = await getIpQuotaFromCookie();
      const alreadyUsed = Math.max(ipCount, cookieCount, googleCount);

      const requested =
        typeof guestQuotaRemaining === "number"
          ? Math.max(0, guestQuotaRemaining) + 5
          : FREE_TOTAL_CREDITS;

      const initialCredits = Math.max(0, Math.min(FREE_TOTAL_CREDITS - alreadyUsed, requested));

      const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      user = {
        id: userId,
        email,
        name: identity.name || email.split("@")[0],
        avatarUrl: identity.picture,
        plan: "free",
        credits: initialCredits,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveUser(user);
      console.log(
        `New account ${email}: ${initialCredits} credits (already used on this device/account: ${alreadyUsed})`
      );
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
