'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_EVENT = 'wallai:storage';

/**
 * localStorage와 동기화되는 상태 훅.
 * useSyncExternalStore를 사용해 SSR 하이드레이션 불일치 없이
 * 마운트 직후 저장된 값으로 자동 갱신된다.
 */
export function useLocalStorage(key: string, fallback: string) {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(STORAGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(STORAGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        if (typeof window !== 'undefined') {
          return localStorage.getItem(key) ?? fallback;
        }
      } catch (e) {
        console.warn('localStorage read blocked or failed:', e);
      }
      return fallback;
    },
    () => fallback
  );

  const setValue = useCallback(
    (next: string) => {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, next);
        }
      } catch (e) {
        console.warn('localStorage write blocked or failed:', e);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(STORAGE_EVENT));
      }
    },
    [key]
  );

  return [value, setValue] as const;
}
