import { NextResponse } from "next/server";
import { quotaStoreReady, storeSetString, storeGetString } from "@/lib/quotaStore";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A read-only look at whether the store is actually working.
 *
 * Every helper that talks to Redis swallows its own errors and returns a harmless-looking zero or
 * null, which is right for serving traffic and useless for working out why a limit will not stick.
 * This writes one throwaway key, reads it back, and reports what the session resolves to.
 *
 * It reveals nothing sensitive: no connection string, no token, no other account's data -- only
 * whether this deployment can reach its own database, and what it believes about the person asking.
 */
export async function GET() {
  const ready = await quotaStoreReady();

  const probeKey = "wall_ai:debug:probe";
  const written = await storeSetString(probeKey, String(Date.now()));
  const readBack = await storeGetString(probeKey);

  const user = await getCurrentUser();

  return NextResponse.json({
    redis: {
      urlConfigured: !!(process.env.KV_REDIS_URL || process.env.REDIS_URL),
      connects: ready,
      canWrite: written,
      canReadBack: readBack !== null,
    },
    jwtSecretConfigured: !!process.env.JWT_SECRET,
    session: user
      ? { signedIn: true, credits: user.credits, plan: user.plan, id: user.id }
      : { signedIn: false },
  });
}
