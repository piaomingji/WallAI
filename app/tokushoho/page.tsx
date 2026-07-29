import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: '特定商取引法に基づく表記 - WallAI',
};

export default function TokushohoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-paper-raised">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl text-center">
            特定商取引法に基づく表記
          </h1>
          <p className="mt-4 text-center text-sm text-ink-soft">
            WallAIのサービスに関する特定商取引法に基づく表記です。
          </p>

          <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
            <dl className="divide-y divide-line text-sm">
              <div className="grid grid-cols-1 p-6 sm:grid-cols-3 sm:gap-4">
                <dt className="font-bold text-ink">事業者名</dt>
                <dd className="mt-1 text-ink-soft sm:col-span-2 sm:mt-0">
                  WallAI運営事務局<br />
                  <span className="text-xs text-ink-faint">
                    ※その他事業者情報（所在地・電話番号等）については、以下のお問い合わせ窓口（Googleフォーム）よりご請求いただいた場合、遅滞なく電子メール等で開示いたします。
                  </span>
                </dd>
              </div>

              <div className="grid grid-cols-1 p-6 sm:grid-cols-3 sm:gap-4">
                <dt className="font-bold text-ink">代表者名</dt>
                <dd className="mt-1 text-ink-soft sm:col-span-2 sm:mt-0">
                  請求があった場合、遅滞なく電子メール等で開示します。
                </dd>
              </div>

              <div className="grid grid-cols-1 p-6 sm:grid-cols-3 sm:gap-4">
                <dt className="font-bold text-ink">所在地・電話番号</dt>
                <dd className="mt-1 text-ink-soft sm:col-span-2 sm:mt-0">
                  請求があった場合、遅滞なく電子メール等で開示します。
                </dd>
              </div>

              <div className="grid grid-cols-1 p-6 sm:grid-cols-3 sm:gap-4">
                <dt className="font-bold text-ink">お問い合わせ</dt>
                <dd className="mt-1 text-ink-soft sm:col-span-2 sm:mt-0">
                  以下のフォームよりお問い合わせください。<br />
                  <a
                    href="https://forms.gle/N5sgkGUvMpUSxbgS7"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-clay hover:underline font-semibold"
                  >
                    お問い合わせフォーム
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="inline">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </dd>
              </div>

              <div className="grid grid-cols-1 p-6 sm:grid-cols-3 sm:gap-4">
                <dt className="font-bold text-ink">販売価格</dt>
                <dd className="mt-1 text-ink-soft sm:col-span-2 sm:mt-0">
                  <ul className="list-disc list-inside space-y-1">
                    <li>単発20回追加パック：980円（税込）</li>
                    <li>Proプラン：月額2,980円（税込）</li>
                    <li>法人プラン：月額9,800円（税込）</li>
                  </ul>
                </dd>
              </div>

              <div className="grid grid-cols-1 p-6 sm:grid-cols-3 sm:gap-4">
                <dt className="font-bold text-ink">商品代金以外の必要料金</dt>
                <dd className="mt-1 text-ink-soft sm:col-span-2 sm:mt-0">
                  インターネット接続料金その他の電気通信回線の通信に関する費用（購入者様のご負担となります）
                </dd>
              </div>

              <div className="grid grid-cols-1 p-6 sm:grid-cols-3 sm:gap-4">
                <dt className="font-bold text-ink">お支払い方法</dt>
                <dd className="mt-1 text-ink-soft sm:col-span-2 sm:mt-0">
                  クレジットカード決済（Stripe）
                </dd>
              </div>

              <div className="grid grid-cols-1 p-6 sm:grid-cols-3 sm:gap-4">
                <dt className="font-bold text-ink">役務の引き渡し時期</dt>
                <dd className="mt-1 text-ink-soft sm:col-span-2 sm:mt-0">
                  お支払い手続き完了後、即時にご利用可能となります。
                </dd>
              </div>

              <div className="grid grid-cols-1 p-6 sm:grid-cols-3 sm:gap-4">
                <dt className="font-bold text-ink">返品・キャンセル</dt>
                <dd className="mt-1 text-ink-soft sm:col-span-2 sm:mt-0">
                  デジタルコンテンツ及びサービスの性質上、決済完了後の返金・返品・キャンセルは受け付けておりません。<br />
                  定期課金（Proプラン・法人プラン）の解約は、次回課金日の前日までいつでもマイページ/設定より解約手続きを行うことができ、次回以降の請求は発生いたしません。
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
