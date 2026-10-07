// Telegram WebApp Haptic Feedback Helper

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            photo_url?: string;
          };
          query_id?: string;
        };
        themeParams?: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        colorScheme?: "light" | "dark";
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        ready: () => void;
        expand: () => void;
        close: () => void;
        isVersionAtLeast?: (version: string) => boolean;
        enableClosingConfirmation?: () => void;
        HapticFeedback?: {
          impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred: (type: "error" | "success" | "warning") => void;
          selectionChanged: () => void;
        };
        openLink: (url: string) => void;
        openTelegramLink: (url: string) => void;
      };
    };
  }
}

function supportsHaptic(): boolean {
  if (typeof window === "undefined" || !window.Telegram?.WebApp) return false;
  const tg = window.Telegram.WebApp;
  if (!tg.HapticFeedback) return false;
  if (tg.isVersionAtLeast && !tg.isVersionAtLeast("6.1")) return false;
  return true;
}

export const haptic = {
  impact(style: "light" | "medium" | "heavy" | "rigid" | "soft" = "medium") {
    if (supportsHaptic()) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
      } catch (e) {}
    } else if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(style === "heavy" ? 40 : 20);
      } catch (e) {}
    }
  },

  success() {
    if (supportsHaptic()) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      } catch (e) {}
    } else if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([20, 50, 30]);
      } catch (e) {}
    }
  },

  error() {
    if (supportsHaptic()) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
      } catch (e) {}
    } else if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([50, 50, 50]);
      } catch (e) {}
    }
  },

  selection() {
    if (supportsHaptic()) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
      } catch (e) {}
    }
  },
};
