"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: "free" | "pro" | "unlimited";
  credits: number;
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  refreshUser: () => Promise<void>;
  setUserState: (user: UserProfile | null) => void;
  updateUserCredits: (credits: number) => void;
  logout: () => Promise<void>;
}

const STORAGE_KEY = "wall_ai_user_session";

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  refreshUser: async () => {},
  setUserState: () => {},
  updateUserCredits: () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Load initial state from localStorage if available
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && parsed.email) {
          setUser(parsed);
        }
      }
    } catch {}
  }, []);

  const setUserState = useCallback((newUser: UserProfile | null) => {
    setUser(newUser);
    try {
      if (newUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUserState(data.user);
        } else {
          // Keep cached user if server returns null but cached exists (e.g. cookie delay)
          const cached = localStorage.getItem(STORAGE_KEY);
          if (!cached) {
            setUser(null);
          }
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [setUserState]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  const updateUserCredits = useCallback((newCredits: number) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, credits: newCredits };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUserState(null);
    }
  }, [setUserState]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        refreshUser,
        setUserState,
        updateUserCredits,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
