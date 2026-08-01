import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { blogPosts } from '@/lib/blog';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) {
    return {
      title: '記事が見つかりません - WallAI',
    };
  }

  const siteUrl = 'https://wall-ai-inky.vercel.app';
  const imageUrl = post.eyecatch.startsWith('http') 
    ? post.eyecatch 
    : `${siteUrl}${post.eyecatch}`;

  return {
    title: `${post.title} - WallAI`,
    description: post.excerpt,
    keywords: post.keywords.join(', '),
    openGraph: {
      title: `${post.title} - WallAI`,
      description: post.excerpt,
      images: [
        {
          url: imageUrl,
          alt: post.title,
        }
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} - WallAI`,
      description: post.excerpt,
      images: [imageUrl],
    }
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-paper-raised">
        <div className="mx-auto max-w-3xl px-6 py-20">
          {/* 戻るボタン */}
          <div className="mb-8">
            <Link 
              href="/blog" 
              className="text-xs font-bold text-ink-soft hover:text-clay inline-flex items-center gap-1 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              ブログ一覧へ戻る
            </Link>
          </div>

          <article>
            {/* メタデータ */}
            <div className="flex items-center gap-4 text-xs text-ink-faint mb-4">
              <time dateTime={post.date}>{post.date.replace(/-/g, '/')}</time>
              <span>•</span>
              <span className="bg-paper-raised px-2 py-0.5 rounded-md border border-line font-bold">お役立ちコラム</span>
            </div>

            {/* タイトル */}
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl leading-snug mb-8">
              {post.title}
            </h1>

            {/* アイキャッチ画像 */}
            <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm aspect-video mb-10">
              <img 
                src={post.eyecatch} 
                alt={post.title} 
                className="object-cover w-full h-full"
              />
            </div>

            {/* 記事本文 */}
            <div 
              className="prose-custom text-xs text-ink-soft leading-relaxed space-y-4"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }} 
            />

            {/* キーワードタグ */}
            <div className="mt-12 pt-6 border-t border-line flex flex-wrap gap-2">
              {post.keywords.map((keyword, i) => (
                <span 
                  key={i} 
                  className="bg-paper border border-line px-3 py-1 rounded-full text-[10px] text-ink-soft font-medium"
                >
                  #{keyword}
                </span>
              ))}
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
