"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseIdleDetectionOptions {
  /** アイドル判定までの時間（ミリ秒）デフォルト: 60000（1分） */
  timeout?: number;
  /** アイドル検知時のコールバック */
  onIdle?: () => void;
  /** 監視対象のイベント */
  events?: string[];
  /** 有効/無効の切り替え */
  enabled?: boolean;
}

interface UseIdleDetectionReturn {
  /** アイドル状態かどうか */
  isIdle: boolean;
  /** アイドル状態をリセット */
  reset: () => void;
  /** 検知を一時停止 */
  pause: () => void;
  /** 検知を再開 */
  resume: () => void;
}

const DEFAULT_EVENTS = [
  "mousemove",
  "mousedown",
  "keypress",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
];

/**
 * ユーザーのアイドル状態を検知するカスタムフック
 *
 * @example
 * const { isIdle, reset } = useIdleDetection({
 *   timeout: 60000, // 1分
 *   onIdle: () => setShowModal(true),
 * });
 */
export function useIdleDetection(
  options: UseIdleDetectionOptions = {}
): UseIdleDetectionReturn {
  const {
    timeout = 60000,
    onIdle,
    events = DEFAULT_EVENTS,
    enabled = true,
  } = options;

  const [isIdle, setIsIdle] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onIdleRef = useRef(onIdle);

  // onIdleの最新の参照を保持
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsIdle(true);
      onIdleRef.current?.();
    }, timeout);
  }, [timeout, clearTimer]);

  const reset = useCallback(() => {
    setIsIdle(false);
    if (!isPaused && enabled) {
      startTimer();
    }
  }, [isPaused, enabled, startTimer]);

  const handleActivity = useCallback(() => {
    if (isPaused || !enabled) return;

    if (isIdle) {
      setIsIdle(false);
    }
    startTimer();
  }, [isIdle, isPaused, enabled, startTimer]);

  const pause = useCallback(() => {
    setIsPaused(true);
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    setIsPaused(false);
    if (enabled) {
      startTimer();
    }
  }, [enabled, startTimer]);

  useEffect(() => {
    if (!enabled || isPaused) {
      clearTimer();
      return;
    }

    // 初回タイマー開始
    startTimer();

    // イベントリスナーを登録
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearTimer();
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, isPaused, events, handleActivity, startTimer, clearTimer]);

  return {
    isIdle,
    reset,
    pause,
    resume,
  };
}
