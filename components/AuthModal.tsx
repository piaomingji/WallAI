"use client";

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Sparkles, Mail, Lock, User, X, CheckCircle2, ShieldCheck } from "lucide-react";

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, refreshUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState<boolean>(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
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
              ? "会員登録で外壁シミュレーション無料試行+5回分プレゼント！"
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
                <span>新規登録で無料生成クレジット +5回分プレゼント</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>キャッシュ消去時も有料購入データを永久保持</span>
              </li>
            </ul>
          </div>
        )}

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
                <span>{isSignUp ? "無料で始める" : "ログイン"}</span>
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
