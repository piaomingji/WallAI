"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { Sparkles, Mail, Lock, User, X, CheckCircle2, ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, refreshUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState<boolean>(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Google認証に失敗しました。");
      }
      await refreshUser();
      closeAuthModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }, [refreshUser, closeAuthModal]);

  useEffect(() => {
    if (!isAuthModalOpen) return;

    const REAL_GOOGLE_CLIENT_ID = "729533279786-55pmrngc4lurkcv4dluf048v7es7uiua.apps.googleusercontent.com";
    const envClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientId = (envClientId && !envClientId.includes("demo") && envClientId.startsWith("729533279786"))
      ? envClientId
      : REAL_GOOGLE_CLIENT_ID;

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: { credential?: string }) => {
              if (response.credential) {
                handleGoogleCredential(response.credential);
              }
            },
          });

          const btnContainer = document.getElementById("googleSignInDiv");
          if (btnContainer) {
            btnContainer.innerHTML = "";
            window.google.accounts.id.renderButton(btnContainer, {
              theme: "outline",
              size: "large",
              width: 340,
              text: "continue_with",
              locale: "ja",
              shape: "pill",
            });
          }
        } catch (e) {
          console.warn("Google GIS init error:", e);
        }
      }
    };

    if (!document.getElementById("google-gsi-script")) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else {
      initGoogle();
    }
  }, [isAuthModalOpen, handleGoogleCredential]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isSignUp ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSignUp ? { email, password, name } : { email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "認証処理に失敗しました。");
      }

      await refreshUser();
      closeAuthModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatedGoogleClick = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError("Google認証を準備中です。上の「Googleで続ける」ボタンをお使いいただくか、ページを更新してお試しください。");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isSignUp ? "無料アカウント作成" : "アカウントログイン"}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isSignUp
              ? "無料お試し5回＋会員登録5回＝合計10回分プレゼント！"
              : "ログインして購入プラン・カラー提案履歴を復元"}
          </p>
        </div>

        {isSignUp && (
          <div className="mx-8 mb-4 p-3.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-2xl border border-amber-100 dark:border-amber-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>会員登録の無料特典・安心機能</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>無料お試し5回 ＋ 会員登録特典5回 ＝ 合計10回分プレゼント</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>キャッシュ消去時も有料購入データを永久保持</span>
              </li>
            </ul>
          </div>
        )}

        {/* Google ログイン ボタン */}
        <div className="px-8 mb-4">
          <div className="flex justify-center mb-2" id="googleSignInDiv"></div>
          <button
            type="button"
            onClick={handleSimulatedGoogleClick}
            className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-sm rounded-2xl shadow-xs flex items-center justify-center gap-3 transition-all active:scale-[0.99]"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Googleで1秒{isSignUp ? "無料登録" : "ログイン"}</span>
          </button>

          <div className="relative my-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <span className="relative px-3 text-xs bg-white dark:bg-slate-900 text-slate-400">
              またはメールアドレスで{isSignUp ? "登録" : "ログイン"}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
          {error && (
            <div className="p-3 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/50 rounded-xl border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                お名前（ニックネーム可）
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required={isSignUp}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="山田 太郎"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none dark:text-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              メールアドレス
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              パスワード
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 font-semibold text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>処理中...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{isSignUp ? "メールで無料で始める" : "メールでログイン"}</span>
              </>
            )}
          </button>

          <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            {isSignUp ? (
              <span>
                すでにアカウントをお持ちですか？{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                  }}
                  className="font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  ログイン
                </button>
              </span>
            ) : (
              <span>
                アカウントをお持ちでないですか？{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                  }}
                  className="font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  新規登録（無料）
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
