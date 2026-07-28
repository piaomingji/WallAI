import CompareSlider from './CompareSlider';
import Reveal from './Reveal';

const STATS = [
  { value: '10秒', label: '平均生成時間' },
  { value: '10色以上', label: '標準おすすめカラー' },
  { value: '通算2回', label: '無料体験' },
];

export default function Hero() {
  return (
    <section id="top" className="relative w-full overflow-hidden">
      {/* 은은한 배경 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[840px] -translate-x-1/2 rounded-full bg-clay-soft opacity-60 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-20 text-center md:pt-28">
        <Reveal className="flex flex-col items-center">
          <p className="mb-6 flex items-center gap-2 rounded-full border border-line bg-paper-raised px-4 py-1.5 text-xs font-medium tracking-wide text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-clay" />
            AI外壁塗装シミュレーション・スタジオ
          </p>

          <h1 className="font-display max-w-3xl text-4xl font-bold leading-[1.3] tracking-tight text-ink md:text-6xl md:leading-[1.25]">
            写真1枚で、
            <br />
            外壁塗装の <em className="not-italic text-clay">完成イメージ</em> を瞬時に描く
          </h1>

          <p className="mt-7 max-w-xl text-base leading-relaxed text-ink-soft md:text-lg">
            お住まいの写真をアップロードして色を選ぶだけで、AIが約10秒で本物さながらの塗装イメージを作成。間取りや窓の位置、建物の構造を維持したまま、外壁の配色をリアルにシミュレーションします。
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#studio"
              className="rounded-full bg-ink px-8 py-4 text-sm font-semibold text-paper shadow-lift transition-all duration-300 hover:-translate-y-0.5 hover:bg-clay"
            >
              無料で塗装シミュレーションを試す
            </a>
          </div>

          <dl className="mt-12 flex items-center divide-x divide-line">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-3 sm:px-9">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-display text-xl font-bold text-ink md:text-2xl">
                  {stat.value}
                </dd>
                <dd className="mt-1 text-[11px] tracking-wide text-ink-faint">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* ショーケース スライダー */}
        <Reveal delay={150} className="mt-16 w-full max-w-4xl">
          <CompareSlider
            beforeSrc="/demo-before-v2.jpg"
            afterSrc="/demo-after-v2.jpg"
            beforeAlt="塗装前（元の標準的な日本の住宅写真）"
            afterAlt="塗装完成イメージ（チャコールグレー×ホワイト）"
            priority
          />
          <p className="mt-4 text-xs text-ink-faint">
            スライダーを左右にドラッグして、外壁塗装前後のイメージ変化を確認できます。
          </p>
        </Reveal>
      </div>
    </section>
  );
}
