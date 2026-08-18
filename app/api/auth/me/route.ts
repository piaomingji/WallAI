import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user: user || null });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
