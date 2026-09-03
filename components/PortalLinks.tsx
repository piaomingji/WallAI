// Smart AI Portal（本体サイト）への導線。ブログ記事と記事一覧の末尾で使用します。
const PORTAL_URL = 'https://smart-ai-portal.com';

const TOOLS = [
  { slug: 'reroom', name: 'ReRoom AI', desc: '部屋・インテリアのAI再設計' },
  { slug: 'studio', name: 'Studio AI', desc: '証明写真・プロフィール写真の作成' },
  { slug: 'amazon', name: 'Amazon セラー AI', desc: 'Amazon出品カタログの自動生成' },
  { slug: 'frima', name: 'Frima AI', desc: 'フリマ出品文の自動作成' },
  { slug: 'talkie', name: 'Talkie AI', desc: '78言語のリアルタイム音声翻訳' },
];

export default function PortalLinks() {
  return (
    <section className="mx-auto w-full max-w-3xl px-5 pb-16">
      <div className="rounded-2xl border border-line bg-paper-raised p-6 sm:p-8">
        <p className="text-[11px] font-bold tracking-[0.14em] text-clay mb-2">SMART AI PORTAL</p>
        <h2 className="text-lg sm:text-xl font-bold text-ink mb-2 leading-snug">ほかにもこんなAIツールがあります</h2>
        <p className="text-xs text-ink-soft leading-relaxed mb-6">
          Smart AI Portal では、暮らしと仕事の困りごとを解決する目的特化型のAIツールを無料で公開しています。
        </p>

        <ul className="grid gap-2 sm:grid-cols-2 mb-6 list-none p-0">
          {TOOLS.map((tool) => (
            <li key={tool.slug}>
              <a href={`${PORTAL_URL}/${tool.slug}`} className="block h-full rounded-xl border border-line bg-paper px-4 py-3 transition hover:border-clay/50 hover:bg-clay-soft/50">
                <span className="block text-[13px] font-bold text-ink">{tool.name}</span>
                <span className="block text-[11px] text-ink-faint mt-0.5 leading-relaxed">{tool.desc}</span>
              </a>
            </li>
          ))}
        </ul>

        <a href={PORTAL_URL} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-clay hover:text-clay-deep transition">
          Smart AI Portal ですべてのツールを見る
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </a>
      </div>
    </section>
  );
}
