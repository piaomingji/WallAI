import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Sanitize headers to prevent ByteString conversion crashes in any outgoing runtime fetch calls
    try {
      const keys = Array.from(req.headers.keys());
      for (const key of keys) {
        const val = req.headers.get(key) || '';
        let hasNonAscii = false;
        for (let i = 0; i < val.length; i++) {
          if (val.charCodeAt(i) > 255) {
            hasNonAscii = true;
            break;
          }
        }
        if (hasNonAscii) {
          req.headers.set(key, encodeURIComponent(val));
        }
      }
    } catch (e) {
      console.error('Error sanitizing headers:', e);
    }

    const { planId } = await req.json();
    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const stripeKey = process.env.STRIPE_SECRET_KEY;

    // Stripe Secret Key 가 설정되지 않은 경우 모크(시뮬레이션) 결제로 우회
    if (!stripeKey || stripeKey === 'your_stripe_secret_key_here') {
      console.warn('STRIPE_SECRET_KEY is not configured. Running in Mock Mode.');
      return NextResponse.json({
        url: `${origin}/checkout-success?mock=true&plan=${planId}`,
      });
    }

    const stripe = new Stripe(stripeKey);

    let session;

    if (planId === 'pro') {
      // Pro Plan: Monthly Subscription
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              product_data: {
                name: 'WallAI Proプラン (月額サブスク)',
                description: '外壁塗装シミュレーション完成予想図の生成数無制限、優先高速処理',
              },
              unit_amount: 4980,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}&plan=pro`,
        cancel_url: `${origin}/#pricing`,
      });
    } else if (planId === 'business') {
      // Business Plan: Monthly Subscription (5 users, 500 generations/day)
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              product_data: {
                name: 'WallAI 法人プラン (月額サブスク)',
                description: '最大5名まで共有利用可能、1日の合計生成上限500回',
              },
              unit_amount: 19800,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}&plan=business`,
        cancel_url: `${origin}/#pricing`,
      });
    } else if (planId === 'quota') {
      // Quota Pack: One-time payment (20 generations)
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              product_data: {
                name: 'WallAI 20回生成追加パック',
                description: '単発で利用枠を20回分追加します',
              },
              unit_amount: 1480,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}&plan=quota`,
        cancel_url: `${origin}/#pricing`,
      });
    } else {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
    }

    return NextResponse.json({ url: session.url });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Stripe Checkout Session Error:', error);
    let errMsg = 'Unknown Server Error';
    if (error) {
      if (typeof error === 'string') {
        errMsg = error;
      } else {
        errMsg = error.message || error.raw?.message || JSON.stringify(error);
      }
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
