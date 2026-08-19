import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserById, saveUser, addUserCredits } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Where a payment actually becomes an entitlement.
 *
 * Until now nothing on the server learned that anyone had paid. Checkout sent the person to a
 * success page, and that page -- in the browser, from a query string -- wrote "pro" into local
 * storage. Two things followed. Someone who paid got nothing the server recognised, so once their
 * free allowance ran out they were refused despite having paid; and someone who simply opened
 * /checkout-success?plan=pro was shown as a paying customer without paying.
 *
 * Stripe is the only party that knows whether money moved, so it has to be Stripe that tells us,
 * over a channel the browser cannot forge. That is what this is: Stripe signs each notification
 * with a shared secret, the signature is checked here, and only then is the account changed.
 */

/** What each plan grants. Kept here so the webhook, not the browser, decides. */
const GRANTS: Record<string, { credits: number; plan?: "free" | "pro" | "unlimited" }> = {
  quota: { credits: 20 },
  pro: { credits: 100, plan: "pro" },
  business: { credits: 500, plan: "pro" },
};

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!secret || !stripeKey) {
    // Loud, because silence here means paying customers quietly get nothing.
    console.error(
      "PAYMENTS NOT RECORDED: STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY is missing, so completed " +
        "purchases cannot be applied to accounts."
    );
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  // The raw body, byte for byte. Parsing it first would change it and the signature would not match.
  const payload = await req.text();

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    // An unverified notification is not a payment. Anyone can post to this address.
    console.error("Rejected a webhook whose signature did not verify:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Stripe reports this as "paid" for one-off purchases and for the first subscription
        // invoice. Anything else -- an abandoned or failed session -- grants nothing.
        if (session.payment_status !== "paid") break;

        const userId = session.client_reference_id;
        if (!userId) {
          console.error("Paid session with no client_reference_id; cannot tell whose account this is.");
          break;
        }

        const planId = (session.metadata?.planId as string) || inferPlan(session);
        const grant = GRANTS[planId];
        if (!grant) {
          console.error(`Paid session for an unknown plan "${planId}"; nothing granted.`);
          break;
        }

        const updated = await addUserCredits(userId, grant.credits, grant.plan);
        if (!updated) {
          console.error(`Paid session for ${userId}, but that account could not be found.`);
          break;
        }

        // Mark the account as having paid, which lifts the device-level free cap, and remember
        // which subscription belongs to whom so a later cancellation can be applied.
        updated.hasPurchased = true;
        if (typeof session.subscription === "string") {
          updated.stripeSubscriptionId = session.subscription;
        }
        await saveUser(updated);

        console.log(`Applied ${planId} to ${userId}: +${grant.credits} credits.`);
        break;
      }

      // A subscription that has ended -- cancelled, or unpaid for long enough that Stripe gave up.
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = (subscription.metadata?.userId as string) || null;
        if (!userId) break;

        const user = await getUserById(userId);
        if (!user) break;

        // Credits already bought are theirs to keep; only the plan reverts.
        user.plan = "free";
        user.updatedAt = new Date().toISOString();
        await saveUser(user);
        console.log(`Subscription ended for ${userId}; plan back to free.`);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Answer 500 so Stripe retries rather than assuming this was handled.
    console.error("Failed to apply a verified webhook:", err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Falls back to the amount when metadata is absent, for sessions created before it was set. */
function inferPlan(session: Stripe.Checkout.Session): string {
  if (session.mode === "subscription") return "pro";
  return "quota";
}
