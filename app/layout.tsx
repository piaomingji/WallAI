import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const notoSerif = Noto_Serif_JP({
  weight: ["400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://wall-ai-inky.vercel.app"),
  title: "WallAI - AI外壁塗装シミュレーター | 営業提案・完成予想図作成ツール",
  description:
    "お家の写真をアップロードして色を選ぶだけで、AIが約10秒で外壁塗装後の完成予想図を作成。部位ごとの色分けや配色カルテPDFの印刷にも対応し、リフォーム・外壁塗装の提案をスマートにします。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WallAI",
  },
  openGraph: {
    title: "WallAI - AI外壁塗装シミュレーター | 営業提案・完成予想図作成ツール",
    description:
      "お家の写真をアップロードして色を選ぶだけで、AIが約10秒で外壁塗装後の完成予想図を作成します。",
    url: "https://wall-ai-inky.vercel.app",
    siteName: "WallAI",
    images: [
      {
        url: "/japanese_house_painted.png",
        width: 1200,
        height: 1200,
        alt: "WallAI 外壁塗装AIシミュレーション 提案ショーケース",
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

import PwaRegister from "@/components/PwaRegister";
import { Analytics } from "@vercel/analytics/next";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`h-full antialiased ${notoSerif.variable}`}>
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        {children}
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
