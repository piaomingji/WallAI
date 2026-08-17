'use client';

import Link from 'next/link';
import { UserNav } from './UserNav';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      {/* 姉妹サービス紹介バナー */}
      <div className="bg-sand/30 border-b border-line py-1.5 text-center text-[10px] sm:text-xs">
        <span className="font-semibold text-ink-soft">姉妹サービス: </span>
        <a 
          href="https://reroom.smart-ai-portal.com"
          className="font-bold text-ink hover:text-clay inline-flex items-center gap-0.5 transition-colors underline decoration-dotted"
        >
          お部屋の内装リフォーム・インテリアAI「ミセルリフォーム」はこちら 🎨 ➔
        </a>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-85">
            <img src="/wall_ai_logo.png" alt="WallAI Logo" className="h-7 sm:h-9 w-auto object-contain" />
            <span className="font-display text-base sm:text-lg font-bold tracking-tight text-ink">
              WallAI
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-ink-soft">
          <Link href="/#pricing" className="hidden transition-colors hover:text-ink sm:block">
            料金プラン
          </Link>
          <UserNav />
          <Link
            href="/#studio"
            className="rounded-full bg-ink px-3 py-1.5 sm:px-5 sm:py-2 text-[10px] sm:text-sm font-semibold text-paper transition-all duration-200 hover:bg-clay active:scale-95 whitespace-nowrap hidden sm:inline-block"
          >
            カラーシミュレーター
          </Link>
        </nav>
      </div>
    </header>
  );
}
