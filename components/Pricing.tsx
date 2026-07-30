'use client';

import { useState } from 'react';
import Reveal from './Reveal';

type PlanCardProps = {
  title: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  onClick: () => void;
  isLoading?: boolean;
};

function PlanCard({
  title,
  price,
  period,
  description,
  features,
  buttonText,
  isPopular,
  onClick,
  isLoading,
}: PlanCardProps) {
  return (
    <div
      className={`w-full relative flex flex-col rounded-3xl border p-6 sm:p-8 transition-all duration-300 ${
        isPopular
          ? 'border-clay bg-paper shadow-lift lg:scale-105 lg:z-10'
          : 'border-line bg-paper hover:border-line-strong lg:hover:-translate-y-1'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-clay px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-paper">
          Most Popular
        </span>
      )}
      <div className="mb-6 text-center">
        <h3 className="font-display text-xl font-bold text-ink">{title}</h3>
        <p className="mt-2 text-xs text-ink-soft min-h-[32px]">{description}</p>
        <div className="mt-5 flex items-baseline justify-center gap-1 text-ink">
          <span className="text-3xl font-bold tracking-tight">{price}</span>
          {period && <span className="text-xs text-ink-faint"> / {period}</span>}
        </div>
      </div>

      <ul className="mb-8 flex flex-col gap-3.5 border-t border-line pt-6 text-xs text-ink-soft items-center">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="text-clay flex-shrink-0"
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onClick}
        disabled={isLoading}
        className={`mt-auto cursor-pointer rounded-full py-3.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
          isPopular
            ? 'bg-ink text-paper hover:bg-clay'
            : 'border border-line-strong bg-paper-raised text-ink hover:border-ink'
        } ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        {isLoading ? '処理中...' : buttonText}
      </button>
    </div>
  );
}

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCheckout = async (planId: 'quota' | 'pro' | 'business') => {
    setLoadingPlan(planId);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();
      if (!res.ok) {
        let errMsg = '決済URLの取得に失敗しました。';
        if (data && data.error) {
          if (typeof data.error === 'string') {
            errMsg = data.error;
          } else if (typeof data.error === 'object') {
            errMsg = data.error.message || JSON.stringify(data.error);
          }
        }
        throw new Error(errMsg);
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('決済URLが見つかりませんでした。');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'セッション作成中にエラーが発生しました。もう一度お試しください。'
      );
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="w-full border-t border-line bg-paper-raised scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-clay">
              PRICING PLANS
            </p>
            <h2 className="font-display mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-ink md:text-4xl">
              シンプルな料金プラン
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-ink-soft">
              ご利用シーンに合わせた柔軟なプランをご用意しています。Stripe決済を導入しており、安全に購入可能です。
            </p>
          </div>
        </Reveal>

        {errorMsg && (
          <Reveal delay={50} className="mt-8 mx-auto max-w-md">
            <div className="rounded-xl border border-clay/30 bg-clay-soft p-4 text-xs text-clay-deep text-center leading-relaxed">
              {errorMsg}
            </div>
          </Reveal>
        )}

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto items-stretch">
          {/* フリープラン */}
          <Reveal delay={100} className="w-full flex">
            <div className="w-full flex flex-col rounded-3xl border border-line bg-paper p-6 sm:p-8">
              <div className="mb-6 text-center">
                <h3 className="font-display text-xl font-bold text-ink">フリープラン</h3>
                <p className="mt-2 text-xs text-ink-soft min-h-[32px]">まずは機能をお試ししたい方に</p>
                <div className="mt-5 flex items-baseline justify-center gap-1 text-ink">
                  <span className="text-3xl font-bold tracking-tight">¥0</span>
                </div>
              </div>
              <ul className="mb-8 flex flex-col gap-3.5 border-t border-line pt-6 text-xs text-ink-soft items-center">
                <li className="flex items-center gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-clay flex-shrink-0">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>初回通算 5回まで生成可能</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-clay flex-shrink-0">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>4種の建物サンプルを即座に試せる</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-clay flex-shrink-0">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>部位別のカラー塗り分け選択</span>
                </li>
              </ul>
              <button
                disabled
                className="mt-auto rounded-full py-3.5 text-xs font-bold bg-sand text-ink-faint cursor-not-allowed text-center"
              >
                登録不要で即座に開始済み
              </button>
            </div>
          </Reveal>

          {/* 単発追加パック */}
          <Reveal delay={150} className="w-full flex">
            <PlanCard
              title="20回生成追加パック"
              price="¥1,480"
              description="単発で使いたい回数のみを追加したい方に"
              features={[
                '追加枠 +20回生成クレジット',
                '高解像度AI塗装生成（影・反射対応）',
                '配色カルテ（PDF）ダウンロード機能',
                '有効期限なし・いつでも消費可能',
              ]}
              buttonText="20回分追加枠を購入する"
              onClick={() => handleCheckout('quota')}
              isLoading={loadingPlan === 'quota'}
            />
          </Reveal>

          {/* Proサブスク */}
          <Reveal delay={200} className="w-full flex">
            <PlanCard
              title="Proプラン"
              price="¥4,980"
              period="月"
              description="ビジネス提案や営業用資料として頻繁に利用する方に"
              features={[
                '1日最大100回まで生成可能（毎日リセット）',
                '高解像度AI塗装生成（最優先・高速処理）',
                '配色カルテ（PDF）無限ダウンロード',
                '商用提案資料や営業用資料への自由な利用',
                'サブスク自動更新・いつでも解約可',
              ]}
              buttonText="Proプランに登録する"
              isPopular={true}
              onClick={() => handleCheckout('pro')}
              isLoading={loadingPlan === 'pro'}
            />
          </Reveal>

          {/* 法人プランサブスク */}
          <Reveal delay={250} className="w-full flex">
            <PlanCard
              title="法人プラン"
              price="¥19,800"
              period="月"
              description="複数メンバーの営業ツールとして導入・共同利用したい企業様に"
              features={[
                '最大5名様まで同時ログイン・共有利用可',
                '1日最大500回まで生成可能（毎日リセット）',
                '高解像度AI塗装生成（最優先・超高速処理）',
                '配色カルテ（PDF）無限ダウンロード',
                '商用提案資料や営業用資料への自由な利用',
                'サブスク自動更新・いつでも解約可',
              ]}
              buttonText="法人プランに登録する"
              onClick={() => handleCheckout('business')}
              isLoading={loadingPlan === 'business'}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
