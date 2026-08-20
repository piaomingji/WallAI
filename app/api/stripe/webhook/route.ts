import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getUserById,
  saveUser,
  addUserCredits,
  linkStripeCustomer,
  getUserByStripeCustomerId,
} from "@/lib/auth";

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

        // 顧客IDを控えておく。「お支払い・解約」画面を開くときと、返金の通知から
        // 「これは誰の支払いか」を引くときに、これが唯一の手掛かりになる。
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (customerId) {
          updated.stripeCustomerId = customerId;
          await linkStripeCustomer(customerId, userId);
        }

        await saveUser(updated);

        console.log(`Applied ${planId} to ${userId}: +${grant.credits} credits.`);
        break;
      }

      // A subscription that has ended -- cancelled, or unpaid for long enough that Stripe gave up.
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const user = await findUserFor(stripe, {
          userId: (subscription.metadata?.userId as string) || null,
          customer: subscription.customer,
        });
        if (!user) {
          console.error("A subscription ended but could not be matched to an account.");
          break;
        }

        // Credits already bought are theirs to keep; only the plan reverts.
        user.plan = "free";
        user.updatedAt = new Date().toISOString();
        await saveUser(user);
        console.log(`Subscription ended for ${user.id}; plan back to free.`);
        break;
      }

      /**
       * 契約の状態が変わったとき。
       *
       * 「請求期間の終わりに解約」を選ばれた場合、期間中に届くのはこの通知で、deleted ではない。
       * カードの期限切れで支払いが止まったときも同じ。これまでは購読しているのに無視していたので、
       * Stripeが「もう使えない」と見なした後もProのままになる余地があった。
       */
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const user = await findUserFor(stripe, {
          userId: (subscription.metadata?.userId as string) || null,
          customer: subscription.customer,
        });
        if (!user) break;

        // Stripeが有効と見なす状態だけがPro。それ以外は無料に戻す。
        const inGoodStanding =
          subscription.status === "active" || subscription.status === "trialing";
        const nextPlan = inGoodStanding ? "pro" : "free";
        if (user.plan !== nextPlan) {
          user.plan = nextPlan;
          user.updatedAt = new Date().toISOString();
          await saveUser(user);
          console.log(
            `Subscription for ${user.id} is now "${subscription.status}"; plan set to ${nextPlan}.`
          );
        }
        break;
      }

      /**
       * 返金。
       *
       * これまでは何も起きなかった。返金を受けた人がProのまま使い続けられ、しかも契約が
       * 生きているので翌月また請求されていた。ここで権利を戻し、契約も止める。
       */
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;

        // 一部返金は「何を返したのか」が判断できないので、自動では戻さない。
        if (!charge.refunded) {
          console.log("Partial refund; entitlements left untouched for a human to decide.");
          break;
        }

        const user = await findUserFor(stripe, {
          customer: charge.customer,
          paymentIntent: charge.payment_intent,
        });
        if (!user) {
          console.error("A refund could not be matched to an account; nothing was reverted.");
          break;
        }

        // 返金の通知には planId が載らないので、金額から逆に引く。
        const grant = GRANTS[planFromAmount(charge.amount)];
        if (grant) {
          user.credits = Math.max(0, user.credits - grant.credits);
          if (grant.plan) user.plan = "free";
        }

        // 定期課金を返金したなら契約も止める。放置すると翌月また請求されてしまう。
        if (user.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(user.stripeSubscriptionId);
            user.plan = "free";
          } catch (err) {
            console.warn("The subscription was already gone, or could not be cancelled:", err);
          }
        }

        user.updatedAt = new Date().toISOString();
        await saveUser(user);
        console.log(`Refund applied to ${user.id}: plan ${user.plan}, credits ${user.credits}.`);
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

/** 返金の通知には planId が載らないため、金額から逆に引く。 */
function planFromAmount(amount: number | null): string {
  if (amount === 19800) return "business";
  if (amount === 4980) return "pro";
  if (amount === 1480) return "quota";
  return "";
}

/**
 * 通知に載っている手掛かりから、その支払いの持ち主を探す。
 *
 * 手掛かりは通知の種類によって違う。こちらが付けた userId があればそれが一番確実で、
 * 無ければ顧客ID、それも無ければ（一回払いでは顧客が作られないことがある）決済セッションを
 * 引き当てて `client_reference_id` を見る。
 */
async function findUserFor(
  stripe: Stripe,
  hints: {
    userId?: string | null;
    customer?: string | { id: string } | null;
    paymentIntent?: string | { id: string } | null;
  }
) {
  if (hints.userId) {
    const byId = await getUserById(hints.userId);
    if (byId) return byId;
  }

  const customerId = typeof hints.customer === "string" ? hints.customer : hints.customer?.id;
  if (customerId) {
    const byCustomer = await getUserByStripeCustomerId(customerId);
    if (byCustomer) return byCustomer;
  }

  const paymentIntentId =
    typeof hints.paymentIntent === "string" ? hints.paymentIntent : hints.paymentIntent?.id;
  if (paymentIntentId) {
    try {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      const reference = sessions.data[0]?.client_reference_id;
      if (reference) {
        const bySession = await getUserById(reference);
        if (bySession) return bySession;
      }
    } catch (err) {
      console.error("Could not trace a payment back to an account:", err);
    }
  }

  return null;
}

/** Falls back to the amount when metadata is absent, for sessions created before it was set. */
function inferPlan(session: Stripe.Checkout.Session): string {
  if (session.mode === "subscription") return "pro";
  return "quota";
}
