import { NextResponse } from "next/server";
import { getCurrentUser, saveUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Auto-migrate newly signed-up accounts from 3/5 to 10 credits
    if (user.plan === "free" && (user.credits === 3 || user.credits === 5)) {
      user.credits = 10;
      user.updatedAt = new Date().toISOString();
      await saveUser(user);
    }

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
