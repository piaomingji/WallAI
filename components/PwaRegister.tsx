'use client';

import { useEffect, useState } from 'react';

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    // 1. Service Worker の登録
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('ServiceWorker registration successful with scope: ', reg.scope);
          })
          .catch((err) => {
            console.error('ServiceWorker registration failed: ', err);
          });
      });
    }

    // 2. すでにスタンドアロン（アプリ形式）で起動している場合はバナーを表示しない
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (navigator as any).standalone 
      || document.referrer.includes('android-app://');
      
    if (isStandalone) {
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    
    // 3. モバイル端末判定 (スマホ・タブレット)
    const isMobile = /iphone|ipad|ipod|android|webos|blackberry|iemobile|opera mini/i.test(ua);
    
    // 非表示にされた有効期限を確認 (24時間再表示制限)
    const dismissedUntil = localStorage.getItem('pwa_install_dismissed_until');
    const isDismissed = dismissedUntil && Date.now() < parseInt(dismissedUntil, 10);

    // iOS Safari 判定
    const ios = /iphone|ipad|ipod/.test(ua);
    const safari = /safari/.test(ua) && !/chrome|crios|fxios|opera|opt|opios|ucbrowser/.test(ua);
    setIsIosSafari(ios && safari);

    // スマホ環境かつ未非表示であれば、3秒後にバナーを表示
    if (isMobile && !isDismissed) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // 4. Android/Chrome のネイティブプロンプト検知
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Android/Chrome等のネイティブインストールダイアログ
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User choice: ${outcome}`);
      setDeferredPrompt(null);
      setShowBanner(false);
    } else {
      // iOS Safariや、ネイティブインストールに対応していない場合の追加手順ガイドを表示
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    // 24時間の非表示期限を設定
    const expireTime = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa_install_dismissed_until', expireTime.toString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* ── 1. 右下のアナウンスバナー ── */}
      <div className="fixed bottom-6 right-6 z-50 max-w-sm w-[calc(100vw-3rem)] rounded-2xl border border-line bg-paper-raised p-4 shadow-deep animate-in fade-in slide-in-from-bottom-4 duration-300 md:w-96 select-none">
        <div className="flex items-start gap-3">
          {/* ミニアイコン */}
          <div className="h-12 w-12 flex-shrink-0 rounded-xl overflow-hidden border border-line-strong shadow-sm bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="WallAI Logo" className="h-full w-full object-cover" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-ink tracking-tight">
              WallAIをホーム画面に追加
            </h4>
            <p className="mt-1 text-[11px] leading-normal text-ink-soft">
              ホーム画面に追加すると、Webブラウザの枠なしで全画面のネイティブアプリのようにサクサク起動できます。
            </p>
            
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="rounded-lg bg-clay px-3.5 py-1.5 text-[10px] font-bold text-paper shadow-sm hover:bg-clay/90 transition-colors"
              >
                ホーム画面に追加する
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[10px] font-bold text-ink-soft hover:bg-paper-raised transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. ホーム画面追加 手順ナビゲーションモーダル (iOS/一般ブラウザ用) ── */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-sm w-full rounded-3xl border border-line bg-paper p-6 shadow-deep animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl overflow-hidden border border-line-strong shadow-sm bg-ink mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon-192.png" alt="WallAI Logo" className="h-full w-full object-cover" />
              </div>
              
              <h3 className="text-sm font-bold text-ink">ホーム画面に追加する方法</h3>
              
              <div className="mt-4 w-full text-left space-y-3.5 text-xs text-ink-soft">
                {isIosSafari ? (
                  // iOS Safari の追加手順
                  <>
                    <p className="leading-relaxed">
                      iOS (iPhone/iPad) のシステム制限により、以下の手順でお手元での追加をお願いいたします：
                    </p>
                    <div className="rounded-xl bg-paper-raised p-3 border border-line space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay text-[10px] font-bold text-paper">1</span>
                        <span>画面下部の<strong>「共有ボタン」</strong>（四角から上矢印のアイコン）をタップ</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay text-[10px] font-bold text-paper">2</span>
                        <span>メニューをスクロールし、<strong>「ホーム画面に追加」</strong>をタップ</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay text-[10px] font-bold text-paper">3</span>
                        <span>右上の<strong>「追加」</strong>をタップして完了です</span>
                      </div>
                    </div>
                  </>
                ) : (
                  // Android等のその他ブラウザの追加手順
                  <>
                    <p className="leading-relaxed">
                      お使いのブラウザメニューから簡単にホーム画面に追加できます：
                    </p>
                    <div className="rounded-xl bg-paper-raised p-3 border border-line space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay text-[10px] font-bold text-paper">1</span>
                        <span>ブラウザメニュー（右上または右下の「︙」や「☰」）を開く</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay text-[10px] font-bold text-paper">2</span>
                        <span>メニュー内の<strong>「アプリをインストール」</strong>または<strong>「ホーム画面に追加」</strong>をタップします</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowGuideModal(false);
                  setShowBanner(false);
                  // ガイドを閉じたら非表示期間をリセットしてテストしやすくする
                  localStorage.removeItem('pwa_install_dismissed_until');
                }}
                className="mt-6 w-full rounded-xl bg-ink py-2.5 text-xs font-bold text-paper hover:bg-ink/90 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
