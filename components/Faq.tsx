import Reveal from './Reveal';

const FAQS = [
  {
    q: '希望する塗料の色（日塗工カラーコード）を正確にシミュレーションできますか？',
    a: '日本塗料工業会（日塗工）の標準色に基づいたカラーコードを参考に表示します。AIが光の当たり方や建物の影を考慮してリアルにレンダリングするため、実際の仕上がりイメージに非常に近い状態で確認できます。ただし、実際の塗装工事では、下地の状態や陽の当たり方で多少見え方が変化しますので、最終的な色決定の目安としてご活用ください。',
  },
  {
    q: '窓枠や屋根、ドアなどの位置や形を維持したまま、外壁の色だけを変えられますか？',
    a: 'はい。WallAIは建物の輪郭、窓の配置、ドア、サッシ、バルコニー、周囲の植栽や電線などの構造的特徴を100%完全にロックします。構造は一切変えずに、指定した部位（外壁・メイン／アクセント、屋根、サッシ）の色だけを置き換えます。',
  },
  {
    q: '天候や時間帯による色の見え方の違いも確認できますか？',
    a: 'はい。STEP 3のライティング設定で「昼の太陽光」「夕焼け・西日」「曇り空」を切り替えることができます。晴れた日の眩しい光線での反射具合や、夕暮れ時の暖かみのある光の下での色味の違いなどをAIが忠実にシミュレーションします。',
  },
  {
    q: 'どのような写真をアップロードすれば綺麗にシミュレーションできますか？',
    a: '建物全体に障害物（目の前の大きな木や電柱など）が重なりすぎておらず、外壁や屋根が明るくはっきりと写っている写真をおすすめします。斜めからの角度やスマホ撮影の写真でも対応しています。',
  },
  {
    q: '配色カルテ（PDF）とはどのようなものですか？',
    a: 'シミュレーションした「施工前（ビフォー）」と「塗装完成イメージ（アフター）」を並べ、選択したメイン外壁・アクセント・屋根・サッシの色名称と日塗工カラーコード、および時間帯設定を1枚にまとめたプロフェッショナルな報告書です。印刷して施主様への提案資料にしたり、塗装業者との打ち合わせにそのまま使えます。',
  },
];

export default function Faq() {
  return (
    <section className="w-full border-t border-line bg-paper-raised">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-clay">
            FAQ
          </p>
          <h2 className="font-display mt-3 text-center text-2xl sm:text-3xl font-bold tracking-tight text-ink md:text-4xl">
            よくある質問
          </h2>
        </Reveal>

        <Reveal delay={100} className="mt-12 flex flex-col gap-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-line bg-paper px-4 py-4 sm:px-6 sm:py-5 transition-colors open:border-line-strong"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span className="text-lg font-light text-ink-faint transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
