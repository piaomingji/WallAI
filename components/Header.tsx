'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Header() {
  const [userPlan, setUserPlan] = useState<string>('free');
  const [quotaRemaining, setQuotaRemaining] = useState<number>(5);

  const updateStatus = () => {
    if (typeof window !== 'undefined') {
      try {
        const plan = localStorage.getItem('wallai_user_plan') || 'free';
        const quota = Number(localStorage.getItem('wallai_free_generations') || '5');
        setUserPlan(plan);
        setQuotaRemaining(quota);
      } catch (e) {
        console.warn('localStorage read blocked in Header:', e);
        setUserPlan('free');
        setQuotaRemaining(5);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('reset') === 'true') {
        localStorage.clear();
        window.location.href = window.location.origin + window.location.pathname;
        return;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateStatus();

    window.addEventListener('storage', updateStatus);
    window.addEventListener('wallai:plan_updated', updateStatus);
    return () => {
      window.removeEventListener('storage', updateStatus);
      window.removeEventListener('wallai:plan_updated', updateStatus);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2.5">
          <Link href="/" className="font-display text-base sm:text-xl font-bold tracking-tight text-ink hover:text-clay transition-colors">
            🏠 WallAI
          </Link>
          <div className="flex items-center gap-1 select-none">
            {userPlan === 'pro' ? (
              <span className="rounded-full bg-clay text-paper px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider animate-pulse">
                PRO会員
              </span>
            ) : userPlan === 'quota' ? (
              <span className="rounded-full bg-ink text-paper px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">
                残 {quotaRemaining}回
              </span>
            ) : (
              <span className="rounded-full bg-sand px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold text-ink-soft">
                体験残 {quotaRemaining}回
              </span>
            )}
          </div>
        </div>

        <nav className="flex items-center gap-2 sm:gap-6 text-xs sm:text-sm font-medium text-ink-soft">
          <Link href="/#pricing" className="hidden transition-colors hover:text-ink sm:block">
            料金プラン
          </Link>
          <Link href="/#how-it-works" className="hidden transition-colors hover:text-ink sm:block">
            ご利用方法
          </Link>
          <Link
            href="/#studio"
            className="rounded-full bg-ink px-2.5 py-1.5 sm:px-5 sm:py-2 text-[10px] sm:text-sm font-semibold text-paper transition-all duration-200 hover:bg-clay active:scale-95 whitespace-nowrap"
          >
            カラーシミュレーター
          </Link>
        </nav>
      </div>
    </header>
  );
}
