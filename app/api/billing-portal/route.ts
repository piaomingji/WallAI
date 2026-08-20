import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getCurrentUser, saveUser, linkStripeCustomer } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * 「お支払い・解約」の入口。
 *
 * 特商法のページには「マイページ/設定より解約手続きを行うことができ」と書いてあるのに、
 * その導線がどこにも無かった。利用者は自分で契約を止められず、こちらに連絡するしか
 * なかったということになる。ここでStripeのカスタマーポータルを開き、解約・支払い方法の
 * 変更・領収書の確認を本人の手で完結できるようにする。
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "ログインが必要です。", requiresAuth: true },
      { status: 401 }
    );
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey === "your_stripe_secret_key_here") {
    console.error("STRIPE_SECRET_KEY is not configured; the billing portal cannot open.");
    return NextResponse.json(
      { error: "お支払い画面を開けませんでした。時間をおいてお試しください。" },
      { status: 503 }
    );
  }

  const stripe = new Stripe(stripeKey);

  try {
    let customerId = user.stripeCustomerId;

    // 顧客IDを控え始めたのは今回から。それ以前に購入した人には控えが無いので、
    // 同じメールアドレスの顧客を探し、見つかればここで結び付けておく。
    if (!customerId) {
      const found = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = found.data[0]?.id;
      if (customerId) {
        user.stripeCustomerId = customerId;
        user.updatedAt = new Date().toISOString();
        await saveUser(user);
        await linkStripeCustomer(customerId, user.id);
      }
    }

    if (!customerId) {
      // 追加パックだけを買った人には、顧客が作られていないことがある（一回払いはStripeが
      // 顧客を作らないため）。解約するものが無いだけなので、失敗したように見せない。
      return NextResponse.json(
        {
          error:
            "ご契約中の月額プランはありません。追加パックのご購入分は、そのままご利用いただけます。",
        },
        { status: 404 }
      );
    }

    const origin = req.headers.get("origin") || new URL(req.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: origin,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    // 詳細はログへ。Stripeの文言は設定の中身に触れることがあり、利用者には対処できない。
    console.error("Billing portal error:", error);
    return NextResponse.json(
      { error: "お支払い画面を開けませんでした。時間をおいてお試しください。" },
      { status: 500 }
    );
  }
}
