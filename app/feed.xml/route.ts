import { NextResponse } from 'next/server';
import { blogPosts } from '@/lib/blog';

export const runtime = 'nodejs';

export async function GET() {
  const siteUrl = 'https://wall.smart-ai-portal.com';

  const xmlItems = blogPosts
    .map((post) => {
      const postUrl = `${siteUrl}/blog/${post.slug}`;
      const pubDate = new Date(post.date).toUTCString();
      const eyecatchUrl = post.eyecatch.startsWith('http') 
        ? post.eyecatch 
        : `${siteUrl}${post.eyecatch}`;

      return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${post.excerpt}]]></description>
      <enclosure url="${eyecatchUrl}" length="0" type="image/jpeg" />
    </item>`;
    })
    .join('');

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>WallAI - 外壁塗装シミュレーションブログ</title>
    <link>${siteUrl}/blog</link>
    <description>外壁塗装の色選びやシミュレーション活用術などのお役立ち情報を発信します。</description>
    <language>ja</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    ${xmlItems}
  </channel>
</rss>`;

  return new NextResponse(rssFeed, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
