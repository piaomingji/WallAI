import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getCurrentUser, addUserCredits } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "決済をご利用いただくにはログインが必要です。", requiresAuth: true },
        { status: 401 }
      );
    }

    const { planId } = await req.json();
    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey || stripeKey === 'your_stripe_secret_key_here') {
      console.warn('STRIPE_SECRET_KEY is not configured. Running in Mock Mode.');
      if (planId === 'quota') {
        await addUserCredits(user.id, 20);
      } else if (planId === 'pro' || planId === 'business') {
        await addUserCredits(user.id, 100, 'pro');
      }
      return NextResponse.json({
        url: `${origin}/checkout-success?mock=true&plan=${planId}`,
      });
    }

    const stripe = new Stripe(stripeKey);

    let session;

    if (planId === 'pro') {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        client_reference_id: user.id,
        customer_email: user.email,
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
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        client_reference_id: user.id,
        customer_email: user.email,
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
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        client_reference_id: user.id,
        customer_email: user.email,
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
