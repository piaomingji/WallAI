"use client";

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LogIn, UserPlus, LogOut, Zap, Crown, ChevronDown, CreditCard } from "lucide-react";

export const UserNav: React.FC = () => {
  const { user, loading, openAuthModal, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  if (loading) {
    return <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={openAuthModal}
          className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>ログイン</span>
        </button>
        <button
          onClick={openAuthModal}
          className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm hover:shadow-amber-500/20 transition-all flex items-center gap-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>無料登録</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-3">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 rounded-full text-xs font-semibold text-amber-800 dark:text-amber-300 shadow-xs">
        {user.plan === "pro" || user.plan === "unlimited" ? (
          <>
            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Pro会員</span>
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>残り {user.credits} 回</span>
          </>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-medium text-slate-700 dark:text-slate-200"
        >
          <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {user.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <span className="max-w-[100px] truncate hidden sm:inline">{user.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {dropdownOpen && (
          <div
            className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
            {(user.hasPurchased || user.plan === "pro" || user.plan === "unlimited") && (
              <>
                <button
                  onClick={async () => {
                    setPortalError("");
                    setPortalLoading(true);
                    try {
                      const res = await fetch("/api/billing-portal", { method: "POST" });
                      const data = await res.json();
                      if (data.url) {
                        window.location.href = data.url;
                        return;
                      }
                      setPortalError(data.error || "お支払い画面を開けませんでした。");
                    } catch {
                      setPortalError("お支払い画面を開けませんでした。");
                    }
                    setPortalLoading(false);
                  }}
                  disabled={portalLoading}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{portalLoading ? "開いています…" : "お支払い・解約"}</span>
                </button>
                {portalError && (
                  <p className="px-4 pb-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {portalError}
                  </p>
                )}
              </>
            )}
            <button
              onClick={() => {
                setDropdownOpen(false);
                logout();
              }}
              className="w-full text-left px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ログアウト</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
