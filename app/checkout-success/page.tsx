/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Reveal from '@/components/Reveal';

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // The plan is granted by Stripe's webhook, on the server. This page only waits for that to
    // land and then asks the server what the account looks like now.
    //
    // It used to write the plan into local storage straight from the query string, which meant two
    // things at once: opening this address without paying made the browser believe it had a paid
    // plan, and actually paying changed nothing the server knew about -- so a real customer was
    // refused as soon as their free allowance ran out. The browser is not a place to record a
    // purchase.
    const plan = searchParams.get('plan');
    setPlanName(
      plan === 'pro'
        ? 'Proプラン (月額サブスクリプション)'
        : plan === 'business'
        ? '法人プラン (月額サブスクリプション)'
        : plan === 'quota'
        ? '生成枠 20回追加パック'
        : 'ご購入'
    );

    let cancelled = false;

    // Stripe's notification usually arrives within a second or two, but it is not instant and it is
    // not ordered relative to this redirect. Rather than show a stale balance, ask a few times.
    const check = async (attempt: number) => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await res.json();
        if (data?.user && data.user.plan !== 'free') {
          if (!cancelled) {
            window.dispatchEvent(new Event('wallai:plan_updated'));
            setLoading(false);
          }
          return;
        }
        if (data?.user && plan === 'quota' && attempt > 0) {
          // A credit pack leaves the plan as free, so there is nothing to compare; one round trip
          // is enough to pick up the new balance.
          if (!cancelled) {
            window.dispatchEvent(new Event('wallai:plan_updated'));
            setLoading(false);
          }
          return;
        }
      } catch {}

      if (attempt >= 5) {
        // Still nothing. The payment is safe with Stripe and will be applied when its notification
        // arrives; saying so is better than showing a balance that has not moved.
        if (!cancelled) {
          setPending(true);
          setLoading(false);
        }
        return;
      }
      setTimeout(() => check(attempt + 1), 1500);
    };

    check(0);
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-md bg-paper border border-line rounded-3xl p-8 md:p-10 shadow-lift animate-fade-in text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-clay-soft text-clay mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h1 className="font-display text-2xl font-bold text-ink">
        ご購入ありがとうございます！
      </h1>

      <p className="mt-3 text-sm text-ink-soft leading-relaxed">
        {pending
          ? '決済は完了しています。アカウントへの反映に少し時間がかかっています。数分後にページを再読み込みしてください。反映されない場合はお問い合わせください。'
          : '決済手続きが正常に完了し、アカウントに反映されました。'}
      </p>

      {!loading && (
        <div className="mt-6 rounded-2xl bg-paper-raised border border-line p-4 text-xs font-semibold text-clay-deep">
          選択されたプラン: {planName}
        </div>
      )}

      <button
        onClick={() => {
          router.replace('/#studio');
          // ストレージ再読み込みを促す
          window.location.href = '/#studio';
        }}
        className="mt-8 w-full cursor-pointer rounded-full bg-ink py-4 text-sm font-bold text-paper shadow-lift hover:bg-clay active:scale-95 transition-all duration-200"
      >
        スタジオに戻って作成する
      </button>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-paper-raised px-6 py-12">
      {/* 背景のグロー効果 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[840px] -translate-x-1/2 rounded-full bg-clay-soft opacity-40 blur-3xl"
      />
      
      <Reveal>
        <Suspense fallback={
          <div className="text-center font-semibold text-ink-soft">
            読み込み中...
          </div>
        }>
          <CheckoutSuccessContent />
        </Suspense>
      </Reveal>
    </main>
  );
}
