import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, saveUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A one-off repair for accounts that paid before purchases were recorded.
 *
 * The device-level cap is skipped for anyone who has bought something, but the flag that says so
 * was only added after these purchases went through -- so whoever tested the payment flow is left
 * holding credits they cannot spend. This marks the signed-in account as having paid.
 *
 * It grants no credits: it only lifts a cap for an account that already has a balance, and only for
 * whoever is signed in, and only with a token that is not in the source. It is meant to be opened
 * once in a browser and then deleted along with REPAIR_TOKEN.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.REPAIR_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "not enabled" }, { status: 404 });
  }

  if (req.nextUrl.searchParams.get("token") !== expected) {
    return NextResponse.json({ error: "no" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "このブラウザでログインしてから開いてください。" }, { status: 401 });
  }

  user.hasPurchased = true;
  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  return NextResponse.json({ ok: true, email: user.email, credits: user.credits });
}
