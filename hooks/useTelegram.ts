"use client";

import { useEffect, useState } from "react";
import { haptic } from "@/lib/haptic";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string>("");
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          tg.expand();
          if (
            tg.isVersionAtLeast &&
            tg.isVersionAtLeast("6.2") &&
            tg.enableClosingConfirmation
          ) {
            tg.enableClosingConfirmation();
          }

          if (tg.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
            setIsTelegram(true);
          }
          if (tg.initData) {
            setInitData(tg.initData);
          }
        } catch (e) {
          console.warn("Telegram WebApp init warning:", e);
        }
      }

      // Tarayıcıdan açıldığında demo kullanıcı oluşturma (yalnızca gerçek Telegram oturumları)
      if (!window.Telegram?.WebApp?.initDataUnsafe?.user) {
        setTgUser(null);
        setIsTelegram(false);
      }

      setIsReady(true);
    }
  }, []);

  return {
    isReady,
    isTelegram,
    user: tgUser,
    initData,
    haptic,
  };
}
