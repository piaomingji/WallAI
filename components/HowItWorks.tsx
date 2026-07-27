import Reveal from './Reveal';

const STEPS = [
  {
    no: '01',
    title: '写真アップロード / サンプル選択',
    desc: 'ご自宅の写真（スマホ撮影も可）をアップロードするか、用意された4種の建物サンプルから1つを選択します。',
  },
  {
    no: '02',
    title: '部位と塗装色の指定',
    desc: '「外壁（メイン）」「アクセント」「屋根」「サッシ」から部位を選び、おすすめの標準カラーパレット、またはご自身でアップロードしたサンプル画像の色を当てはめます。',
  },
  {
    no: '03',
    title: '環境・ライティング設定',
    desc: '太陽光（昼）、夕焼け（西日）、曇り空など、天候や時間帯による光の当たり方を切り替えられます。',
  },
  {
    no: '04',
    title: 'AI生成 ＆ 配色カルテ保存',
    desc: '「生成」ボタンを押すとAIが自然な塗装完成イメージを描きます。完成後はカラー配色カルテ（PDF）をダウンロードできます。',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-clay">
            How it works
          </p>
          <h2 className="font-display mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-ink md:text-4xl">
            簡単な4ステップでシミュレーション
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.no} delay={i * 100}>
              <div className="flex h-full flex-col rounded-2xl border border-line bg-paper-raised p-5">
                <span className="font-display text-sm font-bold text-clay">
                  {step.no}
                </span>
                <h3 className="font-display mt-4 text-base font-bold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                  {step.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
