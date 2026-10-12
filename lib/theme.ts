export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "azfur_theme";

// Axis --background değerlerinin hex karşılıkları (Telegram başlık/zemin rengi için)
const THEME_BG: Record<ThemeMode, string> = {
  light: "#ffffff",
  dark: "#0a0a0a",
};

/**
 * Sayfa boyanmadan önce çalışan script: kayıtlı tercih > Telegram > sistem > koyu.
 */
export const themeInitScript = `
(function() {
  try {
    var t = null;
    try { t = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch (e) {}
    if (t !== 'light' && t !== 'dark') {
      var tg = window.Telegram && window.Telegram.WebApp;
      if (tg && (tg.colorScheme === 'light' || tg.colorScheme === 'dark')) t = tg.colorScheme;
      else if (window.matchMedia) t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      else t = 'dark';
    }
    document.documentElement.classList.toggle('dark', t === 'dark');
  } catch (e) {}
})();
`;

export function getStoredTheme(): ThemeMode | null {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function getCurrentTheme(): ThemeMode {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode, persist = false) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {}
  }
  try {
    const tg = window.Telegram?.WebApp as any;
    if (tg?.isVersionAtLeast?.("6.1")) {
      tg.setHeaderColor?.(THEME_BG[mode]);
      tg.setBackgroundColor?.(THEME_BG[mode]);
    }
  } catch {}
}
