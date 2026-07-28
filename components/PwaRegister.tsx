'use client';

import { useEffect, useState } from 'react';

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);

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

    // 2. すでにPWAとしてスタンドアロンで起動している場合はバナーを表示しない
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (navigator as any).standalone 
      || document.referrer.includes('android-app://');
      
    if (isStandalone) {
      return;
    }

    // 3. iOS判定 (Safariでの「ホーム画面に追加」誘導用)
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const safari = /safari/.test(ua) && !/chrome|crios|fxios|opera|opt|opios|ucbrowser/.test(ua);
    
    // すでに非表示にされた履歴があるか確認
    const isDismissed = localStorage.getItem('pwa_install_dismissed') === 'true';

    if (ios && safari && !isDismissed) {
      setIsIos(true);
      // iOSの場合はマウント後3秒後にふわっと表示
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // 4. Android/Chrome などのインストーラープロンプトの検知
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // プロンプトを表示
    deferredPrompt.prompt();
    
    // ユーザーの選択を待つ
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // プロンプトは一度しか使えないためクリア
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_install_dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-[calc(100vw-3rem)] rounded-2xl border border-line bg-paper-raised p-4 shadow-deep animate-in fade-in slide-in-from-bottom-4 duration-300 md:w-96 select-none">
      <div className="flex items-start gap-3">
        {/* アプリのミニアイコン */}
        <div className="h-12 w-12 flex-shrink-0 rounded-xl overflow-hidden border border-line-strong shadow-sm bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="WallAI Logo" className="h-full w-full object-cover" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-ink tracking-tight">
            WallAIをホーム画面に追加
          </h4>
          <p className="mt-1 text-[11px] leading-normal text-ink-soft">
            {isIos 
              ? 'Safariのメニューから「ホーム画面に追加」をタップすると、アプリとして全画面でご利用いただけます。' 
              : 'ホーム画面に追加すると、Webブラウザの枠なしでサクサクとシミュレーターを起動できます。'}
          </p>
          
          <div className="mt-3 flex items-center gap-2">
            {!isIos && deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="rounded-lg bg-clay px-3 py-1.5 text-[10px] font-bold text-paper shadow-sm hover:bg-clay/90 transition-colors"
              >
                アプリをインストール
              </button>
            )}
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
  );
}
