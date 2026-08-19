import { quotaGet as read, quotaIncrement } from "@/lib/quotaStore";

/**
 * Free-usage accounting, in one place.
 *
 * The counters were previously written with two different key spellings -- `wall_ai:ip:` in one
 * file and `reroom-ai:ip:` in another -- so the same person was counted twice over, in two places
 * that never saw each other. Building the keys here means that cannot drift again.
 */
export const FREE_TOTAL_CREDITS = Number(process.env.FREE_TOTAL_CREDITS || 10);
export const FREE_GUEST_CREDITS = Number(process.env.FREE_GUEST_CREDITS || 5);

/** Counters last this long. Long enough that the free tier is not simply renewed by waiting. */
export const QUOTA_TTL_SECONDS = 60 * 60 * 24 * 365;

export const IP_QUOTA_KEY = (ip: string) => `wall_ai:ip:${ip.replace(/[^a-z0-9.:]/gi, "")}`;
export const GOOGLE_QUOTA_KEY = (sub: string) => `wall_ai:google:${sub.replace(/[^a-z0-9]/gi, "")}`;

export const quotaGet = read;

/** Records one use against both the connection and, when signed in, the account. */
export async function recordUse(ip: string, googleSub?: string): Promise<void> {
  await Promise.all([
    quotaIncrement(IP_QUOTA_KEY(ip), QUOTA_TTL_SECONDS),
    googleSub ? quotaIncrement(GOOGLE_QUOTA_KEY(googleSub), QUOTA_TTL_SECONDS) : Promise.resolve(0),
  ]);
}
