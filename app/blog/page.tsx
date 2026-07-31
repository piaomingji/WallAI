import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { blogPosts } from '@/lib/blog';
import Link from 'next/link';

export const metadata = {
  title: '外壁塗装お役立ちブログ - WallAI',
  description: '外壁塗装の色選びやシミュレーション活用術など、理想のマイホームづくりのためのお役立ち情報を発信します。',
};

export default function BlogListPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-paper-raised">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
              外壁塗装お役立ちブログ
            </h1>
            <p className="mt-4 text-sm text-ink-soft">
              理想の外壁カラーを見つけるためのヒントや、色選びで失敗しないためのノウハウをお届けします。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {blogPosts.map((post) => (
              <article 
                key={post.slug}
                className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col"
              >
                <Link href={`/blog/${post.slug}`} className="block overflow-hidden aspect-video relative bg-line">
                  <img 
                    src={post.eyecatch} 
                    alt={post.title} 
                    className="object-cover w-full h-full hover:scale-105 transition-transform duration-500"
                  />
                </Link>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-4 text-xs text-ink-faint mb-3">
                    <time dateTime={post.date}>{post.date.replace(/-/g, '/')}</time>
                    <span>•</span>
                    <span className="bg-paper-raised px-2 py-0.5 rounded-md border border-line font-bold">SEO記事</span>
                  </div>
                  <h2 className="font-display text-base font-bold text-ink mb-3 leading-snug hover:text-clay transition-colors">
                    <Link href={`/blog/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-xs text-ink-soft leading-relaxed mb-6 flex-1">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-line">
                    <div className="flex flex-wrap gap-1">
                      {post.keywords.slice(0, 2).map((keyword, i) => (
                        <span key={i} className="text-[10px] text-ink-faint">
                          #{keyword}
                        </span>
                      ))}
                    </div>
                    <Link 
                      href={`/blog/${post.slug}`} 
                      className="text-xs font-bold text-clay hover:underline inline-flex items-center gap-1"
                    >
                      続きを読む
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
